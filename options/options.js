(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const DEFAULTS = {
    enabled: true, disabledHosts: [], learned: [], correctionCount: 0,
    sensitivity: 'balanced', fixOnEnter: true, showHighlight: true,
    includeSearchBoxes: true, fixCapitalizedAtSentenceStart: true,
    contextFixes: false, capitalizeI: false, showHint: false, syncWords: false,
    smartMode: false, smartProvider: 'anthropic', smartModel: '', smartLastError: '',
  };
  const TOGGLES = [
    'fixOnEnter', 'showHighlight', 'includeSearchBoxes', 'fixCapitalizedAtSentenceStart',
    'contextFixes', 'capitalizeI', 'showHint', 'syncWords',
  ];
  let state = Object.assign({}, DEFAULTS);

  function say(text, isError) {
    const el = $('message');
    el.textContent = text;
    el.classList.toggle('error', !!isError);
  }

  function save(patch) {
    state = Object.assign({}, state, patch);
    chrome.storage.local.set(patch);
    render();
  }

  function render() {
    document.querySelectorAll('input[name="sensitivity"]').forEach((r) => {
      r.checked = r.value === state.sensitivity;
    });
    TOGGLES.forEach((id) => { $(id).checked = !!state[id]; });

    const list = $('sites');
    list.textContent = '';
    state.disabledHosts.forEach((host) => {
      const li = document.createElement('li');
      li.appendChild(document.createTextNode(host));
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Enable on ' + host);
      b.textContent = '×';
      b.addEventListener('click', () => save({ disabledHosts: state.disabledHosts.filter((h) => h !== host) }));
      li.appendChild(b);
      list.appendChild(li);
    });
    $('noSites').hidden = state.disabledHosts.length > 0;
    renderSmart();
  }

  // --- Smart mode (AI) ---------------------------------------------------------
  // The API key is read here only to show "saved / ends with ...". It is kept out
  // of `state` and never exported with the backup file.

  let savedKey = '';

  function smartSay(text, kind) {
    const el = $('smartMessage');
    el.textContent = text;
    el.className = kind || '';
  }

  function renderSmart() {
    $('smartProvider').value = state.smartProvider;
    $('smartModel').value = state.smartModel;
    $('smartModel').placeholder = SpellFixSmartClient.DEFAULT_MODELS[state.smartProvider] + ' (default)';
    $('smartMode').checked = !!state.smartMode;
    $('keyStatus').textContent = savedKey ? 'Key saved (ends with ' + savedKey.slice(-4) + ').' : 'No key saved.';
    $('removeKey').disabled = !savedKey;
    $('testSmart').disabled = !savedKey;
    $('smartError').hidden = !state.smartLastError;
    $('smartError').textContent = state.smartLastError ? 'Last problem: ' + state.smartLastError : '';
  }

  function loadKey() {
    chrome.storage.local.get({ smartKey: '' }, (items) => {
      savedKey = items.smartKey || '';
      renderSmart();
    });
  }

  $('smartProvider').addEventListener('change', (e) => save({ smartProvider: e.target.value }));
  $('smartModel').addEventListener('change', (e) => save({ smartModel: e.target.value.trim() }));

  $('saveKey').addEventListener('click', () => {
    const key = $('smartKey').value.trim();
    if (key.length < 20 || /\s/.test(key)) return smartSay('That does not look like an API key.', 'bad');
    chrome.storage.local.set({ smartKey: key }, () => {
      $('smartKey').value = '';
      savedKey = key;
      renderSmart();
      smartSay('Key saved. Press "Test connection" to check it.', 'good');
    });
  });

  $('removeKey').addEventListener('click', () => {
    chrome.storage.local.remove('smartKey', () => {
      savedKey = '';
      save({ smartMode: false, smartLastError: '' });
      smartSay('Key removed and Smart mode turned off.', '');
    });
  });

  $('smartMode').addEventListener('change', (e) => {
    if (e.target.checked && !savedKey) {
      e.target.checked = false;
      return smartSay('Add an API key first.', 'bad');
    }
    save({ smartMode: e.target.checked, smartLastError: '' });
  });

  $('testSmart').addEventListener('click', () => {
    smartSay('Testing...', '');
    $('testSmart').disabled = true;
    chrome.runtime.sendMessage({ type: 'spellfix-smart-test' }, (reply) => {
      $('testSmart').disabled = !savedKey;
      if (chrome.runtime.lastError || !reply) return smartSay('No answer from the extension. Reload it and try again.', 'bad');
      if (reply.ok) smartSay('Works. "their going to the stor tomorow" became "' + reply.fixed + '".', 'good');
      else smartSay(reply.error, 'bad');
    });
  });

  function exportFile() {
    const data = {
      app: 'spellfix', version: 1,
      learned: state.learned, disabledHosts: state.disabledHosts, sensitivity: state.sensitivity,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spellfix-backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say('Exported ' + state.learned.length + ' words and ' + state.disabledHosts.length + ' sites.');
  }

  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || data.app !== 'spellfix') throw new Error('Not a SpellFix export file');
        const words = (Array.isArray(data.learned) ? data.learned : []).filter((w) => typeof w === 'string' && /^[a-z]{2,40}$/.test(w));
        const hosts = (Array.isArray(data.disabledHosts) ? data.disabledHosts : []).filter((h) => typeof h === 'string' && /^[a-z0-9.-]{1,253}$/i.test(h));
        const patch = {
          learned: Array.from(new Set(state.learned.concat(words))).slice(-1000),
          disabledHosts: Array.from(new Set(state.disabledHosts.concat(hosts))),
        };
        if (['careful', 'balanced', 'eager'].indexOf(data.sensitivity) !== -1) patch.sensitivity = data.sensitivity;
        save(patch);
        say('Imported ' + words.length + ' words and ' + hosts.length + ' sites.');
      } catch (e) {
        say('Could not import: ' + e.message, true);
      }
    };
    reader.readAsText(file);
  }

  document.querySelectorAll('input[name="sensitivity"]').forEach((r) => {
    r.addEventListener('change', () => save({ sensitivity: r.value }));
  });
  TOGGLES.forEach((id) => $(id).addEventListener('change', (e) => save({ [id]: e.target.checked })));
  $('export').addEventListener('click', exportFile);
  $('import').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', (e) => {
    if (e.target.files[0]) importFile(e.target.files[0]);
    e.target.value = '';
  });

  chrome.storage.local.get(DEFAULTS, (items) => {
    state = Object.assign({}, DEFAULTS, items);
    render();
    loadKey();
  });
  chrome.storage.onChanged.addListener(() => {
    chrome.storage.local.get(DEFAULTS, (items) => {
      state = Object.assign({}, DEFAULTS, items);
      render();
    });
  });
})();
