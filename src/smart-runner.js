/*
 * Smart mode orchestration. It decides WHEN to ask the AI about the sentence
 * the user is writing, and applies the answer as one undoable edit.
 *
 * Triggers: a sentence terminator (. ! ?), Enter, or a short pause in typing.
 * Only sentences that still contain a suspected typo are ever sent.
 * Every dependency is injected so the whole flow runs in plain Node tests.
 */
(function (root) {
  'use strict';

  const IDLE_MS = 1500;
  const MAX_PER_MINUTE = 12;

  /**
   * @param {object} deps
   *  getSettings(): current settings (smartMode must be true to do anything)
   *  isKnown(word), getIgnore(): Set - dictionary knowledge
   *  send(redactedSentence): Promise<{ok, fixed?, error?}>
   *  getCaretContext(ctx): {before} | null
   *  apply(ctx, original, replacement): boolean - performs the single edit
   *  smart: SpellFixSmartFix, distance(a, b, max)
   *  onFixed(ctx, result), onError(message)
   *  setTimer(fn, ms), clearTimer(id), now()
   */
  function createSmartRunner(deps) {
    const Smart = deps.smart;
    const handled = new WeakMap(); // field element -> last sentence we dealt with
    const recent = []; // request timestamps for the per-minute cap
    let idleTimer = null;
    let inflight = 0;

    const enabled = () => !!deps.getSettings().smartMode;

    function underRateLimit() {
      const t = deps.now();
      while (recent.length && t - recent[0] > 60000) recent.shift();
      if (recent.length >= MAX_PER_MINUTE) return false;
      recent.push(t);
      return true;
    }

    /** Looks at the sentence before the caret and asks the AI if it holds a suspected typo. */
    async function consider(ctx) {
      if (!enabled() || inflight >= 2) return false;
      const caret = deps.getCaretContext(ctx);
      if (!caret) return false;
      const found = Smart.sentenceBeforeCaret(caret.before);
      if (!found || found.sentence.length < Smart.MIN_SENTENCE) return false;
      if (handled.get(ctx.el) === found.sentence) return false; // already dealt with this exact text

      const suspects = Smart.suspectWords(found.sentence, { isKnown: deps.isKnown, ignore: deps.getIgnore() });
      if (suspects.length === 0) return false; // nothing suspicious: nothing leaves the device
      if (!underRateLimit()) return false;

      handled.set(ctx.el, found.sentence);
      return request(ctx, found.sentence);
    }

    async function request(ctx, sentence) {
      const hidden = Smart.redact(sentence);
      inflight++;
      let reply;
      try {
        reply = await deps.send(hidden.text);
      } finally {
        inflight--;
      }
      if (!reply || !reply.ok) {
        if (reply && reply.error && reply.error !== 'off') deps.onError(reply.error);
        return false;
      }
      if (!enabled()) return false;
      const fixed = Smart.parseFixed(reply.reply !== undefined ? reply.reply : reply.fixed);
      if (fixed === null) return false;

      const checked = Smart.validateCorrection(sentence, Smart.restore(fixed, hidden.tokens), deps.distance);
      if (checked.changes.length === 0) return false;
      if (!deps.apply(ctx, sentence, checked.text)) return false; // text changed meanwhile: leave it alone

      handled.set(ctx.el, checked.text);
      deps.onFixed(ctx, checked, sentence);
      return true;
    }

    function cancelIdle() {
      if (idleTimer !== null) deps.clearTimer(idleTimer);
      idleTimer = null;
    }

    return {
      consider,
      /** Called on ordinary typing: waits for a pause, then considers the sentence. */
      onActivity(ctx) {
        if (!enabled()) return;
        cancelIdle();
        idleTimer = deps.setTimer(() => {
          idleTimer = null;
          consider(ctx);
        }, IDLE_MS);
      },
      /** Called when a sentence ends (. ! ?) or Enter is pressed. */
      onSentenceEnd(ctx) {
        if (!enabled()) return Promise.resolve(false);
        cancelIdle();
        return consider(ctx);
      },
      cancel: cancelIdle,
    };
  }

  const api = { createSmartRunner, IDLE_MS, MAX_PER_MINUTE };
  root.SpellFixSmartRunner = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
