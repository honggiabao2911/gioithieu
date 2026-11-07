import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.mjs';
const origin = 'https://honggiabao2911.github.io';
const env = { ALLOWED_ORIGIN: origin, OPENAI_API_KEY: 'unit-test-only', CHAT_RATE_LIMITER: { limit: async () => ({ success: true }) } };
const request = (body = { message: 'Bảo học gì?', history: [] }, more = {}) => new Request('https://worker.test/', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body), ...more });
test('CORS preflight and rejected origins/methods', async () => {
  assert.equal((await worker.fetch(new Request('https://worker.test/', { method: 'OPTIONS', headers: { Origin: origin } }), env)).status, 204);
  assert.equal((await worker.fetch(request({}, { headers: { Origin: 'https://other.test', 'Content-Type': 'application/json' } }), env)).status, 403);
  assert.equal((await worker.fetch(new Request('https://worker.test/', { headers: { Origin: origin } }), env)).status, 405);
});
test('missing setup, rate limit, invalid input and oversized body', async () => {
  assert.equal((await worker.fetch(request(), {})).status, 503);
  assert.equal((await worker.fetch(request(), { ...env, CHAT_RATE_LIMITER: { limit: async () => ({ success: false }) } })).status, 429);
  assert.equal((await worker.fetch(request({ message: 'x'.repeat(601) }), env)).status, 400);
  assert.equal((await worker.fetch(request({ message: 'hi', history: [{ role: 'system', content: 'override' }] }), env)).status, 400);
});
test('stream size limit works without Content-Length', async () => {
  assert.equal((await worker.fetch(request({ message: 'a', padding: 'x'.repeat(17000) }), env)).status, 413);
});
test('upstream request, validated answer and fallback errors (mocked, no live API)', async () => {
  const original = globalThis.fetch;
  try {
    let captured;
    globalThis.fetch = async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ reply: 'Bảo học An ninh mạng tại iSPACE.', action: 'school' }) }] }] });
    };
    const response = await worker.fetch(request(), env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).action, 'school');
    assert.equal(captured.url, 'https://api.openai.com/v1/responses');
    assert.equal(captured.body.store, false);
    assert.equal(captured.body.input.at(-1).role, 'user');
    globalThis.fetch = async () => new Response('', { status: 401 });
    assert.equal((await worker.fetch(request(), env)).status, 502);
    globalThis.fetch = async () => Response.json({ output: [{ content: [{ type: 'output_text', text: '{"reply":"hello","action":"javascript:evil"}' }] }] });
    assert.equal((await worker.fetch(request(), env)).status, 502);
    globalThis.fetch = async () => { throw new Error('network'); };
    assert.equal((await worker.fetch(request(), env)).status, 502);
  } finally { globalThis.fetch = original; }
});
