import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export interface AiChatInputMessage {
  role?: string;
  text?: string;
}

export interface AiTurn {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface MultiModelRouteSpec {
  model: string;
  label: string;
  thinkingLevel: 'LOW' | 'MINIMAL';
  useCompactLiteParams: boolean;
  timeoutMs: number;
}

export const MISSION_AI_ROUTES: MultiModelRouteSpec[] = [
  {
    model: 'gemini-3.1-flash-lite',
    label: 'Primary Flash Lite',
    thinkingLevel: 'MINIMAL',
    useCompactLiteParams: true,
    timeoutMs: 12000,
  },
  {
    model: 'gemini-4-hydrogen',
    label: 'Secondary Flash',
    thinkingLevel: 'LOW',
    useCompactLiteParams: false,
    timeoutMs: 15000,
  },
];

let stickyHealthyModel: string | null = null;
let stickyHealthyUpdatedAt = 0;
const STICKY_HEALTH_TTL_MS = 60_000;

export function getOrderedMissionAiRoutes(): MultiModelRouteSpec[] {
  if (
    stickyHealthyModel &&
    Date.now() - stickyHealthyUpdatedAt < STICKY_HEALTH_TTL_MS
  ) {
    const preferred = MISSION_AI_ROUTES.find((r) => r.model === stickyHealthyModel);
    if (preferred) {
      return [preferred, ...MISSION_AI_ROUTES.filter((r) => r.model !== stickyHealthyModel)];
    }
  }
  return MISSION_AI_ROUTES;
}

export function recordHealthyMissionAiModel(model: string): void {
  stickyHealthyModel = model;
  stickyHealthyUpdatedAt = Date.now();
}

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function normalizeAiConversationHistory(
  messages: AiChatInputMessage[],
): AiTurn[] {
  const cleaned = messages
    .map((m) => ({
      role: (m.role === 'assistant' || m.role === 'model' ? 'model' : 'user') as
        | 'user'
        | 'model',
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

export function buildMissionAiPromptContext(
  messages: AiChatInputMessage[] | undefined,
  languagePreference?: 'bilingual' | 'english' | 'hindi',
):
  | { error: string }
  | { normalizedTurns: AiTurn[]; systemInstruction: string } {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { error: 'Please enter a question or doubt first.' };
  }
  const latest = messages[messages.length - 1];
  if (!latest?.text?.trim()) {
    return { error: 'Question cannot be empty.' };
  }
  const normalizedTurns = normalizeAiConversationHistory(messages);
  if (normalizedTurns.length === 0) {
    return { error: 'Please enter a valid question or doubt first.' };
  }

  const langDirective =
    languagePreference === 'hindi'
      ? 'Respond primarily in simple, clear Hindi (Devanagari) with key technical terms in English brackets.'
      : languagePreference === 'english'
        ? 'Respond in simple, clear student-friendly English, adding brief Hindi meaning for difficult terms when helpful.'
        : 'Respond in clear, simple bilingual Hindi and English (easy-to-read English paired with simple Hindi explanation, or Hinglish/Devanagari where natural) so school students from Class 1 to 12 understand effortlessly.';

  const systemInstruction = `You are "Mission AI", the official AI learning assistant for the coaching website "Advice Mission Point".

Official Website Knowledge Base (Always use these exact facts when asked about the coaching centre, owner, founder, timings, or assistant):
- Website / Institute Name: Advice Mission Point
- Tagline: "To Struggle, Take Success."
- Owner / Founder & Lead Educator: Surendra Sir
- Assistant Name: Mission AI
- Location / Address: Ramauli, Darbhanga, Bihar, India 847101
- Classes Covered: Class 1 to Class 12
- Class & Office Hours: Mon – Sat · 6:30 AM – 6:30 PM
- Subjects Taught: Mathematics, Science (Physics, Chemistry, Biology), English Grammar & Literature, Social Studies & General Foundation

Rules:
- If the user asks who you are, introduce yourself as "Mission AI", the official AI assistant of Advice Mission Point (founded/owned by Surendra Sir).
- If the user asks who owns Advice Mission Point or who founded it, state clearly that **Surendra Sir** is the Owner / Founder & Lead Educator of Advice Mission Point.
- Never ask the student to select a class or subject before answering. Answer any academic doubt or institute question directly and warmly.
- ${langDirective}
- For study/academic doubts, keep answers fast, crisp, and focused (around 80-160 words unless solving a multi-step numerical) using plain Unicode math symbols (×, ÷, ², √) instead of LaTeX $ dollar signs:
  1. **Short Answer (संक्षिप्त उत्तर):** 1–2 crisp sentences giving the direct answer.
  2. **Simple Explanation (सरल व्याख्या):** Clear step-by-step concept explanation using everyday examples.
  3. **Key Takeaway / Formula (मुख्य बिंदु):** A quick memory tip, formula, or practice hint when relevant.`;

  return { normalizedTurns, systemInstruction };
}

export function buildGeminiConfig(
  route: MultiModelRouteSpec,
  systemInstruction: string,
  abortSignal?: AbortSignal,
) {
  const level =
    route.thinkingLevel === 'MINIMAL' ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
  if (route.useCompactLiteParams) {
    return {
      systemInstruction,
      thinkingConfig: { thinkingLevel: level },
      temperature: 0.5,
      maxOutputTokens: 512,
      abortSignal,
    };
  }
  return {
    systemInstruction,
    thinkingConfig: { thinkingLevel: level },
    abortSignal,
  };
}

export function isGeminiKeyAuthError(error: unknown): boolean {
  const raw =
    error instanceof Error
      ? `${(error as { status?: unknown; code?: unknown }).status ?? ''} ${error.message}`
      : typeof error === 'object' && error !== null
        ? JSON.stringify(error)
        : String(error ?? '');
  const lower = raw.toLowerCase();
  return (
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('access_token_scope_insufficient') ||
    /\b403\b/.test(lower)
  );
}

export function isTransientGeminiApiError(error: unknown): boolean {
  const raw =
    error instanceof Error
      ? `${(error as { status?: unknown; code?: unknown }).status ?? ''} ${(error as { code?: unknown }).code ?? ''} ${error.message}`
      : typeof error === 'object' && error !== null
        ? JSON.stringify(error)
        : String(error ?? '');
  const lower = raw.toLowerCase();
  if (!lower.trim()) return false;

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('403') ||
    lower.includes('invalid_argument') ||
    lower.includes('not_found') ||
    lower.includes('404') ||
    /\b400\b/.test(lower)
  ) {
    return false;
  }

  return (
    lower.includes('503') ||
    lower.includes('429') ||
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('504') ||
    lower.includes('unavailable') ||
    lower.includes('service unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('resource_exhausted') ||
    lower.includes('too many requests') ||
    lower.includes('rate limit') ||
    lower.includes('quota') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('deadline_exceeded') ||
    lower.includes('abort') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('fetch') ||
    lower.includes('network') ||
    lower.includes('empty model response')
  );
}

export function formatFriendlyAiError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase();
  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403')) {
    return 'Gemini API key needs attention in hosting Environment Variables (GEMINI_API_KEY) before Mission AI can answer.';
  }
  if (
    lower.includes('resource_exhausted') ||
    lower.includes('429') ||
    lower.includes('too many requests') ||
    lower.includes('rate limit') ||
    lower.includes('quota')
  ) {
    return 'Too many questions arrived at once — wait a couple of seconds and click Ask Again. Your question is saved right here (एक साथ कई प्रश्न आए हैं, कृपया कुछ सेकंड बाद Ask Again दबाएं).';
  }
  if (
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded')
  ) {
    return 'The AI service experienced heavy traffic across backup models. Your question is saved — click Ask Again to send it once more (उच्च ट्रैफ़िक के कारण उत्तर नहीं मिल सका, कृपया Ask Again दबाएं).';
  }
  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('deadline_exceeded') ||
    lower.includes('504') ||
    lower.includes('fetch') ||
    lower.includes('network')
  ) {
    return 'The reply took longer than expected due to a brief connection delay. Your question is saved — click Ask Again to continue (कनेक्शन में देरी हुई, कृपया Ask Again दबाएं).';
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return 'The requested AI model or endpoint is currently unavailable. Click Ask Again in a moment.';
  }
  return 'Could not finish this answer right now. Your question is saved right here — click Ask Again to continue.';
}

export async function runWithAbortTimeout<T>(
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

export async function executeMultiModelWithFallback<T>(
  runner: (route: MultiModelRouteSpec, attemptIndex: number) => Promise<T>,
  options: {
    routes: MultiModelRouteSpec[];
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldAbort?: () => boolean;
    onStatus?: (info: {
      attempt: number;
      route: MultiModelRouteSpec;
      reason: 'failover' | 'backoff';
      delayMs: number;
    }) => void;
  },
): Promise<{ result: T; route: MultiModelRouteSpec; attempt: number }> {
  const {
    routes,
    maxAttempts = 4,
    baseDelayMs = 450,
    maxDelayMs = 2200,
    shouldAbort,
    onStatus,
  } = options;

  let lastError: unknown;
  let backoffRound = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (shouldAbort?.()) {
      throw lastError ?? new Error('Request cancelled.');
    }

    const route = routes[attempt % routes.length];
    try {
      const result = await runner(route, attempt);
      return { result, route, attempt };
    } catch (error) {
      lastError = error;

      if (shouldAbort?.() || isGeminiKeyAuthError(error)) {
        throw error;
      }

      if (attempt >= maxAttempts - 1) {
        throw error;
      }

      const nextRoute = routes[(attempt + 1) % routes.length];
      const switchingModel = nextRoute.model !== route.model;
      if (!isTransientGeminiApiError(error) && !switchingModel) {
        throw error;
      }

      let delayMs = 0;
      let reason: 'failover' | 'backoff' = 'failover';
      if (attempt === 0 && switchingModel) {
        delayMs = 0;
        reason = 'failover';
      } else {
        const expDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, backoffRound));
        const jitter = Math.min(200, Math.round(expDelay * 0.2));
        delayMs = expDelay + Math.floor(Math.random() * jitter);
        backoffRound += 1;
        reason = 'backoff';
      }

      onStatus?.({ attempt: attempt + 1, route: nextRoute, reason, delayMs });
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

export function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export async function readJsonBody<T = Record<string, unknown>>(
  req: IncomingMessage & { body?: unknown },
): Promise<T> {
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

export function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  setCorsHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
