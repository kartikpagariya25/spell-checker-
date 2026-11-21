/*
 * Service worker: toolbar badge, keyboard shortcut and first-run welcome page.
 * It never sees what you type - all correction happens in the content script.
 */
'use strict';

function updateBadge(enabled) {
  chrome.action.setBadgeText({ text: enabled ? '' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({ color: '#6b7280' });
  chrome.action.setTitle({ title: enabled ? 'SpellFix - on' : 'SpellFix - off' });
}

function syncBadge() {
  chrome.storage.local.get({ enabled: true }, (items) => updateBadge(items.enabled !== false));
}

chrome.runtime.onInstalled.addListener((details) => {
  syncBadge();
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome/welcome.html') });
  }
});

chrome.runtime.onStartup.addListener(syncBadge);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.enabled) updateBadge(changes.enabled.newValue !== false);
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-enabled') return;
  chrome.storage.local.get({ enabled: true }, (items) => {
    chrome.storage.local.set({ enabled: items.enabled === false });
  });
});
