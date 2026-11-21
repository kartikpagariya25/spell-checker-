#!/usr/bin/env node
/*
 * Generates the extension icons (PNG) with no dependencies:
 * an indigo rounded square with a white check mark.
 *   node scripts/make-icons.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZES = [16, 32, 48, 128];
const BG = [79, 70, 229];
const FG = [255, 255, 255];

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function render(size) {
  const radius = size * 0.22;
  const stroke = size * 0.085;
  const pts = [
    [size * 0.27, size * 0.54],
    [size * 0.43, size * 0.7],
    [size * 0.74, size * 0.33],
  ];
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      // Rounded-square coverage with 1px anti-aliased edge.
      const qx = Math.abs(cx - size / 2) - (size / 2 - radius);
      const qy = Math.abs(cy - size / 2) - (size / 2 - radius);
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
      const alpha = Math.max(0, Math.min(1, 0.5 - outside));
      const d = Math.min(
        distToSegment(cx, cy, pts[0][0], pts[0][1], pts[1][0], pts[1][1]),
        distToSegment(cx, cy, pts[1][0], pts[1][1], pts[2][0], pts[2][1])
      );
      const fg = Math.max(0, Math.min(1, stroke / 2 + 0.5 - d));
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = Math.round(BG[0] * (1 - fg) + FG[0] * fg);
      raw[i + 1] = Math.round(BG[1] * (1 - fg) + FG[1] * fg);
      raw[i + 2] = Math.round(BG[2] * (1 - fg) + FG[2] * fg);
      raw[i + 3] = Math.round(alpha * 255);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const size of SIZES) {
  fs.writeFileSync(path.join(outDir, 'icon' + size + '.png'), render(size));
  console.log('wrote icons/icon' + size + '.png');
}
