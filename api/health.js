// api/health.js
export default function handler(req, res) {
  res.json({
    status: 'ok',
    region: process.env.TUYA_REGION || 'eu',
    ts:     new Date().toISOString(),
  });
}
