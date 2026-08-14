// download.test.js
// download.js（v0.6.4でapp.js/slide-preview.jsの重複を切り出した、Blob URL経由の
// ファイル保存・別ウィンドウ表示の共通処理）を検証する。切り出し前にapp.js/slide-preview.jsへ
// 直書きされていた処理と同じ挙動（Blob URLの生成・解放、失敗時の即時revoke + 原因記録）を
// 維持していることの確認が目的。openTextInNewWindow()はv0.6.3のopenPrintWindow()が持っていた
// エラー処理（成功時は遅延revoke、失敗/例外時は即時revoke + logError()）をそのまま引き継ぐ。

import test from 'node:test';
import assert from 'node:assert/strict';

import { downloadBlob, downloadTextFile, openTextInNewWindow } from '../js/download.js';
import { installFakeDom } from './helpers/fake-dom.js';

function withFakeUrlAndWindow({ openReturns, throwOnOpen, throwOnCreateObjectURL } = {}) {
  const previousUrl = globalThis.URL;
  const previousWindow = globalThis.window;
  const revoked = [];
  const timeouts = [];

  globalThis.URL = class extends previousUrl {
    static createObjectURL(blob) {
      if (throwOnCreateObjectURL) throw new Error('createObjectURL failed');
      globalThis.URL.lastBlob = blob;
      return 'blob:markdownutil/test';
    }

    static revokeObjectURL(url) {
      revoked.push(url);
    }
  };

  globalThis.window = {
    open(url, target) {
      if (throwOnOpen) throw new Error('window.open failed');
      opened.push({ url, target });
      return openReturns === undefined ? { focus() {} } : openReturns;
    },
    setTimeout(callback, delay) {
      timeouts.push(delay);
      return 1;
    },
  };
  const opened = [];

  return {
    opened,
    revoked,
    timeouts,
    restore() {
      globalThis.URL = previousUrl;
      globalThis.window = previousWindow;
    },
  };
}

test('downloadBlob: aタグ経由でダウンロードし、遅延してBlob URLを解放する', () => {
  const dom = installFakeDom();
  const env = withFakeUrlAndWindow();
  try {
    downloadBlob('document.md', new Blob(['本文'], { type: 'text/markdown' }));

    assert.equal(dom.document.body.children.length, 0, 'リンク要素が残っている');
    assert.deepEqual(env.revoked, [], '即座に解放されている（成功時は遅延解放のはず）');
    assert.deepEqual(env.timeouts, [1000]);
  } finally {
    env.restore();
    dom.restore();
  }
});

test('downloadTextFile: 指定したMIMEタイプ+charset=utf-8でBlobを作る', () => {
  const dom = installFakeDom();
  const env = withFakeUrlAndWindow();
  try {
    downloadTextFile('slide.html', '<h1>A</h1>', 'text/html');

    assert.equal(globalThis.URL.lastBlob.type, 'text/html;charset=utf-8');
  } finally {
    env.restore();
    dom.restore();
  }
});

test('openTextInNewWindow: 開けた場合はtrueを返し、遅延してBlob URLを解放する', () => {
  const env = withFakeUrlAndWindow();
  try {
    assert.equal(openTextInNewWindow('<html></html>', 'text/html'), true);
    assert.equal(env.opened.length, 1);
    assert.deepEqual(env.revoked, []);
    assert.deepEqual(env.timeouts, [60000]);
  } finally {
    env.restore();
  }
});

test('openTextInNewWindow: ポップアップブロック時はfalseを返し、即座にBlob URLを解放する', () => {
  const env = withFakeUrlAndWindow({ openReturns: null });
  try {
    assert.equal(openTextInNewWindow('<html></html>', 'text/html'), false);
    assert.deepEqual(env.revoked, ['blob:markdownutil/test']);
    assert.deepEqual(env.timeouts, [], '失敗時に遅延解放を予約している');
  } finally {
    env.restore();
  }
});

test('openTextInNewWindow: window.open()が例外を投げた場合もfalseを返し、即座にBlob URLを解放して原因を記録する', () => {
  const env = withFakeUrlAndWindow({ throwOnOpen: true });
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  try {
    assert.equal(openTextInNewWindow('<html></html>', 'text/html'), false);
    assert.deepEqual(env.revoked, ['blob:markdownutil/test']);
    assert.equal(logs.length, 1);
    assert.match(logs[0][0], /\[MarkdownUtil\] openTextInNewWindow/);
    assert.ok(logs[0][1] instanceof Error);
  } finally {
    console.error = originalConsoleError;
    env.restore();
  }
});

test('openTextInNewWindow: Blob URL生成自体が失敗した場合もfalseを返し、URLをリークしない', () => {
  const env = withFakeUrlAndWindow({ throwOnCreateObjectURL: true });
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    assert.equal(openTextInNewWindow('<html></html>', 'text/html'), false);
    assert.deepEqual(env.revoked, [], 'URL生成前の失敗なのでrevoke対象は無い');
    assert.equal(env.opened.length, 0, 'URL生成に失敗した時点でwindow.openは呼ばれないはず');
  } finally {
    console.error = originalConsoleError;
    env.restore();
  }
});
