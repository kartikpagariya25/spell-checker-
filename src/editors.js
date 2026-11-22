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

  const api = { resolve, getCaretContext, replaceBeforeCaret, selectionFor, richCaret };
  root.SpellFixEditors = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
