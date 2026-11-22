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
  const ContextFixes = root.SpellFixContextFixes;
  const Stats = root.SpellFixStats;

  let corrector = null;
  let busy = false; // true while we are editing, so we ignore our own events
  let active = true;
  let lastCorrection = null; // { ctx, replaced, original, word } - what Backspace can undo
  let undoWatch = null; // { ctx, original, word, until } - detects Ctrl+Z after a fix
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

  // Counters and the recent-fixes list are written together every few seconds
  // so fast typing doesn't hammer chrome.storage.
  let pendingRecent = [];
  function recordRecent(from, to) {
    pendingRecent.unshift({ from, to, host: location.hostname, at: Date.now() });
  }

  function bumpCount() {
    pendingCount++;
    if (countTimer) return;
    countTimer = setTimeout(() => {
      countTimer = null;
      const recent = pendingRecent.concat(Settings.get().recent).slice(0, 10);
      Settings.save({
        correctionCount: Settings.get().correctionCount + pendingCount,
        dailyCounts: Stats.addCount(Settings.get().dailyCounts, pendingCount, Date.now()),
        recent,
      });
      pendingCount = 0;
      pendingRecent = [];
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
    if (!found) return false;

    const prefs = Settings.get();
    const contextBeforeWord = caret.context.slice(0, caret.context.length - (wordText.length - found.start) - delimiter.length);

    // Opt-in fixes that need neighbouring words or a single letter.
    let fix = null;
    let dropWord = false;
    if (prefs.contextFixes && hasDelimiter) {
      const ctxFix = ContextFixes.contextFix(ContextFixes.previousWord(contextBeforeWord), found.word);
      if (ctxFix !== null) {
        fix = ctxFix;
        dropWord = ctxFix === '';
      }
    }
    if (fix === null && prefs.capitalizeI && found.word === 'i') {
      fix = 'I';
    }

    if (fix === null) {
      if (found.word.length < 3) return false;

      const kind = Text.caseOf(found.word);
      if (kind === Text.CASE.OTHER) return false; // ALLCAPS / camelCase

      if (kind === Text.CASE.CAPITALIZED) {
        if (!prefs.fixCapitalizedAtSentenceStart) return false;
        // A capital letter mid-sentence is probably a name; only fix at sentence starts.
        if (!Text.isSentenceStart(contextBeforeWord)) return false;
      }

      fix = getCorrector().correct(found.word.toLowerCase());
      if (!fix) return false;
    }

    const replacement = dropWord || fix === 'have' || fix === 'I' ? fix : Text.applyCase(found.word, fix);
    const original = found.word + delimiter;
    // Dropping a doubled word removes the word *and* its delimiter; everything else keeps the delimiter.
    const replaced = dropWord ? '' : replacement + delimiter;
    const charsToReplace = caret.before.length - found.start;

    busy = true;
    let ok;
    try {
      ok = Editors.replaceBeforeCaret(ctx, charsToReplace, replaced);
    } finally {
      busy = false;
    }
    if (!ok) return false;

    if (hasDelimiter) {
      lastCorrection = { ctx, replaced, original, word: found.word.toLowerCase() };
      // Keep watching for a browser Undo (Ctrl+Z) a little longer than Backspace allows.
      undoWatch = { ctx, original, replaced, word: found.word.toLowerCase(), until: Date.now() + 15000 };
    }
    recordRecent(found.word, replacement);
    if (prefs.showHighlight && replacement !== '') Feedback.flash(ctx, replacement.length, delimiter.length);
    if (prefs.showHint) Feedback.hint(ctx, found.word, replacement);
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

  // If the user presses Ctrl+Z right after a fix and the browser restores the
  // original spelling, that is as clear a "keep my spelling" as Backspace.
  function learnFromBrowserUndo(event) {
    const watch = undoWatch;
    if (!watch || Date.now() > watch.until) return;
    const ctx = editableFor(event);
    if (!ctx || ctx.el !== watch.ctx.el) return;
    // After a browser undo the caret can jump to the start, so compare the whole
    // text: the original spelling is back and the corrected form is gone.
    const text = Editors.fieldText(ctx);
    if (!watch.replaced || !text.includes(watch.original) || text.includes(watch.replaced)) return;
    undoWatch = null;
    lastCorrection = null;
    sessionIgnore.add(watch.word);
    Settings.learnWord(watch.word);
    corrector = null;
  }

  function onInput(event) {
    if (event.inputType === 'historyUndo' && !busy) return learnFromBrowserUndo(event);
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

  // After the extension is reloaded or updated, scripts already running in open
  // tabs lose their connection ("extension context invalidated"). Detect that
  // and stand down so a fresh copy can take over without double handling.
  function extensionAlive() {
    try {
      return typeof chrome === 'undefined' || !chrome.runtime || !!chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  const listeners = [];
  function listen(type, handler) {
    const guarded = (event) => {
      if (!extensionAlive()) return teardown();
      return handler(event);
    };
    listeners.push([type, guarded]);
    document.addEventListener(type, guarded, true);
  }

  function teardown() {
    for (const [type, fn] of listeners) document.removeEventListener(type, fn, true);
    listeners.length = 0;
    root.__spellFixLoaded = false;
  }

  function start() {
    // Never load twice into the same page (manifest injection + on-demand injection).
    if (root.__spellFixLoaded) return;
    root.__spellFixLoaded = true;

    // Listen straight away so the first words typed in a fresh tab are never missed;
    // settings arrive a moment later and simply refine the defaults.
    listen('input', onInput);
    listen('keydown', onKeyDown);
    listen('keyup', onKeyUp);
    listen('pointerdown', clearUndo);
    listen('focusout', clearUndo);

    Settings.load(() => {
      refreshActive();
      Settings.onChange(refreshActive);
    });

    // Lets the popup / background ask "are you running in this tab?".
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          if (message && message.type === 'spellfix-ping') sendResponse({ ok: true, active, host: location.hostname });
        });
      }
    } catch (e) {
      /* messaging is optional */
    }
  }

  start();
})(typeof globalThis !== 'undefined' ? globalThis : this);
