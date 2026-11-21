import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  buildAiPromptContext,
  buildGeminiConfig,
  executeMultiModelWithFallback,
  formatFriendlyAiError,
  getGeminiClient,
  getOrderedAiRoutes,
  readJsonBody,
  recordHealthyAiModel,
  runWithAbortTimeout,
  sendJson,
  setCorsHeaders,
  type AiChatInputMessage,
} from '../_lib/geminiAi'js;

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
    return;
  }

  let body: {
    messages?: AiChatInputMessage[];
    languagePreference?: 'bilingual' | 'english' | 'hindi';
  } = {};

  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON request body.' });
    return;
  }

  const ctx = buildAiPromptContext(body.messages, body.languagePreference);
  if ('error' in ctx) {
    sendJson(res, 400, { error: ctx.error });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    sendJson(res, 503, {
      error:
        'Advice Mission AI needs GEMINI_API_KEY configured in Vercel Project Settings > Environment Variables (and redeployed).',
    });
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  (res as ServerResponse & { flushHeaders?: () => void }).flushHeaders?.();

  let clientDisconnected = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      clientDisconnected = true;
    }
  });

  const sendEvent = (payload: Record<string, unknown>) => {
    if (!res.writableEnded && !clientDisconnected) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  let emittedAny = false;
  const routes = getOrderedAiRoutes();

  try {
    const { route: winningRoute } = await executeMultiModelWithFallback(
      async (route) => {
        if (clientDisconnected || res.writableEnded) {
          return;
        }

        await runWithAbortTimeout(route.timeoutMs, async (controller, clearInitialTimeout) => {
          const stream = await ai.models.generateContentStream({
            model: route.model,
            contents: ctx.normalizedTurns,
            config: buildGeminiConfig(route, ctx.systemInstruction, controller.signal),
          });

          for await (const chunk of stream) {
            if (clientDisconnected || res.writableEnded) {
              controller.abort();
              break;
            }
            const delta = chunk.text;
            if (delta) {
              if (!emittedAny) {
                clearInitialTimeout();
                emittedAny = true;
              }
              sendEvent({ delta });
            }
          }
        });

        if (!emittedAny && !clientDisconnected) {
          throw new Error('Empty model response.');
        }
      },
      {
        routes,
        maxAttempts: 4,
        baseDelayMs: 450,
        maxDelayMs: 2200,
        shouldAbort: () => emittedAny || clientDisconnected || res.writableEnded,
        onStatus: ({ reason }) => {
          sendEvent({
            status: reason,
            message:
              reason === 'failover'
                ? 'Primary AI is busy — switching seamlessly to backup model...'
                : 'High traffic detected — retrying gently in a moment...',
          });
        },
      },
    );

    recordHealthyAiModel(winningRoute.model);
    sendEvent({ done: true, model: winningRoute.label });
    res.end();
  } catch (err) {
    if (emittedAny) {
      sendEvent({ done: true });
      res.end();
      return;
    }
    const rawMessage =
      err instanceof Error ? err.message : 'Unable to reach Gemini API right now.';
    sendEvent({ error: formatFriendlyAiError(rawMessage) });
    res.end();
  }
}
