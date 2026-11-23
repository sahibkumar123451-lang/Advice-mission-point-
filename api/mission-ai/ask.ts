import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI } from '@google/genai';

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
  useCompactLiteParams: boolean;
  timeoutMs: number;
}

const ROUTES: RouteSpec[] = [
  {
    model: 'gemini-2.5-flash-lite',
    label: 'Primary Flash Lite',
    useCompactLiteParams: true,
    timeoutMs: 12000,
  },
  {
    model: 'gemini-2.5-flash',
    label: 'Secondary Flash',
    useCompactLiteParams: false,
    timeoutMs: 15000,
  },
];

const modelCooldownUntil = new Map<string, number>();
const RATE_LIMIT_COOLDOWN_MS = 30_000;
const responseCache = new Map<string, { answer: string; cachedAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getOrderedRoutes(): RouteSpec[] {
  const now = Date.now();
  const healthy = ROUTES.filter((r) => (modelCooldownUntil.get(r.model) ?? 0) <= now);
  const cooling = ROUTES.filter((r) => (modelCooldownUntil.get(r.model) ?? 0) > now);
  return healthy.length > 0 ? [...healthy, ...cooling] : ROUTES;
}

function recordRateLimit(model: string, err: unknown): void {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota')) {
    modelCooldownUntil.set(model, Date.now() + RATE_LIMIT_COOLDOWN_MS);
  }
}

function buildCacheKey(turns: AiTurn[], lang = 'bilingual'): string {
  const clean = turns.map((t) => ({
    role: t.role,
    text: (t.parts[0]?.text || '').trim().replace(/\s+/g, ' ').toLowerCase(),
  }));
  return `${lang}::${JSON.stringify(clean)}`;
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
  task: (controller: AbortController) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await Promise.race([
      task(controller),
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
    clearTimeout(timer);
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

  const cacheKey = buildCacheKey(normalizedTurns, body.languagePreference || 'bilingual');
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    sendJson(res, 200, { answer: cached.answer, cached: true });
    return;
  }

  const ai = new GoogleGenAI({
    apiKey: rawKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const systemInstruction = buildSystemInstruction(body.languagePreference);
  const routes = getOrderedRoutes();
  let lastError: unknown;
  let backoffRound = 0;

  // Max 4 retries (up to 5 total attempts across both models)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const route = routes[attempt % routes.length];
    try {
      const response = await runWithAbortTimeout(route.timeoutMs, async (controller) => {
        const config = route.useCompactLiteParams
          ? {
              systemInstruction,
              temperature: 0.55,
              maxOutputTokens: 700,
              abortSignal: controller.signal,
            }
          : {
              systemInstruction,
              temperature: 0.65,
              maxOutputTokens: 1024,
              abortSignal: controller.signal,
            };

        return ai.models.generateContent({
          model: route.model,
          contents: normalizedTurns,
          config,
        });
      });

      const text = response.text?.trim();
      if (!text) {
        throw new Error('Empty model response.');
      }

      modelCooldownUntil.delete(route.model);
      responseCache.set(cacheKey, { answer: text, cachedAt: Date.now() });
      if (responseCache.size > 100) {
        const oldest = responseCache.keys().next().value;
        if (oldest) responseCache.delete(oldest);
      }
      sendJson(res, 200, { answer: text });
      return;
    } catch (error) {
      lastError = error;
      recordRateLimit(route.model, error);
      if (isAuthError(error) || attempt >= 4) {
        break;
      }
      const nextRoute = routes[(attempt + 1) % routes.length];
      const switchingModel = nextRoute.model !== route.model;
      if (!isTransientError(error) && !switchingModel) {
        break;
      }

      if (!(attempt === 0 && switchingModel)) {
        const expDelay = Math.min(3200, 450 * Math.pow(2, backoffRound));
        const jitter = Math.floor(Math.random() * Math.max(1, Math.round(expDelay * 0.25)));
        const delayMs = expDelay + jitter;
        backoffRound += 1;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  const rawMessage =
    lastError instanceof Error ? lastError.message : 'Unable to reach Gemini API right now.';
  sendJson(res, isTransientError(lastError) ? 503 : 502, {
    error: formatError(rawMessage),
  });
}
