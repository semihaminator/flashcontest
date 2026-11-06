// Storage: Upstash Redis (via Vercel Marketplace) in production, a local JSON file in development.
import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';

const KEY = 'salsa-flash:data';
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const LOCAL_FILE = process.env.LOCAL_DATA_FILE || '.data.json';

const EMPTY = { agencies: [], updatedAt: null };

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`Redis ${r.status}`);
  return (await r.json()).result;
}

export const hasDatabase = () => Boolean(URL_ && TOKEN);

export async function load() {
  try {
    if (hasDatabase()) {
      const raw = await redis(['GET', KEY]);
      return raw ? JSON.parse(raw) : structuredClone(EMPTY);
    }
    return JSON.parse(await fs.readFile(LOCAL_FILE, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return structuredClone(EMPTY);
    throw e;
  }
}

export async function save(data) {
  const json = JSON.stringify(data);
  if (hasDatabase()) await redis(['SET', KEY, json]);
  else if (process.env.VERCEL) throw new Error('No database connected. Add Upstash Redis in Vercel → Storage.');
  else await fs.writeFile(LOCAL_FILE, json);
}

// ---------- contest rules ----------
export const RULES = { minStreamers: 10, minTotal: 500000, minActive: 6, activeThreshold: 9750 };

const int = (v) => {
  const n = Math.round(Number(String(v ?? '').replace(/[\s,]/g, '')));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const str = (v, max = 80) => String(v ?? '').trim().slice(0, max);

export function sanitize(input) {
  const agencies = Array.isArray(input?.agencies) ? input.agencies : [];
  return {
    agencies: agencies.slice(0, 500).map((a) => ({
      id: str(a.id, 40),
      name: str(a.name, 80),
      hidden: Boolean(a.hidden),
      streamers: (Array.isArray(a.streamers) ? a.streamers : []).slice(0, 2000).map((s) => ({
        id: str(s.id, 60),
        coins: int(s.coins),
      })).filter((s) => s.id || s.coins),
    })).filter((a) => a.id || a.name),
    updatedAt: new Date().toISOString(),
  };
}

export function stats(a) {
  const streamers = a.streamers.length;
  const total = a.streamers.reduce((s, x) => s + x.coins, 0);
  const active = a.streamers.filter((x) => x.coins >= RULES.activeThreshold).length;
  const checks = {
    streamers: streamers >= RULES.minStreamers,
    total: total >= RULES.minTotal,
    active: active >= RULES.minActive,
  };
  return { streamers, total, active, checks, qualified: checks.streamers && checks.total && checks.active };
}

// Qualified agencies first, then everyone else; both groups ordered by total streamer earnings.
export function leaderboard(data) {
  const rows = data.agencies
    .filter((a) => !a.hidden)
    .map((a) => ({ id: a.id, name: a.name, ...stats(a) }))
    .sort((x, y) => (y.qualified - x.qualified) || (y.total - x.total) || (y.active - x.active));
  let place = 0;
  for (const r of rows) r.place = r.qualified ? ++place : null;
  return rows;
}

export function checkPassword(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const given = String(req.headers['x-admin-password'] || '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}
