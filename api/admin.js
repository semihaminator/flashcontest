import { load, save, sanitize, checkPassword, hasDatabase } from './_lib/store.js';

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: 'ADMIN_PASSWORD is not set in Vercel environment variables.' });
  if (!checkPassword(req)) return res.status(401).json({ error: 'Wrong password' });
  try {
    if (req.method === 'GET') return res.status(200).json({ ...(await load()), database: hasDatabase() });
    if (req.method === 'PUT') {
      const data = sanitize(await readBody(req));
      await save(data);
      return res.status(200).json({ ok: true, updatedAt: data.updatedAt, count: data.agencies.length });
    }
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
