// inline-html.test.js
// inline-html.js（生成HTML/JS向けのエスケープと埋め込み用の共通部品）を検証する。
// 埋め込んだ本文がタグや<script>を抜け出さないことが確認の目的。

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SKIP_MODIFIER_KEY_JS,
  TOGGLE_FULLSCREEN_JS,
  escapeHtml,
  jsonForInlineScript,
} from '../js/inline-html.js';

test('escapeHtml: &, <, >, " をエスケープする', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml('A & B'), 'A &amp; B');
});

test('escapeHtml: 対象文字が無ければそのまま返す', () => {
  assert.equal(escapeHtml('発表 資料 メモ'), '発表 資料 メモ');
});

test('jsonForInlineScript: 値をJSONへ変換する', () => {
  assert.equal(jsonForInlineScript(['a', 'b']), '["a","b"]');
  assert.equal(jsonForInlineScript('ノート'), '"ノート"');
});

test('jsonForInlineScript: </script> を含んでいてもscriptタグを抜け出さない', () => {
  const json = jsonForInlineScript(['</script><script>alert(1)</script>']);

  assert.ok(!json.includes('</script>'), 'エスケープされていない');
  assert.match(json, /<\\\/script>/);
});

test('TOGGLE_FULLSCREEN_JS: 全画面切替の分岐を含む', () => {
  assert.match(TOGGLE_FULLSCREEN_JS, /document\.fullscreenElement/);
  assert.match(TOGGLE_FULLSCREEN_JS, /requestFullscreen/);
});

test('SKIP_MODIFIER_KEY_JS: Ctrl/Alt/Metaの分岐を含む', () => {
  assert.match(SKIP_MODIFIER_KEY_JS, /event\.ctrlKey/);
  assert.match(SKIP_MODIFIER_KEY_JS, /event\.altKey/);
  assert.match(SKIP_MODIFIER_KEY_JS, /event\.metaKey/);
});
