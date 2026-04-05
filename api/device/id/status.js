// api/device/[id]/status.js
import { tuyaRequest } from '../../_tuya.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const result = await tuyaRequest('GET', `/v1.0/devices/${req.query.id}/status`);
    res.setHeader('Cache-Control', 'no-store');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
