'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const words = require('../src/dictionary-data.js');
const { createCorrector, boundedDistance } = require('../src/corrector.js');
const Smart = require('../src/smart-fix.js');
const { createSmartRunner, IDLE_MS, MAX_PER_MINUTE } = require('../src/smart-runner.js');

const corrector = createCorrector(words);

// A tiny fake editor + AI so the whole flow runs without a browser.
function setup(options) {
  const o = Object.assign({ text: 'their going to the stor tomorow', smartMode: true, reply: null }, options);
  const state = { text: o.text, sent: [], applied: [], fixed: [], errors: [], timers: [], clock: 0 };
  const ctx = { el: {}, kind: 'field' };
  const runner = createSmartRunner({
    getSettings: () => ({ smartMode: o.smartMode }),
    isKnown: (w) => corrector.isKnown(w),
    getIgnore: () => new Set(o.ignore || []),
    send: async (sentence) => {
      state.sent.push(sentence);
      if (o.reply === 'error') return { ok: false, error: 'The API key was rejected.' };
      if (o.reply === 'off') return { ok: false, error: 'off' };
      return { ok: true, reply: o.reply !== null ? o.reply : "<fixed>they're going to the store tomorrow</fixed>" };
    },
    getCaretContext: () => ({ before: state.text }),
    apply: (c, original, replacement) => {
      if (!state.text.includes(original)) return false;
      state.text = state.text.replace(original, replacement);
      state.applied.push([original, replacement]);
      return true;
    },
    smart: Smart,
    distance: boundedDistance,
    onFixed: (c, result) => state.fixed.push(result.changes),
    onError: (m) => state.errors.push(m),
    setTimer: (fn, ms) => { state.timers.push({ fn, ms }); return state.timers.length; },
    clearTimer: (id) => { if (state.timers[id - 1]) state.timers[id - 1].cancelled = true; },
    now: () => state.clock,
  });
  return { runner, state, ctx };
}

test('fixes a sentence with a suspected typo as one edit', async () => {
  const { runner, state, ctx } = setup();
  assert.equal(await runner.onSentenceEnd(ctx), true);
  assert.equal(state.text, "they're going to the store tomorrow");
  assert.equal(state.applied.length, 1, 'a single edit means a single Ctrl+Z');
  assert.deepEqual(state.fixed[0].map((c) => c.to), ["they're", 'store', 'tomorrow']);
});

test('does nothing and sends nothing when smart mode is off', async () => {
  const { runner, state, ctx } = setup({ smartMode: false });
  assert.equal(await runner.onSentenceEnd(ctx), false);
  runner.onActivity(ctx);
  assert.equal(state.sent.length, 0);
  assert.equal(state.timers.length, 0);
});

test('a sentence with no suspected typo never leaves the device', async () => {
  const { runner, state, ctx } = setup({ text: 'this sentence is perfectly fine today' });
  assert.equal(await runner.onSentenceEnd(ctx), false);
  assert.equal(state.sent.length, 0);
});

test('words the user chose to keep are not suspects', async () => {
  const { runner, state, ctx } = setup({ text: 'we visited kartikpur yesterday', ignore: ['kartikpur'] });
  assert.equal(await runner.onSentenceEnd(ctx), false);
  assert.equal(state.sent.length, 0);
});

test('private-looking tokens are hidden before sending and restored after', async () => {
  const { runner, state, ctx } = setup({
    text: 'mail kartik@example.com about teh stor',
    reply: '<fixed>mail [[1]] about the store</fixed>',
  });
  await runner.onSentenceEnd(ctx);
  assert.equal(state.sent[0].includes('kartik@example.com'), false);
  assert.match(state.sent[0], /\[\[1\]\]/);
  assert.equal(state.text, 'mail kartik@example.com about the store');
});

test('a reworded AI answer is rejected and the text is untouched', async () => {
  const { runner, state, ctx } = setup({ reply: '<fixed>They are going to the shop tomorrow morning</fixed>' });
  assert.equal(await runner.onSentenceEnd(ctx), false);
  assert.equal(state.text, 'their going to the stor tomorow');
});

test('an untagged or empty answer changes nothing', async () => {
  for (const reply of ['they are going', '']) {
    const { runner, state, ctx } = setup({ reply });
    assert.equal(await runner.onSentenceEnd(ctx), false);
    assert.equal(state.text, 'their going to the stor tomorow');
  }
});

test('provider errors are surfaced, except the silent "off" state', async () => {
  const a = setup({ reply: 'error' });
  await a.runner.onSentenceEnd(a.ctx);
  assert.deepEqual(a.state.errors, ['The API key was rejected.']);
  const b = setup({ reply: 'off' });
  await b.runner.onSentenceEnd(b.ctx);
  assert.deepEqual(b.state.errors, []);
});

test('the same sentence is not asked about twice', async () => {
  const { runner, state, ctx } = setup({ reply: '<fixed>their going to the stor tomorow</fixed>' });
  await runner.onSentenceEnd(ctx);
  await runner.onSentenceEnd(ctx);
  assert.equal(state.sent.length, 1);
});

test('if the user edited the sentence meanwhile, the answer is dropped', async () => {
  const { runner, state, ctx } = setup();
  const pending = runner.onSentenceEnd(ctx);
  state.text = 'something completely different now'; // typed while waiting
  assert.equal(await pending, false);
  assert.equal(state.text, 'something completely different now');
});

test('typing pauses trigger the check after the idle delay, new typing resets it', () => {
  const { runner, state, ctx } = setup();
  runner.onActivity(ctx);
  runner.onActivity(ctx);
  assert.equal(state.timers.length, 2);
  assert.equal(state.timers[0].cancelled, true, 'the earlier timer was cancelled');
  assert.equal(state.timers[1].ms, IDLE_MS);
});

test('requests are rate limited per minute', async () => {
  const { runner, state, ctx } = setup();
  let sent = 0;
  for (let i = 0; i < MAX_PER_MINUTE + 3; i++) {
    state.text = 'wrold number ' + 'x'.repeat(i + 1) + ' stor';
    await runner.onSentenceEnd(ctx);
    sent = state.sent.length;
  }
  assert.equal(sent, MAX_PER_MINUTE);
  state.clock += 61000;
  state.text = 'a brand new wrold sentense';
  await runner.onSentenceEnd(ctx);
  assert.equal(state.sent.length, MAX_PER_MINUTE + 1);
});
