// api/device/[id]/command.js
import { tuyaRequest } from '../../_tuya.js';

// Codes Tuya reconnus pour les climatiseurs Airton
const ALLOWED_CODES = new Set([
  'switch', 'temp_set', 'mode', 'fan_speed_enum',
  'swing_vertical', 'swing_horizontal', 'sleep', 'eco',
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { code, value } = req.body || {};
  if (!code || value === undefined)
    return res.status(400).json({ error: 'code et value sont requis' });
  if (!ALLOWED_CODES.has(code))
    return res.status(400).json({ error: `Code non autorisé : ${code}` });

  // temp_set : Tuya attend la valeur en dixièmes de degré (22°C → 220)
  const tuyaValue = code === 'temp_set' ? Math.round(value * 10) : value;

  try {
    const result = await tuyaRequest(
      'POST',
      `/v1.0/devices/${req.query.id}/commands`,
      { commands: [{ code, value: tuyaValue }] }
    );
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
