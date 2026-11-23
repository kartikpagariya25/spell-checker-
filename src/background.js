/*
 * Service worker: toolbar badge, keyboard shortcut, right-click menu, optional
 * word sync and the first-run welcome page.
 * It never sees what you type - all correction happens in the content script.
 */
'use strict';

// Chrome loads this as a service worker (importScripts); Firefox as an event
// page whose manifest already lists word-merge.js before this file.
if (typeof importScripts === 'function') {
  importScripts('word-merge.js', 'page-support.js', 'smart-fix.js', 'smart-client.js');
}
const WordMerge = self.SpellFixWordMerge;
const PageSupport = self.SpellFixPageSupport;
const SmartFix = self.SpellFixSmartFix;
const SmartClient = self.SpellFixSmartClient;

// --- Smart mode: ask the user's chosen AI provider ------------------------------
//
// The API key lives only in chrome.storage.local ("smartKey") and is read only
// here and on the options page. Web pages can never see it, and error messages
// never contain it.

const smartLimiter = SmartClient.createRateLimiter(30, 60000);

function readSmartConfig(callback) {
  chrome.storage.local.get({ smartMode: false, smartProvider: 'anthropic', smartModel: '', smartKey: '' }, callback);
}

function askModel(sentence, config) {
  return SmartClient.requestReply({
    fetchImpl: (url, init) => fetch(url, init),
    provider: config.smartProvider,
    key: config.smartKey,
    model: config.smartModel,
    system: SmartFix.SYSTEM_PROMPT,
    user: SmartFix.userPrompt(sentence),
  });
}

function handleSmartRequest(message, respond) {
  const sentence = message.sentence;
  if (typeof sentence !== 'string' || sentence.length === 0 || sentence.length > SmartFix.MAX_SENTENCE + 80) {
    return respond({ ok: false, error: 'Invalid request.' });
  }
  readSmartConfig((config) => {
    if (!config.smartMode || !config.smartKey) return respond({ ok: false, error: 'off' });
    if (!smartLimiter.tryTake()) return respond({ ok: false, error: 'Too many requests at once. Slowing down.' });
    askModel(sentence, config).then(respond);
  });
}

// "Test connection" on the options page: uses the saved key even if Smart mode is still off.
function handleSmartTest(respond) {
  readSmartConfig((config) => {
    if (!config.smartKey) return respond({ ok: false, error: 'Save an API key first.' });
    askModel('their going to the stor tomorow', config).then((result) => {
      if (!result.ok) return respond(result);
      const fixed = SmartFix.parseFixed(result.reply);
      respond(fixed ? { ok: true, fixed } : { ok: false, error: 'The model answered, but not in the expected format.' });
    });
  });
}

// --- Making sure the content script is running in a tab -------------------
//
// Chrome only injects content scripts into pages loaded *after* the extension
// was installed or reloaded. These helpers add them to tabs that are already
// open, and let the popup repair a single tab on demand.

function contentFiles() {
  const entry = chrome.runtime.getManifest().content_scripts[0];
  return { js: entry.js, css: entry.css || [] };
}

function injectInto(tabId) {
  const files = contentFiles();
  return chrome.scripting
    .executeScript({ target: { tabId, allFrames: true }, files: files.js })
    .then(() => (files.css.length ? chrome.scripting.insertCSS({ target: { tabId, allFrames: true }, files: files.css }) : null))
    .then(() => true)
    .catch(() => false); // restricted tab, closed tab, discarded tab ...
}

// Inject only if nothing answers a ping (so we never double-load).
function ensureInjected(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'spellfix-ping' }, (response) => {
      if (chrome.runtime.lastError || !response) injectInto(tabId).then(resolve);
      else resolve(true);
    });
  });
}

function ensureInjectedEverywhere() {
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
    for (const tab of tabs || []) {
      if (tab.id != null && !tab.discarded && PageSupport.classifyUrl(tab.url).kind === 'web') ensureInjected(tab.id);
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || sender.id !== chrome.runtime.id) return false;
  if (message.type === 'spellfix-inject' && typeof message.tabId === 'number') {
    injectInto(message.tabId).then((ok) => sendResponse({ ok }));
    return true; // keep the channel open for the async response
  }
  if (message.type === 'spellfix-smart') {
    handleSmartRequest(message, sendResponse);
    return true;
  }
  if (message.type === 'spellfix-smart-test') {
    handleSmartTest(sendResponse);
    return true;
  }
  return false;
});

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
  ensureInjectedEverywhere(); // install, update and "reload" from chrome://extensions
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
