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

  let hintEl = null;
  let hintTimer = null;

  // Where to anchor the tooltip: under the caret in rich editors, under the field otherwise.
  function anchorRect(ctx) {
    if (ctx.kind === 'rich') {
      const caret = root.SpellFixEditors.richCaret(ctx);
      if (caret) {
        try {
          const range = document.createRange();
          range.setStart(caret.node, caret.offset);
          range.collapse(true);
          const rect = range.getBoundingClientRect();
          if (rect && (rect.width || rect.height)) return rect;
        } catch (e) {
          /* fall through to the element's box */
        }
      }
    }
    return ctx.el.getBoundingClientRect();
  }

  /** Shows `text` in the small bubble under the caret/field for `duration` ms (0 = until replaced). */
  function bubble(ctx, text, duration, color) {
    try {
      const rect = anchorRect(ctx);
      if (!hintEl) {
        hintEl = document.createElement('div');
        hintEl.setAttribute('aria-hidden', 'true');
        hintEl.style.cssText =
          'all:initial;position:fixed;z-index:2147483647;pointer-events:none;padding:3px 8px;' +
          'border-radius:6px;background:#111827;color:#fff;font:12px/1.4 system-ui,sans-serif;' +
          'box-shadow:0 2px 8px rgba(0,0,0,.25);transition:opacity .2s;white-space:nowrap';
      }
      hintEl.textContent = text;
      hintEl.style.background = color || '#111827';
      hintEl.style.whiteSpace = text.length > 48 ? 'normal' : 'nowrap';
      hintEl.style.maxWidth = '320px';
      hintEl.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - 330)) + 'px';
      hintEl.style.top = Math.min(rect.bottom + 4, window.innerHeight - 40) + 'px';
      hintEl.style.opacity = '1';
      if (!hintEl.isConnected) document.documentElement.appendChild(hintEl);
      clearTimeout(hintTimer);
      // A "working" bubble stays until replaced, but never longer than 30 s.
      hintTimer = setTimeout(() => {
        hintEl.style.opacity = '0';
        setTimeout(() => hintEl && hintEl.remove(), 250);
      }, duration || 30000);
    } catch (e) {
      /* cosmetic only */
    }
  }

  /** Tiny "teh -> the" bubble that fades by itself. Purely cosmetic and click-through. */
  function hint(ctx, from, to) {
    bubble(ctx, from + ' → ' + (to === '' ? '(removed)' : to), 1400);
  }

  const TOAST_COLORS = { busy: '#4f46e5', done: '#15803d', warn: '#b45309', error: '#b91c1c' };

  /**
   * Short status message next to the field, e.g. while polishing.
   * kind: 'busy' (stays until the next toast) | 'done' | 'warn' | 'error'
   */
  function toast(ctx, message, kind) {
    bubble(ctx, message, kind === 'busy' ? 0 : kind === 'done' ? 2200 : 4500, TOAST_COLORS[kind]);
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

  /** A soft glow on the field, used after a whole-sentence (smart) fix. */
  function pulse(ctx) {
    glow(ctx.el);
  }

  const api = { flash, hint, pulse, toast };
  root.SpellFixFeedback = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
