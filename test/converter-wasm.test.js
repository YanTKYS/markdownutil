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
import { createMarkdownIt } from '../js/markdown-engine.js';
import { buildZip } from './helpers/zip-write.js';

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

/* ---- 数式・$のエスケープ・チェックボックスの変換 ---- */
//
// いずれも大きなバイナリfixtureを置かずに済むよう、最小限のOOXML/ODFをその場で
// 組み立てて変換する。実際の業務文書での確認はdocs/TESTING.mdの実ブラウザ確認で行う。

/** 本文XMLだけを差し替えた最小限のdocxを組み立てる。 */
function buildMinimalDocx(bodyXml) {
  return buildZip([
    ['[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      + '</Types>'],
    ['_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      + '</Relationships>'],
    ['word/document.xml',
      '<?xml version="1.0" encoding="UTF-8"?>'
      + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
      + ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">'
      + `<w:body>${bodyXml}</w:body></w:document>`],
  ]);
}

const paragraph = (runs) => `<w:p>${runs}</w:p>`;
const run = (text) => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;

test('数式: Wordの数式（OMML）をLaTeXのMarkdownとして出力する', async () => {
  ensureWasmFetch();
  // x^2 を、本文中のインライン数式として置く。
  const omml = '<m:oMath><m:sSup>'
    + '<m:e><m:r><m:t>x</m:t></m:r></m:e>'
    + '<m:sup><m:r><m:t>2</m:t></m:r></m:sup>'
    + '</m:sSup></m:oMath>';
  const bytes = buildMinimalDocx(paragraph(`${run('式は')}${omml}${run('です。')}`));

  const converted = await convertToMarkdown(fileOf('math.docx', bytes));

  assert.match(converted, /\$x\^\{2\}\$/, `LaTeXの数式が出力されていない: ${converted}`);
});

test('数式: AnyDocが出力した数式をプレビューがそのまま保持する', async () => {
  // MarkdownUtilは数式レンダラーを持たないため、数式は「壊さずそのまま表示する」
  // ことだけを保証する（$...$がプレビューで消えたり別記法に化けたりしない）。
  const html = createMarkdownIt().render('式は $x^{2}+y^{2}$ です。\n\n$$\n\\sum_{i=1}^{n}{x_{i}}\n$$\n');

  assert.match(html, /\$x\^\{2\}\+y\^\{2\}\$/);
  assert.match(html, /\\sum_\{i=1\}\^\{n\}\{x_\{i\}\}/);
});

test('$を含む通常文章: 数式と誤読され得る箇所だけをエスケープする', async () => {
  ensureWasmFetch();
  const bytes = buildMinimalDocx(
    // 金額だけの段落。閉じ側の$の直後が数字のため数式にはなり得ず、エスケープされない。
    paragraph(run('標準プランは$20.00、上位プランは$100です。'))
    // 同じ段落に「閉じ側になれる$」（直後が数字でない）が現れると、それより前の$は
    // 数式の開始と読まれ得るためエスケープされる。
    + paragraph(run('価格は$20です。差額はA$Bとして扱います。')),
  );

  const converted = await convertToMarkdown(fileOf('price.docx', bytes));

  assert.match(converted, /^標準プランは\$20\.00、上位プランは\$100です。$/m,
    `不要な\\$が付いている: ${converted}`);
  assert.match(converted, /^価格は\\\$20です。差額はA\$Bとして扱います。$/m,
    `数式と誤読され得る$がエスケープされていない: ${converted}`);

  // MarkdownUtilの表示・Word出力はどちらもmarkdown-itを通るため、
  // 職員が目にする文字列はいずれも元の文書どおり「$」に戻る。
  const html = createMarkdownIt().render(converted);
  assert.match(html, /標準プランは\$20\.00、上位プランは\$100です。/);
  assert.match(html, /価格は\$20です。差額はA\$Bとして扱います。/);
  assert.doesNotMatch(html, /\\\$/);
});

test('チェックボックス: 表計算のフォームコントロールを[x] / [ ]として出力する', async () => {
  ensureWasmFetch();
  const content = '<?xml version="1.0" encoding="UTF-8"?>'
    + '<office:document-content'
    + ' xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"'
    + ' xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"'
    + ' xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"'
    + ' xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"'
    + ' xmlns:form="urn:oasis:names:tc:opendocument:xmlns:form:1.0"'
    + ' office:version="1.3">'
    + '<office:body><office:spreadsheet><table:table table:name="確認表">'
    + '<office:forms><form:form>'
    + '<form:checkbox xml:id="c1" form:label="確認済み" form:current-state="checked"/>'
    + '<form:checkbox xml:id="c2" form:label="未確認"/>'
    + '</form:form></office:forms>'
    + '<table:table-row>'
    + '<table:table-cell office:value-type="string"><text:p>タスク</text:p></table:table-cell>'
    + '<table:table-cell office:value-type="string"><text:p>状態</text:p></table:table-cell>'
    + '</table:table-row>'
    + '<table:table-row>'
    + '<table:table-cell office:value-type="string"><text:p>仕様確認</text:p></table:table-cell>'
    + '<table:table-cell><draw:control draw:control="c1"/></table:table-cell>'
    + '</table:table-row>'
    + '<table:table-row>'
    + '<table:table-cell office:value-type="string"><text:p>実装</text:p></table:table-cell>'
    + '<table:table-cell><draw:control draw:control="c2"/></table:table-cell>'
    + '</table:table-row>'
    + '</table:table></office:spreadsheet></office:body></office:document-content>';
  const bytes = buildZip([
    ['mimetype', 'application/vnd.oasis.opendocument.spreadsheet'],
    ['META-INF/manifest.xml',
      '<?xml version="1.0" encoding="UTF-8"?>'
      + '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">'
      + '<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>'
      + '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>'
      + '</manifest:manifest>'],
    ['content.xml', content],
  ]);

  const converted = await convertToMarkdown(fileOf('確認表.ods', bytes));

  assert.match(converted, /\| 仕様確認 \| \[x\] 確認済み \|/, `チェック済みが[x]になっていない: ${converted}`);
  assert.match(converted, /\| 実装 \| \[ \] 未確認 \|/, `未チェックが[ ]になっていない: ${converted}`);
});
