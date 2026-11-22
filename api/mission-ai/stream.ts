import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

interface AiChatInputMessage {
  role?: string;
  text?: string;
}

interface AiTurn {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface RouteSpec {
  model: string;
  label: string;
  thinkingLevel: ThinkingLevel;
  useCompactLiteParams: boolean;
  timeoutMs: number;
}

const ROUTES: RouteSpec[] = [
  {
    model: 'gemini-3.1-flash-lite',
    label: 'Primary Flash Lite',
    thinkingLevel: ThinkingLevel.MINIMAL,
    useCompactLiteParams: true,
    timeoutMs: 12000,
  },
  {
    model: 'gemini-4-hydrogen',
    label: 'Secondary Flash',
    thinkingLevel: ThinkingLevel.LOW,
    useCompactLiteParams: false,
    timeoutMs: 15000,
  },
];

let stickyHealthyModel: string | null = null;
let stickyHealthyUpdatedAt = 0;

function getOrderedRoutes(): RouteSpec[] {
  if (stickyHealthyModel && Date.now() - stickyHealthyUpdatedAt < 60_000) {
    const preferred = ROUTES.find((r) => r.model === stickyHealthyModel);
    if (preferred) {
      return [preferred, ...ROUTES.filter((r) => r.model !== stickyHealthyModel)];
    }
  }
  return ROUTES;
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  setCorsHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

async function readJsonBody<T>(req: IncomingMessage & { body?: unknown }): Promise<T> {
  if (req.body && typeof req.body === 'object') {
    return req.body as T;
  }
  if (typeof req.body === 'string') {
    return (req.body.trim() ? JSON.parse(req.body) : {}) as T;
  }
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > 1024 * 1024) {
      throw new Error('Request payload too large.');
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}

function normalizeHistory(messages: AiChatInputMessage[]): AiTurn[] {
  const cleaned = messages
    .map((m) => ({
      role: (m.role === 'assistant' || m.role === 'model' ? 'model' : 'user') as 'user' | 'model',
      text: (m.text || '').trim(),
    }))
    .filter((m) => m.text.length > 0);

  while (cleaned.length > 0 && cleaned[0].role === 'model') {
    cleaned.shift();
  }

  const merged: Array<{ role: 'user' | 'model'; text: string }> = [];
  for (const item of cleaned) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === item.role) {
      prev.text = `${prev.text}\n\n${item.text}`;
    } else {
      merged.push({ ...item });
    }
  }

  return merged.slice(-8).map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));
}

function buildSystemInstruction(languagePreference?: 'bilingual' | 'english' | 'hindi'): string {
  const langDirective =
    languagePreference === 'hindi'
      ? 'Respond primarily in simple, clear Hindi (Devanagari) with key technical terms in English brackets.'
      : languagePreference === 'english'
        ? 'Respond in simple, clear student-friendly English, adding brief Hindi meaning for difficult terms when helpful.'
        : 'Respond in clear, simple bilingual Hindi and English (easy-to-read English paired with simple Hindi explanation, or Hinglish/Devanagari where natural) so school students from Class 1 to 12 understand effortlessly.';

  return `You are "Mission AI", the official AI assistant for "Advice Mission Point".

Knowledge Base (use strictly when relevant to the user's question):
- Website / Institute: Advice Mission Point
- Tagline: "To Struggle, Take Success."
- Owner / Founder: Surendra Sir
- Assistant Name: Mission AI
- Address: Ramauli, Darbhanga, Bihar, India 847101
- Classes: Class 1 to Class 12
- Timings: Mon – Sat · 6:30 AM – 6:30 PM
- Subjects: Mathematics, Science (Physics, Chemistry, Biology), English, Social Studies

STRICT RESPONSE RULES:
1. Answer **exactly** what the user asks — clean, natural, accurate, and directly useful like Gemini.
2. Keep simple answers short and direct.
3. Do NOT add unnecessary introductions (do not introduce yourself unless asked) or unnecessary conclusions ("Feel free to ask", "How can I help today?", etc.).
4. Do NOT repeat greetings in every message. Only start with "नमस्ते!" (in Hindi Devanagari) if the user specifically greets you (e.g., "Hello", "Hi", "Namaste"), and never repeat greetings on study questions or follow-ups.
5. Do NOT add promotional content, coaching advertisements, or unrelated suggestions.
6. Do NOT repeat information already provided in the conversation.
7. Avoid filler words and meaningless sentences.
8. Give detailed explanations only when requested or needed for multi-step accuracy — never sacrifice accuracy just to make an answer shorter.
9. ${langDirective}
10. Use plain Unicode math symbols (×, ÷, ², √) instead of LaTeX $ dollar signs.`;
}

function isAuthError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();
  return (
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('access_token_scope_insufficient') ||
    /\b403\b/.test(lower)
  );
}

function isTransientError(err: unknown): boolean {
  if (isAuthError(err)) return false;
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();
  return (
    lower.includes('503') ||
    lower.includes('429') ||
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('504') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('resource_exhausted') ||
    lower.includes('too many requests') ||
    lower.includes('quota') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('abort') ||
    lower.includes('fetch') ||
    lower.includes('network') ||
    lower.includes('empty model response')
  );
}

function formatError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase();
  if (
    lower.includes('api_key_invalid') ||
    lower.includes('gemini_api_key') ||
    lower.includes('not configured') ||
    lower.includes('permission_denied') ||
    lower.includes('403')
  ) {
    return 'Gemini API key needs attention in Vercel Environment Variables (GEMINI_API_KEY) before Mission AI can answer.';
  }
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return 'Too many questions arrived at once — wait a couple of seconds and click Ask Again. Your question is saved right here (एक साथ कई प्रश्न आए हैं, कृपया कुछ सेकंड बाद Ask Again दबाएं).';
  }
  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand')) {
    return 'The AI service experienced heavy traffic across backup models. Your question is saved — click Ask Again to send it once more (उच्च ट्रैफ़िक के कारण उत्तर नहीं मिल सका, कृपया Ask Again दबाएं).';
  }
  if (lower.includes('timeout') || lower.includes('504') || lower.includes('network')) {
    return 'The reply took longer than expected due to a brief connection delay. Your question is saved — click Ask Again to continue (कनेक्शन में देरी हुई, कृपया Ask Again दबाएं).';
  }
  return 'Could not finish this answer right now. Your question is saved right here — click Ask Again to continue.';
}

async function runWithAbortTimeout<T>(
  timeoutMs: number,
  task: (controller: AbortController, clearInitialTimeout: () => void) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const clearInitialTimeout = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  try {
    return await Promise.race([
      task(controller, clearInitialTimeout),
      new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener(
          'abort',
          () => {
            reject(
              new Error(
                timedOut
                  ? 'Request timeout (504) while waiting for AI model'
                  : 'Request aborted',
              ),
            );
          },
          { once: true },
        );
      }),
    ]);
  } finally {
    clearInitialTimeout();
  }
}

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

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    sendJson(res, 400, { error: 'Please enter a question or doubt first.' });
    return;
  }
  const normalizedTurns = normalizeHistory(body.messages);
  if (normalizedTurns.length === 0) {
    sendJson(res, 400, { error: 'Please enter a valid question or doubt first.' });
    return;
  }

  const rawKey = process.env.GEMINI_API_KEY?.trim() || '';
  if (!rawKey || rawKey === 'MY_GEMINI_API_KEY') {
    sendJson(res, 503, {
      error:
        'Mission AI needs GEMINI_API_KEY configured in Vercel Project Settings > Environment Variables.',
    });
    return;
  }

  const ai = new GoogleGenAI({
    apiKey: rawKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const systemInstruction = buildSystemInstruction(body.languagePreference);

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
  const routes = getOrderedRoutes();
  let lastError: unknown;
  let backoffRound = 0;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (emittedAny || clientDisconnected || res.writableEnded) {
      break;
    }
    const route = routes[attempt % routes.length];
    try {
      await runWithAbortTimeout(route.timeoutMs, async (controller, clearInitialTimeout) => {
        const config = route.useCompactLiteParams
          ? {
              systemInstruction,
              thinkingConfig: { thinkingLevel: route.thinkingLevel },
              temperature: 0.5,
              maxOutputTokens: 512,
              abortSignal: controller.signal,
            }
          : {
              systemInstruction,
              thinkingConfig: { thinkingLevel: route.thinkingLevel },
              abortSignal: controller.signal,
            };

        const stream = await ai.models.generateContentStream({
          model: route.model,
          contents: normalizedTurns,
          config,
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

      stickyHealthyModel = route.model;
      stickyHealthyUpdatedAt = Date.now();
      sendEvent({ done: true, model: route.label });
      res.end();
      return;
    } catch (error) {
      lastError = error;
      if (emittedAny) {
        sendEvent({ done: true });
        res.end();
        return;
      }
      if (clientDisconnected || res.writableEnded || isAuthError(error) || attempt >= 3) {
        break;
      }
      const nextRoute = routes[(attempt + 1) % routes.length];
      const switchingModel = nextRoute.model !== route.model;
      if (!isTransientError(error) && !switchingModel) {
        break;
      }

      let delayMs = 0;
      let reason: 'failover' | 'backoff' = 'failover';
      if (attempt === 0 && switchingModel) {
        delayMs = 0;
      } else {
        delayMs = Math.min(2200, 450 * Math.pow(2, backoffRound));
        backoffRound += 1;
        reason = 'backoff';
      }

      sendEvent({
        status: reason,
        message:
          reason === 'failover'
            ? 'Primary AI is busy — switching seamlessly to backup model...'
            : 'High traffic detected — retrying gently in a moment...',
      });

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  const rawMessage =
    lastError instanceof Error ? lastError.message : 'Unable to reach Gemini API right now.';
  sendEvent({ error: formatError(rawMessage) });
  res.end();
}
