import { describe, it, expect } from 'vitest';
import { gunzipNdjson, gunzipToJson, gunzipToString } from '../../src/wrappers/inflate';
import { gzipSync } from 'zlib';

describe('inflate helpers', () => {
  it('gunzipToString should decode base64 gzip', () => {
    const s = 'hello world';
    const gz = gzipSync(Buffer.from(s, 'utf8')).toString('base64');
    expect(gunzipToString(gz)).toBe(s);
  });

  it('gunzipToJson should decode JSON payload', () => {
    const obj = { a: 1, b: 'x' };
    const gz = gzipSync(Buffer.from(JSON.stringify(obj), 'utf8')).toString('base64');
    expect(gunzipToJson<typeof obj>(gz)).toEqual(obj);
  });

  it('gunzipNdjson should decode rows', () => {
    const rows = [{ id: 1 }, { id: 2 }];
    const ndjson = rows.map((r) => JSON.stringify(r)).join('\n');
    const gz = gzipSync(Buffer.from(ndjson, 'utf8')).toString('base64');
    expect(gunzipNdjson(gz)).toEqual(rows);
  });
});

