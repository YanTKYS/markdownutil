// converter-wasm.test.js
// converter.jsのWASM境界（初期化・変換・エラー正規化）を、同梱のAnyDoc WASMを
// 実際に動かして検証する。
//
// AnyDocのバンドルは`fetch(new URL('anydoc_wasm_bg.wasm', import.meta.url))`で
// wasmを読み込むが、Nodeのfetchはfile:URLに対応しないため、file:だけをファイル読み込みへ
// 振り替える薄いshimを入れる（wasm本体・変換処理はいずれも本物を使う）。
//
// 変換対象のdocxはword-export.jsで生成する。テスト用バイナリをリポジトリへ
// 置かずに済み、「Word出力 -> 読み込み直し」という実際の利用の流れも一度に確かめられる。
//
// 注意: converter.jsは初期化結果をモジュール内に保持するため、初期化失敗のテストは
// shimを入れる前（ファイルの先頭）に実行する必要がある。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ConversionError, convertToMarkdown, preload } from '../js/converter.js';
import { buildDocxBlob } from '../js/word-export.js';

/** file:URLだけをディスク読み込みへ振り替える（wasmのfetchを成立させるため）。 */
function installWasmFetch() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    const url = String(input && input.url ? input.url : input);
    if (url.startsWith('file:')) {
      return new Response(readFileSync(new URL(url)), {
        headers: { 'content-type': 'application/wasm' },
      });
    }
    return originalFetch(input, options);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

const fileOf = (name, bytes) => ({
  name,
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
});

const encode = (text) => new TextEncoder().encode(text);

/* ---- 初期化に失敗する場合（必ず最初に実行されること） ---- */

test('WASMを読み込めない場合はinitFailedのConversionErrorになる', async () => {
  // shim未導入のため、wasmのfetch（file:URL）が失敗する。
  const error = await convertToMarkdown(fileOf('a.docx', encode('dummy'))).catch((e) => e);

  assert.ok(error instanceof ConversionError);
  assert.equal(error.code, 'initFailed');
  assert.equal(error.message, 'WASMモジュールの初期化に失敗しました。ページを再読み込みしてください。');
  assert.ok(error.cause, '原因のエラーを保持していない');
});

test('preload: 初期化の失敗を呼び出し側へ投げない', async () => {
  assert.equal(preload(), undefined);
  // 直前の失敗で初期化状態は破棄されるため、後続のテストは改めて初期化できる。
});

/* ---- ここから本物のWASMで変換する ---- */

// shimはファイル単位のbeforeフックでなくここで入れる（上の初期化失敗テストより
// 先に実行されてしまわないようにするため）。
let shimInstalled = false;
function ensureWasmFetch() {
  if (!shimInstalled) {
    installWasmFetch();
    shimInstalled = true;
  }
}

test('docx: Word出力したファイルをMarkdownへ戻せる', async () => {
  ensureWasmFetch();
  const markdown = '# 見出し\n\n本文です。\n\n- 箇条書き\n';
  const blob = await buildDocxBlob(markdown);
  const bytes = new Uint8Array(await blob.arrayBuffer());

  const converted = await convertToMarkdown(fileOf('sample.docx', bytes));

  assert.match(converted, /^# 見出し$/m);
  assert.match(converted, /^本文です。$/m);
  assert.match(converted, /^- 箇条書き$/m);
});

test('csv: 表のMarkdownへ変換する', async () => {
  ensureWasmFetch();
  const converted = await convertToMarkdown(fileOf('表.csv', encode('a,b\n1,2\n')));

  assert.equal(converted, '| a | b |\n| --- | --- |\n| 1 | 2 |\n');
});

test('複数回の変換でもWASMの初期化は一度で足りる', async () => {
  ensureWasmFetch();
  const first = await convertToMarkdown(fileOf('a.csv', encode('x\n1\n')));
  const second = await convertToMarkdown(fileOf('b.csv', encode('y\n2\n')));

  assert.match(first, /\| x \|/);
  assert.match(second, /\| y \|/);
});

test('拡張子が無いファイルは内容から形式を判定させる', async () => {
  ensureWasmFetch();
  // AnyDocが内容からも判定できない場合はunsupportedへ正規化される。
  const error = await convertToMarkdown(fileOf('拡張子なし', encode('ただの文字列'))).catch((e) => e);

  assert.ok(error instanceof ConversionError);
  assert.equal(error.code, 'unsupported');
  assert.equal(error.message, 'この形式は変換に対応していません。');
});

test('壊れたdocxはmalformedのConversionErrorになる', async () => {
  ensureWasmFetch();
  const error = await convertToMarkdown(fileOf('壊れた.docx', encode('これはZIPではない'))).catch((e) => e);

  assert.ok(error instanceof ConversionError);
  assert.equal(error.code, 'malformed');
  assert.equal(error.message, 'ファイルが破損しているか、読み取れない構造のため変換できませんでした。');
  assert.ok(error.cause, 'AnyDoc側のエラーを原因として保持していない');
});

test('ファイルの読み込みに失敗した場合はreadFailedのConversionErrorになる', async () => {
  ensureWasmFetch();
  const failing = {
    name: 'a.docx',
    arrayBuffer: async () => {
      throw new Error('disk error');
    },
  };

  const error = await convertToMarkdown(failing).catch((e) => e);

  assert.ok(error instanceof ConversionError);
  assert.equal(error.code, 'readFailed');
  assert.equal(error.message, 'ファイルの読み込みに失敗しました。');
  assert.equal(error.cause.message, 'disk error');
});
