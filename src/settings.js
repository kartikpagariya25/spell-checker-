/*
 * Tiny settings store shared by the content script and the popup.
 * Backed by chrome.storage.local; falls back to memory when the extension
 * APIs aren't there (unit tests, the manual test page).
 */
(function (root) {
  'use strict';

  const DEFAULTS = { enabled: true, disabledHosts: [], learned: [], correctionCount: 0 };
  const MAX_LEARNED = 1000;

  const area =
    typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local ? chrome.storage.local : null;

  let state = Object.assign({}, DEFAULTS);
  const listeners = [];

  function emit() {
    for (const fn of listeners) {
      try {
        fn(state);
      } catch (e) {
        /* a bad listener must not break the others */
      }
    }
  }

  function load(cb) {
    if (!area) return cb(state);
    try {
      area.get(DEFAULTS, (items) => {
        state = Object.assign({}, DEFAULTS, items);
        cb(state);
      });
    } catch (e) {
      cb(state); // extension was reloaded under us; keep defaults
    }
  }

  function save(patch) {
    state = Object.assign({}, state, patch);
    if (area) {
      try {
        area.set(patch);
      } catch (e) {
        /* extension context invalidated after a reload - ignore */
      }
    }
    emit();
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  if (area && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      const patch = {};
      for (const key of Object.keys(changes)) patch[key] = changes[key].newValue;
      state = Object.assign({}, state, patch);
      emit();
    });
  }

  function isActiveOn(hostname) {
    return state.enabled && state.disabledHosts.indexOf(hostname) === -1;
  }

  function learnWord(word) {
    if (state.learned.indexOf(word) !== -1) return;
    const learned = state.learned.concat(word).slice(-MAX_LEARNED);
    save({ learned });
  }

  function get() {
    return state;
  }

  const api = { DEFAULTS, load, save, get, onChange, isActiveOn, learnWord };
  root.SpellFixSettings = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
