'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldSkipField } = require('../src/field-rules.js');

test('skips fields identified by autocomplete', () => {
  for (const ac of ['name', 'given-name', 'family-name', 'username', 'email', 'street-address',
    'postal-code', 'cc-number', 'tel', 'one-time-code', 'section-a shipping address-line1', 'country-name']) {
    assert.equal(shouldSkipField({ autocomplete: ac }), true, ac);
  }
});

test('does not skip prose fields', () => {
  for (const ac of ['', 'off', 'on', undefined]) assert.equal(shouldSkipField({ autocomplete: ac }), false, String(ac));
  assert.equal(shouldSkipField({ name: 'message', id: 'comment-body' }), false);
  assert.equal(shouldSkipField({ name: 'prompt-textarea' }), false);
  assert.equal(shouldSkipField({ id: 'description' }), false);
});

test('skips numeric and contact input modes', () => {
  for (const m of ['numeric', 'decimal', 'tel', 'email', 'url']) assert.equal(shouldSkipField({ inputmode: m }), true, m);
  assert.equal(shouldSkipField({ inputmode: 'text' }), false);
});

test('skips by name or id hints in several casings', () => {
  for (const n of ['username', 'user_name', 'userName', 'first-name', 'firstName', 'EMAIL', 'phone_number',
    'zip', 'otp', 'promo-code', 'shipping_address', 'customerCity']) {
    assert.equal(shouldSkipField({ name: n }), true, n);
  }
});

test('word fragments inside longer words do not trigger', () => {
  for (const n of ['spinner', 'opinion', 'panel', 'zipper-notes', 'pinterest']) {
    assert.equal(shouldSkipField({ name: n }), false, n);
  }
});
