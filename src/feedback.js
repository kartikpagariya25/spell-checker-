/*
 * Subtle "something changed here" cue after an auto-correction.
 *  - rich editors: the corrected word is softly highlighted for ~1s
 *    (CSS Custom Highlight API, styled in content.css)
 *  - plain inputs/textareas can't style part of their text, so the field
 *    gets a brief green glow instead.
 * Never modifies the page's DOM or styles permanently.
 */
(function (root) {
  'use strict';

  const HIGHLIGHT_NAME = 'spellfix-corrected';
  const DURATION_MS = 1100;
  let clearTimer = null;

  function glow(el) {
    if (typeof el.animate !== 'function') return;
    el.animate(
      [
        { boxShadow: '0 0 0 2px rgba(34, 197, 94, 0.65)' },
        { boxShadow: '0 0 0 2px rgba(34, 197, 94, 0)' },
      ],
      { duration: 700, easing: 'ease-out' }
    );
  }

  function highlightWord(ctx, wordLength, trailing) {
    if (typeof CSS === 'undefined' || !CSS.highlights || typeof Highlight === 'undefined') return glow(ctx.el);
    const caret = root.SpellFixEditors.richCaret(ctx);
    if (!caret) return;
    const end = caret.offset - trailing;
    const start = end - wordLength;
    if (start < 0) return;
    try {
      const range = document.createRange();
      range.setStart(caret.node, start);
      range.setEnd(caret.node, end);
      CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range));
      clearTimeout(clearTimer);
      clearTimer = setTimeout(() => CSS.highlights.delete(HIGHLIGHT_NAME), DURATION_MS);
    } catch (e) {
      /* purely cosmetic - never let it break typing */
    }
  }

  /**
   * @param {object} ctx editor context from SpellFixEditors.resolve
   * @param {number} wordLength length of the corrected word
   * @param {number} trailing characters typed after the word (the delimiter), 0 or 1
   */
  function flash(ctx, wordLength, trailing) {
    if (ctx.kind === 'field') glow(ctx.el);
    else highlightWord(ctx, wordLength, trailing);
  }

  const api = { flash };
  root.SpellFixFeedback = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
