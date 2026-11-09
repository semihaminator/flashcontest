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

// Older saves stored a list of streamers; convert them to the aggregate numbers.
function aggregate(a) {
  if (Array.isArray(a.streamers)) {
    return {
      streamers: a.streamers.length,
      total: a.streamers.reduce((s, x) => s + int(x.coins), 0),
      active: a.streamers.filter((x) => int(x.coins) >= RULES.activeThreshold).length,
    };
  }
  return { streamers: int(a.streamers), total: int(a.total), active: int(a.active) };
}

const iso = (v) => { const d = new Date(v || ''); return v && !isNaN(d) ? d.toISOString() : ''; };

export function sanitize(input) {
  const agencies = Array.isArray(input?.agencies) ? input.agencies : [];
  return {
    agencies: agencies.slice(0, 1000).map((a) => {
      const n = aggregate(a);
      return {
        name: str(a.name || a.id, 80),
        hidden: Boolean(a.hidden),
        streamers: n.streamers,
        total: n.total,
        active: Math.min(n.active, n.streamers),
        lastInvite: iso(a.lastInvite),
      };
    }).filter((a) => a.name),
    updatedAt: new Date().toISOString(),
  };
}

export function stats(a) {
  const { streamers, total, active } = aggregate(a);
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
    .map((a) => ({ name: a.name || a.id || '', lastInvite: a.lastInvite || '', ...stats(a) }))
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
