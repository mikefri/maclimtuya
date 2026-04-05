// api/device/[id].js
// GET  /api/device/:id        → statut de l'appareil
// POST /api/device/:id        → envoyer une commande
import { tuyaRequest } from '../_tuya.js';

const ALLOWED_CODES = new Set([
  'switch', 'temp_set', 'mode', 'fan_speed_enum',
  'swing_vertical', 'swing_horizontal', 'sleep', 'eco',
]);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const id = req.query.id;

  // ── GET : statut ──────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const result = await tuyaRequest('GET', `/v1.0/devices/${id}/status`);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST : commande ───────────────────────────────────────
  if (req.method === 'POST') {
    const { code, value } = req.body || {};
    if (!code || value === undefined)
      return res.status(400).json({ error: 'code et value sont requis' });
    if (!ALLOWED_CODES.has(code))
      return res.status(400).json({ error: `Code non autorisé : ${code}` });

    const tuyaValue = code === 'temp_set' ? Math.round(value * 10) : value;
    try {
      const result = await tuyaRequest(
        'POST',
        `/v1.0/devices/${id}/commands`,
        { commands: [{ code, value: tuyaValue }] }
      );
      return res.json({ success: true, result });
    } catch (err) {
      console.error(`[command] code=${code} value=${JSON.stringify(tuyaValue)} error=${err.message}`);
      return res.status(500).json({ error: err.message, code, value: tuyaValue });
    }
  }

  res.status(405).end();
}
