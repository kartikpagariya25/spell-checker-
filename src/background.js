/*
 * Service worker: toolbar badge, keyboard shortcut, right-click menu, optional
 * word sync and the first-run welcome page.
 * It never sees what you type - all correction happens in the content script.
 */
'use strict';

// Chrome loads this as a service worker (importScripts); Firefox as an event
// page whose manifest already lists word-merge.js before this file.
if (typeof importScripts === 'function') importScripts('word-merge.js');
const WordMerge = self.SpellFixWordMerge;

// --- Toolbar badge -------------------------------------------------------

function updateBadge(enabled) {
  chrome.action.setBadgeText({ text: enabled ? '' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({ color: '#6b7280' });
  chrome.action.setTitle({ title: enabled ? 'SpellFix - on' : 'SpellFix - off' });
}

function syncBadge() {
  chrome.storage.local.get({ enabled: true }, (items) => updateBadge(items.enabled !== false));
}

// --- Right-click menu ----------------------------------------------------

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'never-fix-word',
      title: 'SpellFix: never fix "%s"',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'toggle-site',
      title: 'SpellFix: turn off / on for this site',
      contexts: ['page', 'editable'],
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'never-fix-word') {
    const word = WordMerge.wordFromSelection(info.selectionText);
    if (!word) return;
    chrome.storage.local.get({ learned: [] }, (items) => {
      chrome.storage.local.set({ learned: WordMerge.mergeWords(items.learned, [word]) });
    });
  } else if (info.menuItemId === 'toggle-site' && tab && tab.url) {
    let host;
    try {
      host = new URL(tab.url).hostname;
    } catch (e) {
      return;
    }
    if (!host) return;
    chrome.storage.local.get({ disabledHosts: [] }, (items) => {
      const has = items.disabledHosts.indexOf(host) !== -1;
      chrome.storage.local.set({
        disabledHosts: has ? items.disabledHosts.filter((h) => h !== host) : items.disabledHosts.concat(host),
      });
    });
  }
});

// --- Optional sync of kept words ----------------------------------------

function pushWordsToSync(words) {
  chrome.storage.local.get({ syncWords: false }, (items) => {
    if (items.syncWords) chrome.storage.sync.set({ learned: words });
  });
}

function pullWordsFromSync(remote) {
  chrome.storage.local.get({ syncWords: false, learned: [] }, (items) => {
    if (!items.syncWords) return;
    const merged = WordMerge.mergeWords(items.learned, remote);
    if (!WordMerge.sameWords(merged, items.learned)) chrome.storage.local.set({ learned: merged });
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.enabled) updateBadge(changes.enabled.newValue !== false);
    if (changes.learned) pushWordsToSync(changes.learned.newValue || []);
    if (changes.syncWords && changes.syncWords.newValue) {
      // Just switched on: merge both directions once.
      chrome.storage.sync.get({ learned: [] }, (remote) => {
        pullWordsFromSync(remote.learned);
        chrome.storage.local.get({ learned: [] }, (items) => {
          chrome.storage.sync.set({ learned: WordMerge.mergeWords(remote.learned, items.learned) });
        });
      });
    }
  } else if (area === 'sync' && changes.learned) {
    pullWordsFromSync(changes.learned.newValue || []);
  }
});

// --- Lifecycle -------------------------------------------------------------

chrome.runtime.onInstalled.addListener((details) => {
  syncBadge();
  createMenus();
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome/welcome.html') });
  }
});

chrome.runtime.onStartup.addListener(syncBadge);

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-enabled') return;
  chrome.storage.local.get({ enabled: true }, (items) => {
    chrome.storage.local.set({ enabled: items.enabled === false });
  });
});
