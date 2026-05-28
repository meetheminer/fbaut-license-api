// vercel-api/api/validate.js
// ตั้ง Environment Variables ใน Vercel:
//   SUPABASE_URL         = https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY = eyJ... (service_role key)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { key, device_id } = req.body || {};
  if (!key || !device_id) return res.status(400).json({ ok: false, error: 'Missing key or device_id' });

  const { data: license, error: licErr } = await supabase
    .from('licenses')
    .select('id, is_active, max_devices, expires_at')
    .eq('key', key.toUpperCase().trim())
    .single();

  if (licErr || !license) return res.status(200).json({ ok: false, error: 'Invalid license key' });
  if (!license.is_active) return res.status(200).json({ ok: false, error: 'License has been revoked' });
  if (license.expires_at && new Date(license.expires_at) < new Date()) return res.status(200).json({ ok: false, error: 'License expired' });

  const { data: existing } = await supabase.from('activations').select('id').eq('license_id', license.id).eq('device_id', device_id).single();

  if (existing) {
    await supabase.from('activations').update({ last_seen: new Date().toISOString() }).eq('id', existing.id);
    return res.status(200).json({ ok: true });
  }

  const { count } = await supabase.from('activations').select('id', { count: 'exact', head: true }).eq('license_id', license.id);
  if (count >= license.max_devices) return res.status(200).json({ ok: false, error: `License already used on ${license.max_devices} device(s). Contact support to transfer.` });

  await supabase.from('activations').insert({ license_id: license.id, device_id });
  return res.status(200).json({ ok: true });
}
