// api/_tuya.js  — utilitaire partagé (non exposé comme route Vercel)
import crypto from 'crypto';

const ACCESS_ID     = process.env.TUYA_ACCESS_ID;
const ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET;
const REGION        = process.env.TUYA_REGION || 'eu';

const BASE_URLS = {
  eu: 'https://openapi.tuyaeu.com',
  us: 'https://openapi.tuyaus.com',
  cn: 'https://openapi.tuyacn.com',
  in: 'https://openapi.tuyain.com',
};
export const BASE_URL = BASE_URLS[REGION] || BASE_URLS.eu;

// ── Token cache (réutilisé entre les appels chauds de la même instance) ──
let _tokenCache = null;

export async function getToken() {
  if (_tokenCache && _tokenCache.expireAt > Date.now()) return _tokenCache.token;

  const path = '/v1.0/token?grant_type=1';
  const ts   = Date.now().toString();
  const hdrs = sign('GET', path, '', ts, '');

  const res  = await fetch(`${BASE_URL}${path}`, { headers: hdrs });
  const data = await res.json();
  if (!data.success) throw new Error(`Token error: ${data.msg}`);

  _tokenCache = {
    token:    data.result.access_token,
    expireAt: Date.now() + (data.result.expire_time - 60) * 1000,
  };
  return _tokenCache.token;
}

export async function tuyaRequest(method, path, body = null) {
  const token   = await getToken();
  const ts      = Date.now().toString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const hdrs    = sign(method, path, bodyStr, ts, token);

  const res  = await fetch(`${BASE_URL}${path}`, {
    method, headers: hdrs,
    ...(body ? { body: bodyStr } : {}),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.msg || JSON.stringify(data));
  return data.result;
}

function sign(method, path, body, ts, token) {
  const hash = crypto.createHash('sha256').update(body).digest('hex');
  const str  = [method, hash, '', path].join('\n');
  const raw  = ACCESS_ID + token + ts + str;
  const sig  = crypto.createHmac('sha256', ACCESS_SECRET)
                     .update(raw).digest('hex').toUpperCase();
  return {
    'client_id':    ACCESS_ID,
    'access_token': token,
    'sign':         sig,
    'sign_method':  'HMAC-SHA256',
    't':            ts,
    'Content-Type': 'application/json',
  };
}
