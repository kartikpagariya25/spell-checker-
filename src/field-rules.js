/*
 * Pure rules for fields where "fixing" spelling would be wrong or harmful:
 * names, usernames, addresses, phone numbers, one-time codes, card details.
 * The page usually tells us via autocomplete / inputmode / name / id.
 */
(function (root) {
  'use strict';

  // autocomplete tokens that describe personal or structured data
  const SKIP_AUTOCOMPLETE = new RegExp(
    '^(name|honorific-prefix|given-name|additional-name|family-name|honorific-suffix|nickname|' +
      'username|email|new-password|current-password|one-time-code|organization-title|organization|' +
      'street-address|address-line[123]|address-level[1-4]|country|country-name|postal-code|' +
      'cc-[a-z-]+|transaction-[a-z]+|bday[a-z-]*|sex|tel[a-z-]*|url|impp|photo)$'
  );

  const SKIP_INPUTMODE = new Set(['numeric', 'decimal', 'tel', 'email', 'url']);

  // name/id fragments that mark structured, non-prose fields
  const SKIP_NAME = /(^|[^a-z])(user(name)?|login|e-?mail|phone|mobile|zip|postal|captcha|otp|pin|passcode|first-?name|last-?name|full-?name|surname|address|city|street|company|promo|coupon|voucher|iban|ifsc|aadhaar|pan)([^a-z]|$)/i;

  /**
   * @param {{autocomplete?: string, inputmode?: string, name?: string, id?: string}} attrs
   * @returns {boolean} true when the field must be left alone
   */
  function shouldSkipField(attrs) {
    const autocomplete = (attrs.autocomplete || '').toLowerCase().trim().split(/\s+/);
    // The last token carries the meaning ("section-x shipping given-name").
    const token = autocomplete[autocomplete.length - 1];
    if (token && SKIP_AUTOCOMPLETE.test(token)) return true;
    if (attrs.inputmode && SKIP_INPUTMODE.has(attrs.inputmode.toLowerCase())) return true;
    const label = (attrs.name || '') + ' ' + (attrs.id || '');
    return SKIP_NAME.test(label.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/_/g, '-'));
  }

  const api = { shouldSkipField };
  root.SpellFixFieldRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
