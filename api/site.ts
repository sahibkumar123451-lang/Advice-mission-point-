import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson, setCorsHeaders } from './_lib/geminiAi';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // On Vercel static+serverless deployments, live public content is synced via Firebase Firestore;
  // returning an empty non-error payload prevents a 404 console error before Firestore loads.
  sendJson(res, 200, { ok: true, source: 'serverless' });
}
