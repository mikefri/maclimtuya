// api/device/[id].js
import { tuyaRequest } from '../_tuya.js';

const ALLOWED_CODES = new Set([
  'Power', 'temp_set', 'mode', 'windspeed',
  'windshake', 'horizontal', 'vertical',
  'sleep', 'mode_ECO', 'health', 'light', 'swing3d',
]);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const id = req.query.id;

  if (req.method === 'GET') {
    try {
      if (req.query.action === 'functions') {
        const [functions, status] = await Promise.all([
          tuyaRequest('GET', `/v1.0/devices/${id}/functions`),
          tuyaRequest('GET', `/v1.0/devices/${id}/status`),
        ]);
        return res.json({ functions, status });
      }
      const result = await tuyaRequest('GET', `/v1.0/devices/${id}/status`);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { code, value } = req.body || {};
    if (!code || value === undefined)
      return res.status(400).json({ error: 'code et value sont requis' });
    if (!ALLOWED_CODES.has(code))
      return res.status(400).json({ error: `Code non autorisé : ${code}` });

    // temp_set : Tuya stocke en dixièmes (22°C → 220)
    const tuyaValue = code === 'temp_set' ? Math.round(value * 10) : value;
    try {
      const result = await tuyaRequest(
        'POST', `/v1.0/devices/${id}/commands`,
        { commands: [{ code, value: tuyaValue }] }
      );
      return res.json({ success: true, result });
    } catch (err) {
      return res.status(500).json({ error: err.message, code, value: tuyaValue });
    }
  }

  res.status(405).end();
}
