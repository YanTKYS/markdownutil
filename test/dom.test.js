// dom.test.js
// dom.js（v0.6.4でapp.js/help.js/preview.js/presenter.jsの重複を切り出した共通DOM処理）を
// 検証する。切り出し前にapp.js/help.jsへ直書きされていたのと同じ処理であり、
// 挙動が変わっていないことの確認が目的。

import test from 'node:test';
import assert from 'node:assert/strict';

import { createElement, hasModifierKey, setTabSelected } from '../js/dom.js';
import { installFakeDom } from './helpers/fake-dom.js';

test('createElement: タグ・クラス名・テキストを指定して要素を作る', () => {
  const dom = installFakeDom();
  try {
    const node = createElement('p', 'preview-empty', 'プレビューはここに表示されます。');

    assert.equal(node.tagName, 'P');
    assert.equal(node.className, 'preview-empty');
    assert.equal(node.textContent, 'プレビューはここに表示されます。');
  } finally {
    dom.restore();
  }
});

test('createElement: クラス名・テキストは省略できる', () => {
  const dom = installFakeDom();
  try {
    const node = createElement('div');

    assert.equal(node.tagName, 'DIV');
    assert.equal(node.className, '');
    assert.equal(node.textContent, '');
  } finally {
    dom.restore();
  }
});

test('setTabSelected: is-activeクラスとaria-selectedを同時に反映する', () => {
  const dom = installFakeDom();
  try {
    const button = dom.document.createElement('button');

    setTabSelected(button, true);
    assert.equal(button.classList.contains('is-active'), true);
    assert.equal(button.getAttribute('aria-selected'), 'true');

    setTabSelected(button, false);
    assert.equal(button.classList.contains('is-active'), false);
    assert.equal(button.getAttribute('aria-selected'), 'false');
  } finally {
    dom.restore();
  }
});

test('hasModifierKey: Ctrl/Alt/Metaのいずれかが押されていればtrue', () => {
  assert.equal(hasModifierKey({ ctrlKey: true, altKey: false, metaKey: false }), true);
  assert.equal(hasModifierKey({ ctrlKey: false, altKey: true, metaKey: false }), true);
  assert.equal(hasModifierKey({ ctrlKey: false, altKey: false, metaKey: true }), true);
  assert.equal(hasModifierKey({ ctrlKey: false, altKey: false, metaKey: false }), false);
});
