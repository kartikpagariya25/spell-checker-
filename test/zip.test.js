'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createZip, readZip, crc32 } = require('../scripts/zip-lib.js');

test('crc32 matches the well-known check value', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('round-trips text, binary and empty files', () => {
  const files = [
    { name: 'manifest.json', data: Buffer.from('{"a":1}'.repeat(50)) },
    { name: 'icons/icon16.png', data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]) },
    { name: 'empty.txt', data: Buffer.alloc(0) },
  ];
  const back = readZip(createZip(files));
  assert.deepEqual(back.map((f) => f.name), files.map((f) => f.name));
  back.forEach((f, i) => assert.deepEqual(f.data, files[i].data));
});

test('uses forward slashes and UTF-8 names', () => {
  const [entry] = readZip(createZip([{ name: 'a\\b\\café.txt', data: Buffer.from('x') }]));
  assert.equal(entry.name, 'a/b/café.txt');
});

test('output is deterministic', () => {
  const files = [{ name: 'a.txt', data: Buffer.from('hello hello hello hello') }];
  assert.deepEqual(createZip(files), createZip(files));
});

test('starts with a local header and ends with an end-of-central-directory record', () => {
  const zip = createZip([{ name: 'a.txt', data: Buffer.from('hi') }]);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
});
