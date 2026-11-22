import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  MISSION_AI_ROUTES,
  sendJson,
  setCorsHeaders,
} from '../_lib/missionAi';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const rawKey = process.env.GEMINI_API_KEY?.trim() || '';
  const configured = Boolean(rawKey && rawKey !== 'MY_GEMINI_API_KEY');
  sendJson(res, configured ? 200 : 503, {
    configured,
    assistant: 'Mission AI',
    website: 'Advice Mission Point',
    owner: 'Surendra Sir',
    models: MISSION_AI_ROUTES.map((r) => r.model),
  });
}
