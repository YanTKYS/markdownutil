// errors.test.js
// errors.js（v0.6.3で追加した例外の開発者向け記録）を検証する。利用者向けメッセージは
// 各モジュール側の責務のためここでは扱わず、「原因となった例外を必ずconsoleへ残す」という
// logError()自体の契約だけを確認する。外部への送信が無いことは、console.errorしか
// 呼んでいないことで裏付けられる。

import test from 'node:test';
import assert from 'node:assert/strict';

import { logError } from '../js/errors.js';

test('logError: [MarkdownUtil]接頭辞付きでconsole.errorへcontextとerrorを渡す', () => {
  const originalConsoleError = console.error;
  const calls = [];
  console.error = (...args) => calls.push(args);
  try {
    const cause = new Error('原因');
    logError('convertToMarkdown: 変換に失敗', cause);

    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], '[MarkdownUtil] convertToMarkdown: 変換に失敗');
    assert.equal(calls[0][1], cause);
  } finally {
    console.error = originalConsoleError;
  }
});

test('logError: Errorインスタンスでない値もそのまま記録する', () => {
  const originalConsoleError = console.error;
  const calls = [];
  console.error = (...args) => calls.push(args);
  try {
    logError('handleFile: 想定外の失敗', 'plain string reason');

    assert.deepEqual(calls, [['[MarkdownUtil] handleFile: 想定外の失敗', 'plain string reason']]);
  } finally {
    console.error = originalConsoleError;
  }
});
