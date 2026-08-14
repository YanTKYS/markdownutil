// samples.test.js
// samples.jsのサンプルMarkdownを検証する。文字列そのものを固定するのではなく、
// 「ヘルプから挿入したサンプルが、そのまま文書プレビュー・スライドプレビュー・
// Word出力で成立するか」を確認する（サンプルが壊れたまま公開されることを防ぐ）。

import test from 'node:test';
import assert from 'node:assert/strict';

import { DOCUMENT_SAMPLE, SLIDE_SAMPLE } from '../js/samples.js';
import { renderMarkdown } from '../js/preview.js';
import { readTheme, render } from '../js/slide-preview.js';
import { buildDocxBlob } from '../js/word-export.js';

test('DOCUMENT_SAMPLE: 見出し・リスト・表・引用を含む文書サンプルである', () => {
  assert.match(DOCUMENT_SAMPLE, /^# MarkdownUtil/);
  assert.match(DOCUMENT_SAMPLE, /^## /m);
  assert.match(DOCUMENT_SAMPLE, /^- /m);
  assert.match(DOCUMENT_SAMPLE, /^1\. /m);
  assert.match(DOCUMENT_SAMPLE, /^\| /m);
  assert.match(DOCUMENT_SAMPLE, /^> /m);
  assert.ok(DOCUMENT_SAMPLE.endsWith('\n'));
});

test('DOCUMENT_SAMPLE: front matterを持たない（文書として挿入する想定）', () => {
  assert.ok(!DOCUMENT_SAMPLE.startsWith('---'));
  assert.equal(readTheme(DOCUMENT_SAMPLE), '');
});

test('DOCUMENT_SAMPLE: 文書プレビューが表・リスト付きのHTMLになる', () => {
  const html = renderMarkdown(DOCUMENT_SAMPLE);

  assert.match(html, /<h1>/);
  assert.match(html, /<table>/);
  assert.match(html, /<ol>/);
  assert.match(html, /<blockquote>/);
});

test('DOCUMENT_SAMPLE: そのままWord出力できる', async () => {
  const blob = await buildDocxBlob(DOCUMENT_SAMPLE);

  assert.ok(blob.size > 0);
});

test('SLIDE_SAMPLE: Marp用のfront matterとスライド区切りを持つ', () => {
  assert.ok(SLIDE_SAMPLE.startsWith('---\nmarp: true\n'));
  assert.equal(readTheme(SLIDE_SAMPLE), 'default');
  assert.match(SLIDE_SAMPLE, /^paginate: true$/m);
  assert.ok(SLIDE_SAMPLE.endsWith('\n'));
});

test('SLIDE_SAMPLE: スピーカーノート用のHTMLコメントを含む', () => {
  assert.match(SLIDE_SAMPLE, /<!--[\s\S]*スピーカーノート[\s\S]*-->/);
});

test('SLIDE_SAMPLE: Marpで複数枚のスライドとしてレンダリングできる', async () => {
  const result = await render(SLIDE_SAMPLE);

  assert.equal(result.error, null);
  assert.equal(result.slideCount, 5, 'スライド区切りの数と枚数が合っていない');
});

test('SLIDE_SAMPLE: Word出力ではfront matterとノートが本文に混ざらない', async () => {
  const blob = await buildDocxBlob(SLIDE_SAMPLE);

  assert.ok(blob.size > 0);
});
