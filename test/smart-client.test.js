'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/smart-client.js');

const base = { key: 'sk-test-KEY', system: 'SYS', user: 'USER' };

test('anthropic request has the right url, headers and body', () => {
  const r = C.buildRequest(Object.assign({ provider: 'anthropic' }, base));
  assert.equal(r.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(r.init.headers['x-api-key'], 'sk-test-KEY');
  assert.equal(r.init.headers['anthropic-version'], '2023-06-01');
  assert.equal(r.init.headers['anthropic-dangerous-direct-browser-access'], 'true');
  const body = JSON.parse(r.init.body);
  assert.equal(body.model, C.DEFAULT_MODELS.anthropic);
  assert.equal(body.system, 'SYS');
  assert.deepEqual(body.messages, [{ role: 'user', content: 'USER' }]);
  assert.equal(body.temperature, 0);
});

test('openai request has the right url, auth and messages', () => {
  const r = C.buildRequest(Object.assign({ provider: 'openai', model: 'gpt-x' }, base));
  assert.equal(r.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(r.init.headers.authorization, 'Bearer sk-test-KEY');
  const body = JSON.parse(r.init.body);
  assert.equal(body.model, 'gpt-x');
  assert.deepEqual(body.messages.map((m) => m.role), ['system', 'user']);
});

test('xai (Grok) request uses the xAI endpoint with the OpenAI-style body', () => {
  const r = C.buildRequest(Object.assign({ provider: 'xai' }, base));
  assert.equal(r.url, 'https://api.x.ai/v1/chat/completions');
  assert.equal(r.init.headers.authorization, 'Bearer sk-test-KEY');
  const body = JSON.parse(r.init.body);
  assert.equal(body.model, C.DEFAULT_MODELS.xai);
  assert.equal(body.model, 'grok-4.7');
  assert.deepEqual(body.messages.map((m) => m.role), ['system', 'user']);
  assert.equal(body.messages[0].content, 'SYS');
  assert.equal(body.temperature, 0);
});

test('OpenAI-style providers leave room for reasoning tokens', () => {
  for (const provider of ['openai', 'xai', 'groq']) {
    const body = JSON.parse(C.buildRequest(Object.assign({ provider }, base)).init.body);
    assert.ok(body.max_completion_tokens >= 1000, provider);
    assert.equal(body.max_tokens, undefined, provider);
  }
});

test('xai responses are parsed like OpenAI responses', () => {
  assert.equal(C.parseResponse('xai', { choices: [{ message: { content: '<fixed>x</fixed>' } }] }), '<fixed>x</fixed>');
  assert.equal(C.parseResponse('xai', { choices: [] }), null);
});

test('every listed provider can build a request and has a default model', () => {
  assert.deepEqual(C.PROVIDERS.slice().sort(), ['anthropic', 'groq', 'openai', 'xai']);
  for (const provider of C.PROVIDERS) {
    assert.ok(C.DEFAULT_MODELS[provider], provider);
    assert.doesNotThrow(() => C.buildRequest(Object.assign({ provider }, base)), provider);
  }
});

test('maxTokens raises the output limit for longer rewrites on every provider', () => {
  const anthropic = JSON.parse(C.buildRequest(Object.assign({ provider: 'anthropic', maxTokens: 3000 }, base)).init.body);
  assert.equal(anthropic.max_tokens, 3000);
  for (const provider of ['openai', 'xai', 'groq']) {
    const body = JSON.parse(C.buildRequest(Object.assign({ provider, maxTokens: 4000 }, base)).init.body);
    assert.equal(body.max_completion_tokens, 4000, provider);
  }
  // defaults are unchanged when it is not given
  assert.equal(JSON.parse(C.buildRequest(Object.assign({ provider: 'anthropic' }, base)).init.body).max_tokens, 600);
});

test('groq request uses the GroqCloud endpoint and its default model', () => {
  const r = C.buildRequest(Object.assign({ provider: 'groq' }, base));
  assert.equal(r.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(r.init.headers.authorization, 'Bearer sk-test-KEY');
  const body = JSON.parse(r.init.body);
  assert.equal(body.model, 'openai/gpt-oss-20b');
  assert.equal(body.max_completion_tokens >= 1000, true);
  assert.deepEqual(body.messages.map((m) => m.role), ['system', 'user']);
});

test('groq responses are parsed like OpenAI responses', () => {
  assert.equal(C.parseResponse('groq', { choices: [{ message: { content: '<fixed>ok</fixed>' } }] }), '<fixed>ok</fixed>');
});

test('keyLooksLike recognises each provider prefix and stays quiet otherwise', () => {
  assert.equal(C.keyLooksLike('sk-ant-api03-abcdefghijklmnop'), 'anthropic');
  assert.equal(C.keyLooksLike('xai-abcdefghijklmnopqrstuv'), 'xai');
  assert.equal(C.keyLooksLike('gsk_abcdefghijklmnopqrstuv'), 'groq');
  assert.equal(C.keyLooksLike('sk-proj-abcdefghijklmnopqrstuv'), 'openai');
  assert.equal(C.keyLooksLike('some-custom-gateway-key-123'), null);
  assert.equal(C.keyLooksLike(''), null);
  assert.equal(C.keyLooksLike(undefined), null);
});

test('an unknown provider tells the user to reload the extension', async () => {
  const r = await C.requestReply(Object.assign({ provider: 'xai-old', fetchImpl: async () => ({}) }, base));
  assert.equal(r.ok, false);
  assert.match(r.error, /reload it in chrome:\/\/extensions/);
});

test('a custom model overrides the default, blank falls back', () => {
  assert.equal(C.modelFor('anthropic', '  my-model '), 'my-model');
  assert.equal(C.modelFor('anthropic', ''), C.DEFAULT_MODELS.anthropic);
  assert.equal(C.modelFor('openai', undefined), C.DEFAULT_MODELS.openai);
});

test('unknown providers are rejected without touching the network', async () => {
  let called = false;
  const r = await C.requestReply(Object.assign({ provider: 'nope', fetchImpl: () => (called = true) }, base));
  assert.equal(r.ok, false);
  assert.equal(called, false);
});

test('parseResponse reads both provider formats and tolerates junk', () => {
  assert.equal(C.parseResponse('anthropic', { content: [{ type: 'text', text: 'hi' }] }), 'hi');
  assert.equal(C.parseResponse('openai', { choices: [{ message: { content: 'yo' } }] }), 'yo');
  assert.equal(C.parseResponse('anthropic', {}), null);
  assert.equal(C.parseResponse('openai', { choices: [] }), null);
  assert.equal(C.parseResponse('anthropic', null), null);
});

function fakeFetch(status, json) {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => json });
}

test('requestReply returns the reply on success', async () => {
  const r = await C.requestReply(Object.assign({
    provider: 'anthropic',
    fetchImpl: fakeFetch(200, { content: [{ type: 'text', text: '<fixed>ok</fixed>' }] }),
  }, base));
  assert.deepEqual(r, { ok: true, reply: '<fixed>ok</fixed>' });
});

test('http errors become friendly messages that never contain the key', async () => {
  for (const status of [401, 404, 429, 500, 418]) {
    const r = await C.requestReply(Object.assign({ provider: 'openai', fetchImpl: fakeFetch(status, {}) }, base));
    assert.equal(r.ok, false);
    assert.equal(r.status, status);
    assert.equal(r.error.includes('sk-test-KEY'), false);
    assert.ok(r.error.length > 10);
  }
});

test('network failures and timeouts are reported, not thrown', async () => {
  const down = await C.requestReply(Object.assign({ provider: 'openai', fetchImpl: async () => { throw new TypeError('failed'); } }, base));
  assert.match(down.error, /network/i);

  const slow = await C.requestReply(Object.assign({
    provider: 'openai', timeoutMs: 20,
    fetchImpl: (url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
    }),
  }, base));
  assert.match(slow.error, /too long/i);
});

test('unexpected response shapes are an error', async () => {
  const r = await C.requestReply(Object.assign({ provider: 'anthropic', fetchImpl: fakeFetch(200, { nope: 1 }) }, base));
  assert.equal(r.ok, false);
});

test('rate limiter allows a burst then blocks until the window passes', () => {
  let t = 0;
  const limiter = C.createRateLimiter(3, 1000, () => t);
  assert.deepEqual([limiter.tryTake(), limiter.tryTake(), limiter.tryTake(), limiter.tryTake()], [true, true, true, false]);
  t = 1001;
  assert.equal(limiter.tryTake(), true);
});
