/*
 * Talks to the AI provider the user chose (their own API key). Used by the
 * background service worker only; the key never reaches web pages.
 * The network function is injected so everything here is testable offline.
 */
(function (root) {
  'use strict';

  const DEFAULT_MODELS = {
    anthropic: 'claude-haiku-5-5',
    openai: 'gpt-4o-mini',
    xai: 'grok-4.7',
    groq: 'openai/gpt-oss-20b',
  };
  const PROVIDERS = Object.keys(DEFAULT_MODELS);
  const MAX_TOKENS = 600;
  // Reasoning-capable models count their hidden thinking against the limit, so give them room.
  const MAX_COMPLETION_TOKENS = 2000;

  // Providers that speak the OpenAI "chat completions" dialect.
  const OPENAI_COMPATIBLE = {
    openai: 'https://api.openai.com/v1/chat/completions',
    xai: 'https://api.x.ai/v1/chat/completions',
    groq: 'https://api.groq.com/openai/v1/chat/completions',
  };

  /**
   * Guesses which provider an API key belongs to from its well-known prefix.
   * Returns null when it can't tell (so we never block an unusual key).
   */
  function keyLooksLike(key) {
    const k = String(key || '').trim();
    if (/^sk-ant-/.test(k)) return 'anthropic';
    if (/^xai-/.test(k)) return 'xai';
    if (/^gsk_/.test(k)) return 'groq';
    if (/^sk-/.test(k)) return 'openai';
    return null;
  }

  function modelFor(provider, model) {
    return (model && model.trim()) || DEFAULT_MODELS[provider];
  }

  /** @returns {{url: string, init: {method: string, headers: object, body: string}}} */
  function buildRequest(opts) {
    const { provider, key, system, user } = opts;
    const model = modelFor(provider, opts.model);
    if (provider === 'anthropic') {
      return {
        url: 'https://api.anthropic.com/v1/messages',
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            // Required by Anthropic for requests that originate in a browser context.
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model,
            max_tokens: opts.maxTokens || MAX_TOKENS,
            temperature: 0,
            system,
            messages: [{ role: 'user', content: user }],
          }),
        },
      };
    }
    if (OPENAI_COMPATIBLE[provider]) {
      return {
        url: OPENAI_COMPATIBLE[provider],
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
          body: JSON.stringify({
            model,
            max_completion_tokens: opts.maxTokens || MAX_COMPLETION_TOKENS,
            temperature: 0,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
        },
      };
    }
    throw new Error(
      'Unknown provider "' + provider + '". If you just updated SpellFix, reload it in chrome://extensions.'
    );
  }

  /** Pulls the reply text out of a provider's JSON response, or null. */
  function parseResponse(provider, json) {
    try {
      if (provider === 'anthropic') {
        const block = (json.content || []).find((b) => b && b.type === 'text');
        return block ? String(block.text) : null;
      }
      if (OPENAI_COMPATIBLE[provider]) {
        const message = json.choices && json.choices[0] && json.choices[0].message;
        return message && typeof message.content === 'string' ? message.content : null;
      }
    } catch (e) {
      /* fall through */
    }
    return null;
  }

  function describeHttpError(status) {
    if (status === 401 || status === 403) return 'The API key was rejected. Check the key and provider.';
    if (status === 404) return 'The model was not found. Check the model name.';
    if (status === 429) return 'Rate limited by the provider. Try again in a moment.';
    if (status >= 500) return 'The provider had a temporary problem.';
    return 'The provider returned an error (' + status + ').';
  }

  /**
   * Sends one request and returns {ok: true, reply} or {ok: false, error}.
   * Errors never include the API key.
   */
  async function requestReply(opts) {
    const fetchImpl = opts.fetchImpl;
    const timeoutMs = opts.timeoutMs || 10000;
    let request;
    try {
      request = buildRequest(opts);
    } catch (e) {
      return { ok: false, error: e.message };
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetchImpl(request.url, Object.assign({}, request.init, controller ? { signal: controller.signal } : {}));
      if (!response.ok) return { ok: false, error: describeHttpError(response.status), status: response.status };
      const reply = parseResponse(opts.provider, await response.json());
      return reply === null ? { ok: false, error: 'The provider sent an unexpected response.' } : { ok: true, reply };
    } catch (e) {
      const timedOut = e && e.name === 'AbortError';
      return { ok: false, error: timedOut ? 'The provider took too long to answer.' : 'Could not reach the provider (network error).' };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Allows at most `max` calls per `windowMs`. */
  function createRateLimiter(max, windowMs, now) {
    const clock = now || Date.now;
    let stamps = [];
    return {
      tryTake() {
        const t = clock();
        stamps = stamps.filter((s) => t - s < windowMs);
        if (stamps.length >= max) return false;
        stamps.push(t);
        return true;
      },
    };
  }

  const api = { DEFAULT_MODELS, PROVIDERS, keyLooksLike, modelFor, buildRequest, parseResponse, requestReply, createRateLimiter, describeHttpError };
  root.SpellFixSmartClient = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
