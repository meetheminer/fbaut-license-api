// vercel-api/api/use.js
// เรียกก่อนรัน task ทุกครั้ง — เช็ค daily limit แล้วบันทึก usage
// POST { key, device_id, task_name }
// Response: { ok: true } หรือ { ok: false, error: "...", used: N, limit: N }

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { key, device_id, task_name = '' } = req.body || {};
  if (!key || !device_id) return res.status(400).json({ ok: false, error: 'Missing key or device_id' });

  // หา license
  const { data: license, error: licErr } = await supabase
    .from('licenses')
    .select('id, is_active, expires_at, daily_limit')
    .eq('key', key.toUpperCase().trim())
    .single();

  if (licErr || !license) return res.status(200).json({ ok: false, error: 'Invalid license key' });
  if (!license.is_active) return res.status(200).json({ ok: false, error: 'License has been revoked' });
  if (license.expires_at && new Date(license.expires_at) < new Date()) return res.status(200).json({ ok: false, error: 'License expired' });

  // นับ usage วันนี้ (นับรวมทุก device ของ license นี้)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('usage_logs')
    .select('id', { count: 'exact', head: true })
    .eq('license_id', license.id)
    .gte('used_at', startOfDay.toISOString());

  const limit = license.daily_limit ?? 10;

  if (count >= limit) {
    return res.status(200).json({
      ok: false,
      error: `ถึงขีดจำกัดวันนี้แล้ว (${count}/${limit} tasks) รีเซ็ตใหม่เที่ยงคืน`,
      used: count,
      limit
    });
  }

  // บันทึก usage
  await supabase.from('usage_logs').insert({
    license_id: license.id,
    device_id,
    task_name
  });

  return res.status(200).json({ ok: true, used: count + 1, limit });
}
