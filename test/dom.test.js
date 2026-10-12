// dom.test.js
// dom.js（app.js/help.js/preview.js/presenter.jsで共用する機能非依存のDOM処理）を検証する。

import test from 'node:test';
import assert from 'node:assert/strict';

import { bindTabArrowKeys, createElement, hasModifierKey, setTabSelected } from '../js/dom.js';
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

function setupTabs(dom, count) {
  const clicked = [];
  const tabs = Array.from({ length: count }, (_, index) => {
    const tab = dom.document.createElement('button');
    tab.addEventListener('click', () => clicked.push(index));
    return tab;
  });
  bindTabArrowKeys(tabs);
  return { tabs, clicked };
}

function press(tab, key, extra = {}) {
  const event = { key, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, defaultPrevented: false, ...extra };
  event.preventDefault = () => { event.defaultPrevented = true; };
  tab.dispatch('keydown', event);
  return event;
}

test('bindTabArrowKeys: ←/→で隣のタブへフォーカスを移して選択し、端では折り返す', () => {
  const dom = installFakeDom();
  try {
    const { tabs, clicked } = setupTabs(dom, 3);

    const right = press(tabs[0], 'ArrowRight');
    assert.equal(right.defaultPrevented, true);
    assert.equal(tabs[1].focused, true);
    press(tabs[2], 'ArrowRight');
    press(tabs[0], 'ArrowLeft');

    assert.deepEqual(clicked, [1, 0, 2]);
  } finally {
    dom.restore();
  }
});

test('bindTabArrowKeys: Home/Endで先頭・末尾のタブへ移動する', () => {
  const dom = installFakeDom();
  try {
    const { tabs, clicked } = setupTabs(dom, 3);

    press(tabs[1], 'End');
    press(tabs[1], 'Home');

    assert.deepEqual(clicked, [2, 0]);
  } finally {
    dom.restore();
  }
});

test('bindTabArrowKeys: 他のキー・修飾キー付きの操作には反応しない', () => {
  const dom = installFakeDom();
  try {
    const { tabs, clicked } = setupTabs(dom, 2);

    const tab = press(tabs[0], 'Tab');
    const enter = press(tabs[0], 'Enter');
    const alt = press(tabs[0], 'ArrowRight', { altKey: true });

    assert.deepEqual(clicked, []);
    assert.equal(tab.defaultPrevented, false);
    assert.equal(enter.defaultPrevented, false);
    assert.equal(alt.defaultPrevented, false);
  } finally {
    dom.restore();
  }
});
