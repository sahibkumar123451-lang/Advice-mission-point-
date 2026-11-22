import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  buildGeminiConfig,
  buildMissionAiPromptContext,
  executeMultiModelWithFallback,
  formatFriendlyAiError,
  getGeminiClient,
  getOrderedMissionAiRoutes,
  isTransientGeminiApiError,
  readJsonBody,
  recordHealthyMissionAiModel,
  runWithAbortTimeout,
  sendJson,
  setCorsHeaders,
  type AiChatInputMessage,
} from '../_lib/missionAi';

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

  const ctx = buildMissionAiPromptContext(body.messages, body.languagePreference);
  if ('error' in ctx) {
    sendJson(res, 400, { error: ctx.error });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    sendJson(res, 503, {
      error:
        'Mission AI needs GEMINI_API_KEY configured in Vercel Project Settings > Environment Variables.',
    });
    return;
  }

  const routes = getOrderedMissionAiRoutes();
  try {
    const { result: answer, route: winningRoute } = await executeMultiModelWithFallback(
      async (route) => {
        const response = await runWithAbortTimeout(
          route.timeoutMs,
          async (controller) =>
            ai.models.generateContent({
              model: route.model,
              contents: ctx.normalizedTurns,
              config: buildGeminiConfig(route, ctx.systemInstruction, controller.signal),
            }),
        );

        const text = response.text?.trim();
        if (!text) {
          throw new Error('Empty model response.');
        }
        return text;
      },
      {
        routes,
        maxAttempts: 4,
        baseDelayMs: 450,
        maxDelayMs: 2200,
      },
    );

    recordHealthyMissionAiModel(winningRoute.model);
    sendJson(res, 200, { answer });
  } catch (err) {
    const rawMessage =
      err instanceof Error ? err.message : 'Unable to reach Gemini API right now.';
    const statusCode = isTransientGeminiApiError(err) ? 503 : 502;
    sendJson(res, statusCode, {
      error: formatFriendlyAiError(rawMessage),
    });
  }
}
