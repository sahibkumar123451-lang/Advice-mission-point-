import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI } from '@google/genai';

const MODELS = [
  {
    model: 'gemini-2.5-flash-lite',
    useCompactLiteParams: true,
  },
  {
    model: 'gemini-2.5-flash',
    useCompactLiteParams: false,
  },
] as const;

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    res.end();
    return;
  }

  const rawKey = process.env.GEMINI_API_KEY?.trim() || '';
  const configured = Boolean(rawKey && rawKey !== 'MY_GEMINI_API_KEY');
  if (!configured) {
    sendJson(res, 503, {
      configured: false,
      assistant: 'Mission AI',
      website: 'Advice Coaching Classes',
      owner: 'Surendra Sir',
      error: 'GEMINI_API_KEY is not configured in Vercel Environment Variables.',
    });
    return;
  }

  const reqUrl = new URL(req.url || '/', 'http://localhost');
  if (reqUrl.searchParams.get('probe') !== '1') {
    sendJson(res, 200, {
      configured: true,
      assistant: 'Mission AI',
      website: 'Advice Coaching Classes',
      owner: 'Surendra Sir',
      models: MODELS.map((m) => m.model),
    });
    return;
  }

  const ai = new GoogleGenAI({
    apiKey: rawKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const probeResults: Array<{
    model: string;
    ok: boolean;
    elapsedMs: number;
    preview?: string;
    error?: string;
  }> = [];

  for (const route of MODELS) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const config = {
        systemInstruction:
          'You are Mission AI, assistant of Advice Coaching Classes owned by Surendra Sir.',
        temperature: route.useCompactLiteParams ? 0.55 : 0.65,
        maxOutputTokens: route.useCompactLiteParams ? 128 : 256,
        abortSignal: controller.signal,
      };

      const result = await ai.models.generateContent({
        model: route.model,
        contents: 'Who is the owner of Advice Coaching Classes? Reply in 1 short sentence.',
        config,
      });

      probeResults.push({
        model: route.model,
        ok: Boolean(result.text?.trim()),
        elapsedMs: Date.now() - started,
        preview: result.text?.trim().slice(0, 140),
      });
    } catch (err) {
      probeResults.push({
        model: route.model,
        ok: false,
        elapsedMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  const anyOk = probeResults.some((r) => r.ok);
  sendJson(res, anyOk ? 200 : 503, {
    configured: true,
    liveConnected: anyOk,
    assistant: 'Mission AI',
    probeResults,
  });
}
