// vercel-api/api/quota.js
// GET quota ของวันนี้
// POST { key, device_id }
// Response: { ok: true, used: N, limit: N }

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const { key } = req.body || {};
  if (!key) return res.status(400).json({ ok: false });

  const { data: license } = await supabase
    .from('licenses')
    .select('id, daily_limit, is_active, expires_at')
    .eq('key', key.toUpperCase().trim())
    .single();

  if (!license || !license.is_active) return res.status(200).json({ ok: false });
  if (license.expires_at && new Date(license.expires_at) < new Date()) return res.status(200).json({ ok: false });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('usage_logs')
    .select('id', { count: 'exact', head: true })
    .eq('license_id', license.id)
    .gte('used_at', startOfDay.toISOString());

  return res.status(200).json({ ok: true, used: count, limit: license.daily_limit ?? 10 });
}
