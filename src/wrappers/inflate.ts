import { gunzipSync } from 'zlib';

export function base64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, 'base64');
}

export function gunzipToBuffer(b64gz: string): Buffer {
  const src = base64ToBuffer(b64gz);
  return gunzipSync(src);
}

export function gunzipToString(b64gz: string): string {
  const buf = gunzipToBuffer(b64gz);
  return buf.toString('utf8');
}

export function gunzipToJson<T = unknown>(b64gz: string): T {
  const s = gunzipToString(b64gz);
  return JSON.parse(s) as T;
}

export function gunzipNdjson<T = unknown>(b64gz: string): T[] {
  const s = gunzipToString(b64gz);
  return s
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}
