// clipboard.test.js
// clipboard.jsのコピー処理を検証する。Clipboard APIが使える場合・使えない場合
// （HTTP配信の古いブラウザ等でexecCommandへ切り替わる場合）・どちらも失敗した場合の
// 3経路を、test/helpers/fake-dom.jsの簡易DOMで確認する。

import test from 'node:test';
import assert from 'node:assert/strict';

import { copyText } from '../js/clipboard.js';
import { installFakeDom } from './helpers/fake-dom.js';

test('copyText: Clipboard APIが使える場合はwriteTextを使う', async () => {
  const written = [];
  const dom = installFakeDom({ clipboard: { writeText: async (text) => written.push(text) } });
  try {
    assert.equal(await copyText('コピーする文字列'), true);
    assert.deepEqual(written, ['コピーする文字列']);
    assert.equal(dom.createdElements.length, 0, '代替のtextareaを作る必要はない');
  } finally {
    dom.restore();
  }
});

test('copyText: Clipboard APIが無い場合はtextarea + execCommandへ切り替える', async () => {
  const commands = [];
  const dom = installFakeDom({
    clipboard: null,
    execCommand: (command) => {
      commands.push(command);
      return true;
    },
  });
  try {
    assert.equal(await copyText('代替経路'), true);
    assert.deepEqual(commands, ['copy']);

    const [textarea] = dom.createdElements;
    assert.equal(textarea.tagName, 'TEXTAREA');
    assert.equal(textarea.value, '代替経路');
    assert.equal(textarea.focused, true);
    assert.equal(textarea.selected, true);
    assert.equal(textarea.style.position, 'fixed');
    assert.equal(textarea.style.opacity, '0');
    assert.deepEqual(dom.document.body.children, [], '一時的なtextareaが残っている');
  } finally {
    dom.restore();
  }
});

test('copyText: execCommandが失敗した場合はfalseを返し、textareaを片付ける', async () => {
  const dom = installFakeDom({ clipboard: null, execCommand: () => false });
  try {
    assert.equal(await copyText('失敗する'), false);
    assert.deepEqual(dom.document.body.children, [], '一時的なtextareaが残っている');
  } finally {
    dom.restore();
  }
});

test('copyText: execCommandが例外を投げてもfalseを返し、textareaを片付ける', async () => {
  const dom = installFakeDom({
    clipboard: null,
    execCommand: () => {
      throw new Error('not allowed');
    },
  });
  try {
    assert.equal(await copyText('例外'), false);
    assert.deepEqual(dom.document.body.children, []);
  } finally {
    dom.restore();
  }
});

test('copyText: writeTextが拒否された場合はfalseを返す（代替へは切り替えない）', async () => {
  const dom = installFakeDom({
    clipboard: { writeText: async () => { throw new Error('denied'); } },
    execCommand: () => true,
  });
  try {
    assert.equal(await copyText('拒否'), false);
    assert.equal(dom.createdElements.length, 0);
  } finally {
    dom.restore();
  }
});

test('copyText: 空文字もコピー対象として扱う', async () => {
  const written = [];
  const dom = installFakeDom({ clipboard: { writeText: async (text) => written.push(text) } });
  try {
    assert.equal(await copyText(''), true);
    assert.deepEqual(written, ['']);
  } finally {
    dom.restore();
  }
});
