// vercel-api/api/admin/generate.js
// POST /api/admin/generate — ออก license key ให้ลูกค้า
// Header: x-admin-secret: YOUR_ADMIN_SECRET

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function generateKey() {
  const part = () => randomBytes(2).toString('hex').toUpperCase();
  return `FBAUT-${part()}-${part()}-${part()}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { label = '', max_devices = 1, expires_days = null } = req.body || {};
  const key = generateKey();
  const expires_at = expires_days ? new Date(Date.now() + expires_days * 86400000).toISOString() : null;

  const { data, error } = await supabase.from('licenses').insert({ key, label, max_devices, expires_at }).select().single();
  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true, key: data.key, id: data.id });
}
