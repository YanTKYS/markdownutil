// zip-write.js
// テスト用の最小限のZIP作成（無圧縮）。AnyDocの変換テストで使うOOXML/ODFの
// 小さなサンプルを、バイナリのfixtureをリポジトリへ置かずにその場で組み立てるために使う。
// 外部パッケージを追加しないため、Node組み込みのzlib.crc32だけを使う。

import { crc32 } from 'node:zlib';

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const STORED = 0;

/**
 * 「エントリ名 -> 内容」からZIP（すべて無圧縮）のバイト列を作る。
 * @param {Array<[string, string | Uint8Array]>} entries
 * @returns {Uint8Array}
 */
export function buildZip(entries) {
  const encoder = new TextEncoder();
  const files = entries.map(([name, content]) => ({
    name: encoder.encode(name),
    data: typeof content === 'string' ? encoder.encode(content) : content,
  }));

  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const file of files) {
    const sum = crc32(Buffer.from(file.data));

    const local = new Uint8Array(30 + file.name.length + file.data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, LOCAL_SIGNATURE, true);
    localView.setUint16(4, 20, true); // version needed
    localView.setUint16(8, STORED, true);
    localView.setUint32(14, sum, true);
    localView.setUint32(18, file.data.length, true); // compressed size
    localView.setUint32(22, file.data.length, true); // uncompressed size
    localView.setUint16(26, file.name.length, true);
    local.set(file.name, 30);
    local.set(file.data, 30 + file.name.length);
    locals.push(local);

    const central = new Uint8Array(46 + file.name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, CENTRAL_SIGNATURE, true);
    centralView.setUint16(4, 20, true); // version made by
    centralView.setUint16(6, 20, true); // version needed
    centralView.setUint16(10, STORED, true);
    centralView.setUint32(16, sum, true);
    centralView.setUint32(20, file.data.length, true);
    centralView.setUint32(24, file.data.length, true);
    centralView.setUint16(28, file.name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(file.name, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((total, c) => total + c.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, END_SIGNATURE, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, end];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
