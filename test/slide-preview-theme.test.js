// slide-preview-theme.test.js
// slide-preview.jsのfront matter操作（readTheme / writeTheme）を検証する。
// テーマ切替はMarkdown本文を書き換える処理なので、本文をこわさないことを重点的に確認する。

import test from 'node:test';
import assert from 'node:assert/strict';

import { THEMES, readTheme, writeTheme } from '../js/slide-preview.js';

test('THEMES: 選択できるテーマは3種類', () => {
  assert.deepEqual(THEMES, ['default', 'gaia', 'uncover']);
});

test('readTheme: front matterのtheme行を読み取る', () => {
  assert.equal(readTheme('---\nmarp: true\ntheme: gaia\n---\n\n# A\n'), 'gaia');
  assert.equal(readTheme('---\ntheme:uncover\n---\n'), 'uncover');
  assert.equal(readTheme('---\ntheme:   gaia   \n---\n'), 'gaia');
});

test('readTheme: 引用符付きのテーマ名は引用符を外して返す', () => {
  assert.equal(readTheme('---\ntheme: "gaia"\n---\n'), 'gaia');
  assert.equal(readTheme("---\ntheme: 'uncover'\n---\n"), 'uncover');
});

test('readTheme: front matterが無い・theme未指定なら空文字', () => {
  assert.equal(readTheme('# 見出しだけ\n'), '');
  assert.equal(readTheme('---\nmarp: true\n---\n\n# A\n'), '');
});

test('readTheme: 本文中の`---`区切りをfront matterと誤認しない', () => {
  const markdown = '# 1枚目\n\n---\n\ntheme: gaia\n\n---\n';

  assert.equal(readTheme(markdown), '');
});

test('readTheme: CRLF改行のfront matterでも読み取れる', () => {
  assert.equal(readTheme('---\r\nmarp: true\r\ntheme: gaia\r\n---\r\n\r\n# A\r\n'), 'gaia');
});

test('writeTheme: front matterが無ければmarp: trueとともに新設する', () => {
  const result = writeTheme('# 見出し\n', 'gaia');

  assert.equal(result, '---\nmarp: true\ntheme: gaia\n---\n\n# 見出し\n');
  assert.equal(readTheme(result), 'gaia');
});

test('writeTheme: 既存のtheme行を置き換え、他の行と本文は変えない', () => {
  const before = '---\nmarp: true\ntheme: gaia\npaginate: true\n---\n\n# 見出し\n\n本文\n';
  const after = writeTheme(before, 'uncover');

  assert.equal(after, '---\nmarp: true\ntheme: uncover\npaginate: true\n---\n\n# 見出し\n\n本文\n');
  assert.equal(readTheme(after), 'uncover');
});

test('writeTheme: theme行が無いfront matterには追記する', () => {
  const after = writeTheme('---\nmarp: true\n---\n\n# 見出し\n', 'gaia');

  assert.equal(after, '---\nmarp: true\ntheme: gaia\n---\n\n# 見出し\n');
});

test('writeTheme: 空のfront matterにもtheme行を書き込める', () => {
  const after = writeTheme('---\n\n---\n\n# 見出し\n', 'gaia');

  assert.equal(readTheme(after), 'gaia');
  assert.match(after, /# 見出し\n$/);
});

test('writeTheme: 本文中の`---`より前にfront matterを新設する', () => {
  const before = '# 1枚目\n\n---\n\n# 2枚目\n';
  const after = writeTheme(before, 'gaia');

  assert.ok(after.startsWith('---\nmarp: true\ntheme: gaia\n---\n\n'));
  assert.ok(after.endsWith(before));
});

test('writeTheme: 繰り返し適用してもtheme行は増えない', () => {
  let markdown = '# 見出し\n';
  ['gaia', 'uncover', 'default'].forEach((theme) => {
    markdown = writeTheme(markdown, theme);
  });

  assert.equal((markdown.match(/^theme:/gm) || []).length, 1);
  assert.equal(readTheme(markdown), 'default');
});
