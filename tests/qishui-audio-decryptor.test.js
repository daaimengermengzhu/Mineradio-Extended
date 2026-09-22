'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { TrackDecryptor } = require('../qishui-audio-decryptor/track-decryptor');
const { Mp4Box } = require('../qishui-audio-decryptor/mp4-box');
function u32(value) { const b=Buffer.alloc(4); b.writeUInt32BE(value); return b; }
function box(type,...parts) { const body=Buffer.concat(parts); return Buffer.concat([u32(body.length+8),Buffer.from(type),body]); }
test('authorized AES sample roundtrip preserves the MP4 container and removes the encrypted sample label', () => {
  // Entirely synthetic media and key; no platform credentials or copyrighted recording.
  const key=Buffer.alloc(16,7), iv=Buffer.alloc(16), plain=Buffer.from('synthetic audio sample');
  iv.writeUInt32BE(17);
  const cipher=crypto.createCipheriv('aes-128-ctr',key,iv);
  const encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);
  const stbl=box('stbl',box('stsd',u32(0),u32(1),box('enca',Buffer.alloc(28))),
    box('stsz',u32(0),u32(plain.length),u32(1)),
    box('stsc',u32(0),u32(1),u32(1),u32(1),u32(1)),
    box('stco',u32(0),u32(1),u32(0)),box('senc',u32(0),u32(1),iv.subarray(0,8)));
  const input=Buffer.concat([box('moov',box('trak',box('mdia',box('minf',stbl)))),box('mdat',encrypted)]);
  const result=new TrackDecryptor().decrypt({encryptedBuffer:input,spadeA:key.toString('hex')});
  assert.equal(result.extension,'.m4a');
  assert.deepEqual(Mp4Box.findBox(result.buffer,'mdat').data,plain);
  assert.ok(result.buffer.includes(Buffer.from('mp4a')));
  assert.ok(input.includes(Buffer.from('enca')),'source buffer remains unchanged');
  assert.throws(()=>new TrackDecryptor().decrypt({encryptedBuffer:Buffer.from('invalid'),spadeA:key.toString('hex')}),/moov/);
});
