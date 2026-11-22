(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const DEFAULTS = { enabled: true, disabledHosts: [], learned: [], correctionCount: 0, recent: [], dailyCounts: {} };
  let hostname = null;
  let state = Object.assign({}, DEFAULTS);

  function render() {
    $('enabled').checked = state.enabled;
    $('count').textContent = state.correctionCount.toLocaleString();
    $('week').textContent = SpellFixStats.weekTotal(state.dailyCounts, Date.now()).toLocaleString();

    const siteRow = $('siteRow');
    if (hostname) {
      $('host').textContent = hostname;
      $('siteEnabled').checked = state.disabledHosts.indexOf(hostname) === -1;
      siteRow.classList.toggle('disabled', !state.enabled);
    } else {
      siteRow.classList.add('disabled');
      $('host').textContent = 'this page';
    }

    const list = $('learned');
    list.textContent = '';
    state.learned.forEach((word) => {
      const li = document.createElement('li');
      li.appendChild(document.createTextNode(word));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Forget ' + word);
      remove.textContent = '×';
      remove.addEventListener('click', () => save({ learned: state.learned.filter((w) => w !== word) }));
      li.appendChild(remove);
      list.appendChild(li);
    });
    const recent = $('recent');
    recent.textContent = '';
    state.recent.forEach((entry) => {
      const li = document.createElement('li');
      const from = document.createElement('span');
      from.className = 'from';
      from.textContent = entry.from;
      const to = document.createElement('span');
      to.className = 'to';
      to.textContent = entry.to;
      const host = document.createElement('span');
      host.className = 'host';
      host.textContent = entry.host || '';
      li.append(from, document.createTextNode('→'), to, host);
      recent.appendChild(li);
    });
    $('recentHint').hidden = state.recent.length > 0;
    $('learnedCount').textContent = String(state.learned.length);
    $('learnedHint').hidden = state.learned.length > 0;
    $('clearLearned').hidden = state.learned.length === 0;
  }

  function save(patch) {
    state = Object.assign({}, state, patch);
    chrome.storage.local.set(patch);
    render();
  }

  $('enabled').addEventListener('change', (e) => save({ enabled: e.target.checked }));
  $('siteEnabled').addEventListener('change', (e) => {
    const others = state.disabledHosts.filter((h) => h !== hostname);
    save({ disabledHosts: e.target.checked ? others : others.concat(hostname) });
  });
  $('clearLearned').addEventListener('click', () => save({ learned: [] }));
  $('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

  // --- Is SpellFix actually running in the tab the user is looking at? ---------

  function showStatus(text, canActivate, good) {
    $('statusText').textContent = text;
    $('activate').hidden = !canActivate;
    $('pageStatus').classList.toggle('ok', !!good);
    $('pageStatus').hidden = false;
  }

  function checkPage(tab) {
    const page = SpellFixPageSupport.classifyUrl(tab && tab.url);
    if (page.kind !== 'web') return showStatus(SpellFixPageSupport.explainUnsupported(page.kind), false);
    chrome.tabs.sendMessage(tab.id, { type: 'spellfix-ping' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        showStatus(
          "SpellFix isn't running in this tab yet. This happens to tabs opened before it was installed or reloaded.",
          true
        );
      } else {
        $('pageStatus').hidden = true;
      }
    });
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    const page = SpellFixPageSupport.classifyUrl(tab && tab.url);
    if (page.kind === 'web') hostname = page.hostname;
    chrome.storage.local.get(DEFAULTS, (items) => {
      state = Object.assign({}, DEFAULTS, items);
      render();
    });
    checkPage(tab);

    $('activate').addEventListener('click', () => {
      $('activate').disabled = true;
      chrome.runtime.sendMessage({ type: 'spellfix-inject', tabId: tab.id }, () => {
        void chrome.runtime.lastError;
        $('activate').disabled = false;
        // Re-check: a short delay lets the freshly injected script start listening.
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { type: 'spellfix-ping' }, (response) => {
            if (chrome.runtime.lastError || !response) showStatus('Could not activate SpellFix here. Try reloading the tab.', true);
            else showStatus('SpellFix is now active in this tab.', false, true);
          });
        }, 250);
      });
    });
  });
})();
