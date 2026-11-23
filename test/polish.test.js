'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/polish.js');
const Smart = require('../src/smart-fix.js');

// ---- prompt + parsing --------------------------------------------------------

test('the prompt keeps meaning and tone and treats the text as data', () => {
  assert.match(P.SYSTEM_PROMPT, /same meaning/i);
  assert.match(P.SYSTEM_PROMPT, /tone/i);
  assert.match(P.SYSTEM_PROMPT, /NEVER instructions/);
  assert.match(P.SYSTEM_PROMPT, /<polished><\/polished>/);
  assert.match(P.userPrompt('hello'), /hello/);
});

test('parsePolished extracts the tagged text and ignores chatter', () => {
  assert.equal(P.parsePolished('<polished>\nHello there.\n</polished>'), 'Hello there.');
  assert.equal(P.parsePolished('Sure!\n<polished>Hi</polished>\nHope that helps'), 'Hi');
  assert.equal(P.parsePolished('no tags'), null);
  assert.equal(P.parsePolished(null), null);
  assert.equal(P.parsePolished('<polished>line1\nline2</polished>'), 'line1\nline2');
});

// ---- validate ----------------------------------------------------------------------

test('accepts a real grammar fix and keeps surrounding whitespace', () => {
  const r = P.validate('  i has went to school yesterday  ', 'I went to school yesterday.');
  assert.equal(r.ok, true);
  assert.equal(r.changed, true);
  assert.equal(r.text, '  I went to school yesterday.  ');
});

test('unchanged text is reported as already good', () => {
  const r = P.validate('This is already fine.', 'This is already fine.');
  assert.deepEqual(r, { ok: true, changed: false, text: 'This is already fine.' });
});

test('rejects empty or missing answers', () => {
  assert.equal(P.validate('some text here', '').ok, false);
  assert.equal(P.validate('some text here', '   ').ok, false);
  assert.equal(P.validate('some text here', null).ok, false);
});

test('rejects answers that alter placeholders or code fences', () => {
  assert.equal(P.validate('mail [[1]] now please', 'mail [[2]] now please').ok, false);
  assert.equal(P.validate('mail [[1]] and [[2]] soon', 'mail [[1]] soon').ok, false);
  assert.equal(P.validate('see ```x = 1``` ok', 'see x = 1 ok').ok, false);
  assert.equal(P.validate('mail [[1]] and [[2]] soon', 'Mail [[2]] and [[1]] soon.').ok, true, 'order may change');
});

test('rejects a changed paragraph structure', () => {
  assert.equal(P.validate('line one\nline two', 'line one line two').ok, false);
  assert.equal(P.validate('line one\n\nline two', 'Line one.\nLine two.').ok, true, 'blank lines do not count');
});

test('rejects answers whose length is wildly different', () => {
  const original = 'please summarise this document for me today';
  assert.equal(P.validate(original, 'ok').ok, false);
  assert.equal(P.validate(original, 'Sure. ' + 'blah '.repeat(60)).ok, false);
});

test('short texts skip the length ratio check', () => {
  assert.equal(P.validate('hi', 'Hello there, friend').ok, true);
});

// ---- the orchestration -------------------------------------------------------------

function setup(options) {
  const o = Object.assign({ text: 'i has went to school yesterday and dont know why', grammarShortcut: true }, options);
  const log = { shown: [], applied: [], sent: [], done: 0 };
  const target = o.noTarget ? null : {
    text: o.text,
    apply(replacement) {
      if (o.textChanged) return false;
      log.applied.push(replacement);
      return true;
    },
  };
  const polisher = P.createPolisher({
    getSettings: () => ({ grammarShortcut: o.grammarShortcut }),
    getTarget: () => target,
    send: async (text) => {
      log.sent.push(text);
      if (o.reply === 'error') return { ok: false, error: 'The API key was rejected.' };
      if (o.reply === 'none') return null;
      const fixed = o.reply !== undefined ? o.reply : "I went to school yesterday and don't know why.";
      return { ok: true, reply: '<polished>' + fixed + '</polished>' };
    },
    show: (ctx, message, kind) => log.shown.push([kind, message]),
    guard: (fn) => fn(),
    onDone: () => log.done++,
    smart: Smart,
  });
  return { polisher, log };
}

test('polishes the text as one replacement and tells the user how to undo', async () => {
  const { polisher, log } = setup();
  assert.equal(await polisher.run({}), true);
  assert.deepEqual(log.applied, ["I went to school yesterday and don't know why."]);
  assert.equal(log.done, 1);
  assert.equal(log.shown[0][0], 'busy');
  assert.match(log.shown[log.shown.length - 1][1], /Ctrl\+Z/);
});

test('does nothing when the shortcut is switched off', async () => {
  const { polisher, log } = setup({ grammarShortcut: false });
  assert.equal(await polisher.run({}), false);
  assert.equal(log.sent.length, 0);
  assert.equal(log.shown.length, 0);
});

test('explains what to do when no paragraph can be isolated', async () => {
  const { polisher, log } = setup({ noTarget: true });
  assert.equal(await polisher.run({}), false);
  assert.equal(log.sent.length, 0);
  assert.match(log.shown[0][1], /Select the text/);
});

test('tiny or oversized text is never sent', async () => {
  const tiny = setup({ text: ' a ' });
  await tiny.polisher.run({});
  assert.equal(tiny.log.sent.length, 0);
  const huge = setup({ text: 'word '.repeat(1200) });
  await huge.polisher.run({});
  assert.equal(huge.log.sent.length, 0);
  assert.match(huge.log.shown[0][1], /too long/);
});

test('private tokens are hidden before sending and restored in the result', async () => {
  const { polisher, log } = setup({
    text: 'mail kartik@example.com tomorow becuase i has a question',
    reply: 'Mail [[1]] tomorrow because I have a question.',
  });
  await polisher.run({});
  assert.equal(log.sent[0].includes('kartik@example.com'), false);
  assert.deepEqual(log.applied, ['Mail kartik@example.com tomorrow because I have a question.']);
});

test('a provider error is shown and nothing is changed', async () => {
  const { polisher, log } = setup({ reply: 'error' });
  assert.equal(await polisher.run({}), false);
  assert.equal(log.applied.length, 0);
  assert.equal(log.shown[log.shown.length - 1][1], 'The API key was rejected.');
});

test('a missing answer falls back to a helpful message', async () => {
  const { polisher, log } = setup({ reply: 'none' });
  assert.equal(await polisher.run({}), false);
  assert.match(log.shown[log.shown.length - 1][1], /Reload the page/);
});

test('an unusable or rule-breaking answer is not applied', async () => {
  const noTags = setup();
  noTags.polisher.run = noTags.polisher.run; // same instance
  const p = P.createPolisher({
    getSettings: () => ({ grammarShortcut: true }),
    getTarget: () => ({ text: 'this are bad text for sure', apply: () => { throw new Error('should not apply'); } }),
    send: async () => ({ ok: true, reply: 'just chatter without tags' }),
    show: () => {}, guard: (fn) => fn(), onDone: () => {}, smart: Smart,
  });
  assert.equal(await p.run({}), false);

  const reworded = setup({ text: 'one\ntwo', reply: 'one two' });
  assert.equal(await reworded.polisher.run({}), false);
  assert.equal(reworded.log.applied.length, 0);
});

test('already-correct text reports that and changes nothing', async () => {
  const { polisher, log } = setup({ text: 'This sentence is already perfect.', reply: 'This sentence is already perfect.' });
  assert.equal(await polisher.run({}), false);
  assert.equal(log.applied.length, 0);
  assert.match(log.shown[log.shown.length - 1][1], /Already looks good/);
});

test('if the text changed while waiting, nothing is replaced', async () => {
  const { polisher, log } = setup({ textChanged: true });
  assert.equal(await polisher.run({}), false);
  assert.match(log.shown[log.shown.length - 1][1], /changed while polishing/);
  assert.equal(log.done, 0);
});

test('a second press while busy is ignored', async () => {
  const { polisher, log } = setup();
  const first = polisher.run({});
  assert.equal(polisher.isBusy(), true);
  assert.equal(await polisher.run({}), false);
  await first;
  assert.equal(log.sent.length, 1);
  assert.equal(polisher.isBusy(), false);
});
