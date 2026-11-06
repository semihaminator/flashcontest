import { load, leaderboard, RULES } from './_lib/store.js';

export default async function handler(req, res) {
  try {
    const data = await load();
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json({ rules: RULES, updatedAt: data.updatedAt, rows: leaderboard(data) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
