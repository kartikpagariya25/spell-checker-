/*
 * DOM adapters. Everything the extension needs from a text field boils down
 * to two operations, implemented once for <input>/<textarea> and once for
 * contenteditable editors (Gmail, ChatGPT, Slack, Notion, ...):
 *
 *   getCaretContext(ctx)            -> text before the caret
 *   replaceBeforeCaret(ctx, n, str) -> swap the n characters before the caret
 *
 * Replacements go through document.execCommand('insertText') so the page
 * sees genuine input events (React/Vue/etc. stay in sync) and Ctrl+Z still
 * works as the user expects.
 */
(function (root) {
  'use strict';

  const TEXT_INPUT_TYPES = new Set(['text', 'search', '']);
  // Code editors manage their own text model and often set spellcheck=false.
  const CODE_EDITOR_SELECTOR =
    '.monaco-editor, .cm-editor, .CodeMirror, .ace_editor, .jp-CodeCell, [data-language], pre[contenteditable]';

  function isEligibleField(el) {
    if (el.disabled || el.readOnly) return false;
    if (root.SpellFixFieldRules && root.SpellFixFieldRules.shouldSkipField({
      autocomplete: el.getAttribute('autocomplete'),
      inputmode: el.getAttribute('inputmode'),
      name: el.getAttribute('name'),
      id: el.id,
    })) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName !== 'INPUT') return false;
    return TEXT_INPUT_TYPES.has((el.getAttribute('type') || '').toLowerCase());
  }

  /**
   * Decides whether an event target is a place we may correct text in.
   * @returns {{kind: 'field'|'rich', el: Element} | null}
   */
  function resolve(target) {
    if (!target || target.nodeType !== 1) return null;
    if (typeof target.closest === 'function' && target.closest('[spellcheck="false"], ' + CODE_EDITOR_SELECTOR)) {
      return null;
    }
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      return isEligibleField(target) ? { kind: 'field', el: target } : null;
    }
    if (target.isContentEditable) {
      // Walk up to the editing host (the element that has contenteditable set).
      let host = target;
      while (host.parentElement && host.parentElement.isContentEditable) host = host.parentElement;
      return { kind: 'rich', el: host };
    }
    return null;
  }

  function selectionFor(el) {
    const rootNode = el.getRootNode && el.getRootNode();
    if (rootNode && typeof rootNode.getSelection === 'function') return rootNode.getSelection();
    return window.getSelection();
  }

  // Collapsed caret inside a text node of the editing host, or null.
  function richCaret(ctx) {
    const sel = selectionFor(ctx.el);
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== 3 || !ctx.el.contains(node)) return null;
    return { sel, node, offset: sel.anchorOffset };
  }

  /**
   * @returns {{before: string, context: string} | null}
   *   before  - text of the current text node/field up to the caret
   *   context - all text from the start of the field up to the caret
   */
  function getCaretContext(ctx) {
    if (ctx.kind === 'field') {
      const el = ctx.el;
      let start;
      let end;
      try {
        start = el.selectionStart;
        end = el.selectionEnd;
      } catch (e) {
        return null;
      }
      if (start == null || start !== end) return null;
      const before = el.value.slice(0, start);
      return { before, context: before };
    }
    const caret = richCaret(ctx);
    if (!caret) return null;
    const before = caret.node.data.slice(0, caret.offset);
    let context = before;
    try {
      const r = document.createRange();
      r.setStart(ctx.el, 0);
      r.setEnd(caret.node, caret.offset);
      context = r.toString();
    } catch (e) {
      /* fall back to the single-node text */
    }
    return { before, context };
  }

  function insertViaExecCommand(text) {
    try {
      // An empty replacement means "delete the selection".
      if (text === '') return document.execCommand('delete');
      return document.execCommand('insertText', false, text);
    } catch (e) {
      return false;
    }
  }

  /** Replaces the `length` characters right before the caret with `text`. */
  function replaceBeforeCaret(ctx, length, text) {
    if (ctx.kind === 'field') {
      const el = ctx.el;
      const caret = el.selectionStart;
      const from = caret - length;
      if (from < 0) return false;
      el.setSelectionRange(from, caret);
      if (length === 0 && text === '') return true;
      if (insertViaExecCommand(text)) return true;
      // Fallback for pages that block execCommand: edit directly and tell the page.
      el.setRangeText(text, from, caret, 'end');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      return true;
    }
    const caret = richCaret(ctx);
    if (!caret || caret.offset - length < 0) return false;
    const range = document.createRange();
    range.setStart(caret.node, caret.offset - length);
    range.setEnd(caret.node, caret.offset);
    caret.sel.removeAllRanges();
    caret.sel.addRange(range);
    return insertViaExecCommand(text);
  }

  /**
   * Replaces an exact piece of text that sits before the caret with `replacement`
   * as ONE edit (one Ctrl+Z restores it) and puts the caret back where it was.
   * Returns false, changing nothing, if the text can't be found unchanged.
   */
  function replaceText(ctx, original, replacement) {
    if (!original || original === replacement) return false;
    const delta = replacement.length - original.length;

    if (ctx.kind === 'field') {
      const el = ctx.el;
      let caret;
      let end;
      try {
        caret = el.selectionStart;
        end = el.selectionEnd;
      } catch (e) {
        return false;
      }
      if (caret == null || caret !== end) return false;
      const idx = el.value.lastIndexOf(original, caret - original.length);
      if (idx === -1 || idx + original.length > caret) return false;
      el.setSelectionRange(idx, idx + original.length);
      let ok = insertViaExecCommand(replacement);
      if (!ok) {
        el.setRangeText(replacement, idx, idx + original.length, 'end');
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: replacement }));
        ok = true;
      }
      try {
        el.setSelectionRange(caret + delta, caret + delta);
      } catch (e) {
        /* caret restore is best effort */
      }
      return ok;
    }

    const caret = richCaret(ctx);
    if (!caret) return false;
    let node = caret.node;
    let idx = node.data.lastIndexOf(original, caret.offset - original.length);
    if (idx === -1 || idx + original.length > caret.offset) {
      // The sentence may live in an earlier text node (the caret moved on); find it.
      idx = -1;
      node = null;
      const walker = document.createTreeWalker(ctx.el, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const i = n.data.lastIndexOf(original);
        if (i !== -1) {
          idx = i;
          node = n;
        }
      }
      if (!node) return false;
    }

    const range = document.createRange();
    range.setStart(node, idx);
    range.setEnd(node, idx + original.length);
    caret.sel.removeAllRanges();
    caret.sel.addRange(range);
    if (!insertViaExecCommand(replacement)) return false;

    // Put the caret back: shifted by the length change if it was in the edited node.
    if (caret.node.isConnected) {
      const offset = caret.node === node ? caret.offset + delta : caret.offset;
      if (offset >= 0 && offset <= caret.node.data.length) {
        const back = document.createRange();
        back.setStart(caret.node, offset);
        back.collapse(true);
        caret.sel.removeAllRanges();
        caret.sel.addRange(back);
      }
    }
    return true;
  }

  const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE']);

  // Nearest paragraph-like element around `node`, or the editing host itself.
  function blockOf(node, host) {
    let el = node.nodeType === 1 ? node : node.parentElement;
    while (el && el !== host) {
      if (BLOCK_TAGS.has(el.tagName)) return el;
      el = el.parentElement;
    }
    return host;
  }

  /**
   * What "polish" should rewrite, plus a function that replaces it:
   *   fields : the selection, or the whole text
   *   rich   : the selection (within one paragraph), or the paragraph around the caret
   * apply(replacement) verifies the text is still exactly what was read, performs
   * ONE edit (one Ctrl+Z restores it) and returns whether it did.
   * Returns null when no safe target can be found.
   * @returns {{text: string, apply: (replacement: string) => boolean} | null}
   */
  function getPolishTarget(ctx) {
    if (ctx.kind === 'field') {
      const el = ctx.el;
      let s;
      let e;
      try {
        s = el.selectionStart;
        e = el.selectionEnd;
      } catch (err) {
        return null;
      }
      if (s == null) return null;
      const start = e > s ? s : 0;
      const end = e > s ? e : el.value.length;
      const text = el.value.slice(start, end);
      return {
        text,
        apply(replacement) {
          if (el.value.slice(start, end) !== text) return false;
          el.focus();
          el.setSelectionRange(start, end);
          if (!insertViaExecCommand(replacement)) {
            el.setRangeText(replacement, start, end, 'end');
            el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: replacement }));
          }
          const caret = start + replacement.length;
          try {
            el.setSelectionRange(caret, caret);
          } catch (err) {
            /* best effort */
          }
          return true;
        },
      };
    }

    const sel = selectionFor(ctx.el);
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!ctx.el.contains(range.commonAncestorContainer)) return null;

    if (!sel.isCollapsed) {
      const first = blockOf(range.startContainer, ctx.el);
      const last = blockOf(range.endContainer, ctx.el);
      if (first !== last) return null; // spans several paragraphs: ask the user to narrow it down
      const live = range.cloneRange();
      const text = live.toString();
      return {
        text,
        apply(replacement) {
          if (live.toString() !== text) return false;
          sel.removeAllRanges();
          sel.addRange(live);
          return insertViaExecCommand(replacement);
        },
      };
    }

    const node = sel.anchorNode;
    if (!node) return null;
    const block = blockOf(node, ctx.el);
    // Several lines/paragraphs directly inside the host and none around the caret: can't isolate one.
    if (block === ctx.el && ctx.el.querySelector('p, div, li, h1, h2, h3, h4, h5, h6, blockquote, br')) return null;
    const text = block.textContent || '';
    return {
      text,
      apply(replacement) {
        if (!block.isConnected || (block.textContent || '') !== text) return false;
        const whole = document.createRange();
        whole.selectNodeContents(block);
        sel.removeAllRanges();
        sel.addRange(whole);
        return insertViaExecCommand(replacement);
      },
    };
  }

  /** Whole text of the field, regardless of where the caret is. */
  function fieldText(ctx) {
    return ctx.kind === 'field' ? ctx.el.value : ctx.el.textContent || '';
  }

  const api = {
    resolve, getCaretContext, replaceBeforeCaret, replaceText, getPolishTarget, selectionFor, richCaret, fieldText,
  };
  root.SpellFixEditors = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
