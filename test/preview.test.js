// preview.test.js
// preview.js（Markdown -> HTML）とmarkdown-engine.js（markdown-itの共通設定・
// front matterとHTMLコメントの除去）を検証する。
// 生HTMLを無効化している（html: false）ことは閉域環境での安全側の前提そのものなので、
// 変換結果だけでなくエスケープ動作も確認する。

import test from 'node:test';
import assert from 'node:assert/strict';

import { renderMarkdown, updatePreview } from '../js/preview.js';
import { createMarkdownIt, stripFrontMatterAndComments } from '../js/markdown-engine.js';
import { installFakeDom } from './helpers/fake-dom.js';

test('renderMarkdown: 空・空白のみのMarkdownは空文字を返す', () => {
  assert.equal(renderMarkdown(''), '');
  assert.equal(renderMarkdown('   \n\t\n'), '');
  assert.equal(renderMarkdown(undefined), '');
  assert.equal(renderMarkdown(null), '');
});

test('renderMarkdown: 見出し・強調・リストを変換する', () => {
  assert.equal(renderMarkdown('# 見出し'), '<h1>見出し</h1>\n');
  assert.match(renderMarkdown('**太字**'), /<strong>太字<\/strong>/);
  assert.match(renderMarkdown('*斜体*'), /<em>斜体<\/em>/);

  const list = renderMarkdown('- 一\n- 二\n');
  assert.match(list, /<ul>/);
  assert.equal((list.match(/<li>/g) || []).length, 2);
});

test('renderMarkdown: 表とコードブロックを変換する', () => {
  const table = renderMarkdown('| A | B |\n| --- | --- |\n| 1 | 2 |\n');
  assert.match(table, /<table>/);
  assert.match(table, /<th>A<\/th>/);
  assert.match(table, /<td>2<\/td>/);

  const fence = renderMarkdown('```\nconst a = 1;\n```\n');
  assert.match(fence, /<pre><code>const a = 1;\n<\/code><\/pre>/);
});

test('renderMarkdown: 生HTMLは実行されずテキストとしてエスケープされる（html: false）', () => {
  const html = renderMarkdown('<script>alert(1)</script>');

  assert.ok(!html.includes('<script>'), '生の<script>が出力されている');
  assert.match(html, /&lt;script&gt;/);
});

test('renderMarkdown: javascript:スキームのリンクは出力されない', () => {
  const html = renderMarkdown('[click](javascript:alert(1))');

  assert.ok(!/href="javascript:/i.test(html), '危険なスキームがhrefに残っている');
});

test('renderMarkdown: URLは自動リンク化される（linkify: true）', () => {
  assert.match(renderMarkdown('https://example.com/'), /<a href="https:\/\/example\.com\/">/);
});

test('renderMarkdown: 単純な改行は<br>にしない（breaks: false）', () => {
  const html = renderMarkdown('一行目\n二行目\n');

  assert.ok(!html.includes('<br>'), 'breaks: false のはずが<br>が出力されている');
  assert.match(html, /一行目\n二行目/);
});

/* ---- front matter・コメントの除去（Word出力と共通の前処理） ---- */

test('renderMarkdown: Marpのfront matterは本文として表示しない', () => {
  // 除去しないと、front matterの中身と閉じの`---`が結び付いて見出し（setext h2）になり、
  // 「marp: true theme: default」が文書プレビューの先頭へ大きく表示されてしまう。
  const html = renderMarkdown('---\nmarp: true\ntheme: gaia\npaginate: true\n---\n\n# 見出し\n');

  assert.ok(!html.includes('marp: true'), 'front matterが本文として表示されている');
  assert.match(html, /<h1>見出し<\/h1>/);
});

test('renderMarkdown: HTMLコメント（スピーカーノート）は本文として表示しない', () => {
  const html = renderMarkdown('# 見出し\n\n<!--\nここは発表メモ\n-->\n\n本文\n');

  assert.ok(!html.includes('発表メモ'), 'コメントが本文として表示されている');
  assert.ok(!html.includes('&lt;!--'), 'コメント記号がエスケープされて表示されている');
  assert.match(html, /<p>本文<\/p>/);
});

test('renderMarkdown: 水平線で始まる本文はfront matterと誤認しない', () => {
  const html = renderMarkdown('---\n\n本文です。\n\n---\n');

  assert.match(html, /本文です。/);
});

test('renderMarkdown: front matterとコメントだけのMarkdownは空文字を返す', () => {
  assert.equal(renderMarkdown('---\nmarp: true\n---\n\n<!-- メモだけ -->\n'), '');
});

test('stripFrontMatterAndComments: プレビューとWord出力で同じ前処理を共有する', () => {
  assert.equal(
    stripFrontMatterAndComments('---\nmarp: true\n---\n\n本文<!-- メモ -->です\n'),
    '\n本文です\n',
  );
});

test('createMarkdownIt: プレビューとWord出力で同じオプションを共有する', () => {
  const md = createMarkdownIt();

  assert.equal(md.options.html, false);
  assert.equal(md.options.linkify, true);
  assert.equal(md.options.breaks, false);
});

test('createMarkdownIt: 呼び出しごとに独立したインスタンスを返す', () => {
  assert.notEqual(createMarkdownIt(), createMarkdownIt());
});

test('updatePreview: レンダリング結果をinnerHTMLへ反映する', () => {
  const dom = installFakeDom();
  try {
    const target = dom.document.createElement('div');
    updatePreview(target, '# 見出し');

    assert.equal(target.innerHTML, '<h1>見出し</h1>\n');
    assert.equal(target.children.length, 0);
  } finally {
    dom.restore();
  }
});

test('updatePreview: 空のMarkdownでは案内文の段落へ置き換える', () => {
  const dom = installFakeDom();
  try {
    const target = dom.document.createElement('div');
    target.innerHTML = '<h1>前の内容</h1>';

    updatePreview(target, '   ');

    assert.equal(target.children.length, 1);
    assert.equal(target.children[0].tagName, 'P');
    assert.equal(target.children[0].className, 'preview-empty');
    assert.equal(target.children[0].textContent, 'プレビューはここに表示されます。');
  } finally {
    dom.restore();
  }
});
