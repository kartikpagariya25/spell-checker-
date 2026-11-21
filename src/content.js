/*
 * Content script entry point: watches typing in every editable field and
 * silently fixes a misspelled word the moment the user finishes it.
 *
 *   type "teh" + space  ->  "the "
 *   press Backspace right away  ->  back to "teh " and the word is remembered
 *                                    so it is never "fixed" again
 */
(function (root) {
  'use strict';

  const Text = root.SpellFixText;
  const Editors = root.SpellFixEditors;
  const Settings = root.SpellFixSettings;
  const Feedback = root.SpellFixFeedback;

  let corrector = null;
  let busy = false; // true while we are editing, so we ignore our own events
  let active = true;
  let lastCorrection = null; // { ctx, replaced, original, word } - what Backspace can undo
  let pendingCount = 0;
  let countTimer = null;
  const sessionIgnore = new Set();

  function getCorrector() {
    if (!corrector) {
      const ignore = new Set(Settings.get().learned);
      sessionIgnore.forEach((w) => ignore.add(w));
      corrector = root.SpellFixCorrector.createCorrector(root.SpellFixWords, {
        ignore,
        sensitivity: Settings.get().sensitivity,
      });
    }
    return corrector;
  }

  let correctorKey = '';
  function refreshActive() {
    const s = Settings.get();
    active = Settings.isActiveOn(location.hostname);
    // Rebuild only when something the corrector depends on changed.
    const key = s.sensitivity + '|' + s.learned.length;
    if (key !== correctorKey) {
      correctorKey = key;
      corrector = null;
    }
    if (!active) lastCorrection = null;
  }

  function bumpCount() {
    pendingCount++;
    if (countTimer) return;
    countTimer = setTimeout(() => {
      countTimer = null;
      Settings.save({ correctionCount: Settings.get().correctionCount + pendingCount });
      pendingCount = 0;
    }, 5000);
  }

  function targetOf(event) {
    return event.composedPath ? event.composedPath()[0] : event.target;
  }

  // Editable target for an event, honouring the "include search boxes" preference.
  function editableFor(event) {
    const ctx = Editors.resolve(targetOf(event));
    if (ctx && ctx.kind === 'field' && ctx.el.type === 'search' && !Settings.get().includeSearchBoxes) return null;
    return ctx;
  }

  /**
   * Looks at the word just before the caret and corrects it when it is a clear typo.
   * @param {object} ctx editor context
   * @param {boolean} hasDelimiter true when the last character before the caret is the
   *   delimiter the user just typed (space, comma, ...); false on Enter.
   */
  function correctWordBeforeCaret(ctx, hasDelimiter) {
    const caret = Editors.getCaretContext(ctx);
    if (!caret || caret.before.length === 0) return false;

    let delimiter = '';
    let wordText = caret.before;
    if (hasDelimiter) {
      delimiter = caret.before.slice(-1);
      if (!Text.isDelimiter(delimiter)) return false;
      wordText = caret.before.slice(0, -1);
    }

    const found = Text.wordBeforeCaret(wordText);
    if (!found || found.word.length < 3) return false;

    const kind = Text.caseOf(found.word);
    if (kind === Text.CASE.OTHER) return false; // ALLCAPS / camelCase

    if (kind === Text.CASE.CAPITALIZED) {
      if (!Settings.get().fixCapitalizedAtSentenceStart) return false;
      // A capital letter mid-sentence is probably a name; only fix at sentence starts.
      const contextBeforeWord = caret.context.slice(0, caret.context.length - (wordText.length - found.start) - delimiter.length);
      if (!Text.isSentenceStart(contextBeforeWord)) return false;
    }

    const fix = getCorrector().correct(found.word.toLowerCase());
    if (!fix) return false;

    const replacement = Text.applyCase(found.word, fix);
    const original = found.word + delimiter;
    const replaced = replacement + delimiter;
    const charsToReplace = caret.before.length - found.start;

    busy = true;
    let ok;
    try {
      ok = Editors.replaceBeforeCaret(ctx, charsToReplace, replaced);
    } finally {
      busy = false;
    }
    if (!ok) return false;

    if (hasDelimiter) lastCorrection = { ctx, replaced, original, word: found.word.toLowerCase() };
    if (Settings.get().showHighlight) Feedback.flash(ctx, replacement.length, delimiter.length);
    bumpCount();
    return true;
  }

  function undoLastCorrection(ctx) {
    const last = lastCorrection;
    lastCorrection = null;
    if (!last || last.ctx.el !== ctx.el) return false;
    const caret = Editors.getCaretContext(ctx);
    if (!caret || !caret.before.endsWith(last.replaced)) return false;

    busy = true;
    let ok;
    try {
      ok = Editors.replaceBeforeCaret(ctx, last.replaced.length, last.original);
    } finally {
      busy = false;
    }
    if (ok) {
      sessionIgnore.add(last.word);
      Settings.learnWord(last.word);
      corrector = null;
    }
    return ok;
  }

  function onInput(event) {
    if (!active || busy || event.isComposing) return;
    if (event.inputType !== 'insertText' || !Text.isDelimiter(event.data)) {
      if (!busy) lastCorrection = null;
      return;
    }
    const ctx = editableFor(event);
    if (ctx) correctWordBeforeCaret(ctx, true);
  }

  // Some rich editors cancel beforeinput and never fire `input`; catching the
  // key release too keeps them working. It is harmless when `input` already
  // handled the word because a corrected word is never "corrected" again.
  function onKeyUp(event) {
    if (!active || busy || event.isComposing || event.key.length !== 1 || !Text.isDelimiter(event.key)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const ctx = editableFor(event);
    if (ctx) correctWordBeforeCaret(ctx, true);
  }

  function onKeyDown(event) {
    if (!active || busy || event.isComposing) return;
    const key = event.key;

    if (key === 'Backspace' && !event.ctrlKey && !event.metaKey && !event.altKey && lastCorrection) {
      const ctx = editableFor(event);
      if (ctx && undoLastCorrection(ctx)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }

    if (key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta' || key === 'CapsLock') return;
    lastCorrection = null;

    // Fix the last word before a chat box / form gets submitted with Enter.
    if (key === 'Enter' && !event.ctrlKey && !event.metaKey && Settings.get().fixOnEnter) {
      const ctx = editableFor(event);
      if (ctx) correctWordBeforeCaret(ctx, false);
    }
  }

  function clearUndo() {
    lastCorrection = null;
  }

  function start() {
    Settings.load(() => {
      refreshActive();
      Settings.onChange(refreshActive);
      document.addEventListener('input', onInput, true);
      document.addEventListener('keydown', onKeyDown, true);
      document.addEventListener('keyup', onKeyUp, true);
      document.addEventListener('pointerdown', clearUndo, true);
      document.addEventListener('focusout', clearUndo, true);
    });
  }

  start();
})(typeof globalThis !== 'undefined' ? globalThis : this);
