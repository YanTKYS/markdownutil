// converter.test.js
// converter.jsのうち、AnyDoc WASMを必要としない部分（拡張子判定・対応拡張子一覧・
// ConversionError）を検証する。実際の変換（convertToMarkdown）はWASMとブラウザの
// File APIを必要とするため、docs/TESTING.mdの手動テストで確認する。

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ConversionError,
  PICKER_EXTENSIONS_HINT,
  TEXT_EXTENSIONS,
  getExtension,
  isTextFile,
} from '../js/converter.js';

test('getExtension: 拡張子を小文字で返す', () => {
  assert.equal(getExtension('report.docx'), 'docx');
  assert.equal(getExtension('REPORT.DOCX'), 'docx');
  assert.equal(getExtension('資料.pptx'), 'pptx');
});

test('getExtension: 複数のドットは最後のドット以降を拡張子とする', () => {
  assert.equal(getExtension('2026.02.report.md'), 'md');
  assert.equal(getExtension('archive.tar.gz'), 'gz');
});

test('getExtension: 拡張子が無い場合は空文字を返す', () => {
  assert.equal(getExtension('README'), '');
  assert.equal(getExtension('trailing.'), '');
  assert.equal(getExtension(''), '');
});

test('getExtension: ドットで始まる名前は拡張子として扱う', () => {
  assert.equal(getExtension('.gitignore'), 'gitignore');
});

test('isTextFile: テキストとして直接読み込む拡張子だけを真とする', () => {
  assert.equal(isTextFile('memo.md'), true);
  assert.equal(isTextFile('memo.markdown'), true);
  assert.equal(isTextFile('memo.TXT'), true);
  assert.equal(isTextFile('memo.docx'), false);
  assert.equal(isTextFile('memo.csv'), false);
  assert.equal(isTextFile('memo'), false);
});

test('TEXT_EXTENSIONS: AnyDocを経由しない拡張子は3種類', () => {
  assert.deepEqual(TEXT_EXTENSIONS, ['md', 'markdown', 'txt']);
});

test('PICKER_EXTENSIONS_HINT: テキスト拡張子を含み、すべて小文字・重複なし', () => {
  TEXT_EXTENSIONS.forEach((extension) => {
    assert.ok(PICKER_EXTENSIONS_HINT.includes(extension), `${extension} が含まれていない`);
  });
  PICKER_EXTENSIONS_HINT.forEach((extension) => {
    assert.equal(extension, extension.toLowerCase());
    assert.ok(!extension.startsWith('.'), `${extension} にドットが含まれている`);
  });
  assert.equal(new Set(PICKER_EXTENSIONS_HINT).size, PICKER_EXTENSIONS_HINT.length);
});

test('PICKER_EXTENSIONS_HINT: 主要なOffice/PDF系の拡張子を網羅している', () => {
  ['docx', 'xlsx', 'pptx', 'pdf', 'csv', 'rtf', 'odt', 'ods', 'odp'].forEach((extension) => {
    assert.ok(PICKER_EXTENSIONS_HINT.includes(extension), `${extension} が含まれていない`);
  });
});

test('ConversionError: codeとcauseを保持し、Errorとして扱える', () => {
  const cause = new Error('原因');
  const error = new ConversionError('変換できませんでした。', { code: 'malformed', cause });

  assert.ok(error instanceof Error);
  assert.equal(error.name, 'ConversionError');
  assert.equal(error.message, '変換できませんでした。');
  assert.equal(error.code, 'malformed');
  assert.equal(error.cause, cause);
});

test('ConversionError: codeを省略した場合はunknownになる', () => {
  const error = new ConversionError('失敗');

  assert.equal(error.code, 'unknown');
  assert.equal(error.cause, undefined);
});
