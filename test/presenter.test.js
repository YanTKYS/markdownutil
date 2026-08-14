// presenter.test.js
// presenter.js（プレゼン表示：投影用の別ウィンドウ＋本体側の発表者ビュー）を検証する。
// 実ブラウザのDOM・ウィンドウの代わりにtest/helpers/fake-dom.jsを使い、
// 「発表という状態」と「複数の表示先を同じ位置へ同期させること」というこのモジュールの
// 責務そのもの（位置表示・ノート表示・前後ボタンの活性・別ウィンドウへのpostMessage・
// 終了処理）を確認する。Marpの描画自体はslide-preview.js側の責務なのでここでは扱わない。

import test from 'node:test';
import assert from 'node:assert/strict';

import { end, init, isPresenting, start } from '../js/presenter.js';
import { render } from '../js/slide-preview.js';
import {
  FakeElement,
  FakeIframe,
  installFakeDom,
  installFakeWindow,
} from './helpers/fake-dom.js';

const THREE_SLIDES = [
  '---',
  'marp: true',
  '---',
  '',
  '# 1枚目',
  '',
  '<!-- 1枚目のノート -->',
  '',
  '---',
  '',
  '# 2枚目',
  '',
  '---',
  '',
  '# 3枚目',
  '',
].join('\n');

/**
 * 発表者ビューのDOMとwindowを用意し、presenter.initまで済ませた状態を作る。
 * presenter.jsはモジュール内に発表状態を持つため、各テストの最後に必ずend()する。
 */
async function setupPresenter({ markdown = THREE_SLIDES } = {}) {
  // Marp Coreの初期化は本物のブラウザのdocumentを前提とするため、
  // 代用DOMを差し込む前にレンダリングを済ませておく。
  if (markdown !== null) await render(markdown);
  const dom = installFakeDom();
  const win = installFakeWindow();

  const els = {
    currentFrame: new FakeIframe(),
    nextFrame: new FakeIframe(),
    notesEl: new FakeElement('div'),
    positionEl: new FakeElement('span'),
    prevBtn: new FakeElement('button'),
    nextBtn: new FakeElement('button'),
    endBtn: new FakeElement('button'),
  };
  init(els);

  /** iframe / 別ウィンドウを「読み込み完了（ready）」にして、待ち行列を流す。 */
  const markReady = () => {
    win.emit('message', { source: els.currentFrame.contentWindow, data: { type: 'ready' } });
    win.emit('message', { source: els.nextFrame.contentWindow, data: { type: 'ready' } });
    const popup = win.lastOpened();
    if (popup) win.emit('message', { source: popup, data: { type: 'ready' } });
  };

  const gotoMessages = (target) => target.posted.filter((message) => message.type === 'goto');

  return {
    els,
    win,
    markReady,
    gotoMessages,
    popup: () => win.lastOpened(),
    cleanup() {
      end();
      win.restore();
      dom.restore();
    },
  };
}

// このテストはレンダリング前の状態を見るため、必ず最初に実行されること
// （presenter.js / slide-preview.js はモジュール内に状態を持つ）。
test('start: まだレンダリングしていなければ開始しない', async () => {
  const context = await setupPresenter({ markdown: null });
  try {
    assert.equal(start(), false);
    assert.equal(isPresenting(), false);
    assert.equal(context.win.openedWindows.length, 0);
  } finally {
    context.cleanup();
  }
});

test('start: 投影用の別ウィンドウを開き、発表者ビューを発表中にする', async () => {
  const context = await setupPresenter();
  try {
    assert.equal(isPresenting(), false);
    assert.equal(start(), true);
    assert.equal(isPresenting(), true);

    const [opened] = context.win.openedWindows;
    assert.equal(opened.name, 'markdownutil-presenter');
    assert.match(opened.features, /width=1024,height=640/);
    assert.match(context.popup().written, /^<!DOCTYPE html>/);
    assert.match(context.popup().written, /window\.opener\.postMessage/);
    assert.match(context.popup().written, /<title>MarkdownUtil プレゼン<\/title>/);
    assert.match(context.popup().written, /id="mu-fullscreen-btn"/);
    assert.equal(document.body.classList.contains('is-presenting'), true);
  } finally {
    context.cleanup();
  }
});

test('start: 2回目の呼び出しでは別ウィンドウを開き直さない', async () => {
  const context = await setupPresenter();
  try {
    assert.equal(start(), true);
    assert.equal(start(), true);

    assert.equal(context.win.openedWindows.length, 1);
  } finally {
    context.cleanup();
  }
});

test('start: ポップアップがブロックされた場合はfalseを返す', async () => {
  const context = await setupPresenter();
  try {
    context.win.setOpenResult(null);

    assert.equal(start(), false);
    assert.equal(isPresenting(), false);
    assert.equal(document.body.classList.contains('is-presenting'), false);
  } finally {
    context.cleanup();
  }
});

test('start: 1枚目の位置・ノート・ボタン状態を発表者ビューへ反映する', async () => {
  const context = await setupPresenter();
  try {
    start();

    assert.equal(context.els.positionEl.textContent, '1 / 3');
    assert.equal(context.els.notesEl.textContent, '1枚目のノート');
    assert.equal(context.els.prevBtn.disabled, true, '1枚目では「前へ」を押せないはず');
    assert.equal(context.els.nextBtn.disabled, false);
  } finally {
    context.cleanup();
  }
});

test('start: 現在・次スライドのiframeと別ウィンドウを同じ位置へ同期する', async () => {
  const context = await setupPresenter();
  try {
    start();
    context.markReady();

    const current = context.els.currentFrame.contentWindow.posted;
    const next = context.els.nextFrame.contentWindow.posted;

    assert.deepEqual(current.filter((m) => m.type === 'single'), [{ type: 'single', single: true }]);
    assert.deepEqual(context.gotoMessages(context.els.currentFrame.contentWindow), [{ type: 'goto', index: 0 }]);
    assert.deepEqual(context.gotoMessages(context.els.nextFrame.contentWindow), [{ type: 'goto', index: 1 }]);
    assert.ok(current.some((m) => m.type === 'render' && m.html && m.css), '描画内容が送られていない');
    assert.ok(next.some((m) => m.type === 'empty' && m.empty === false));
    assert.deepEqual(context.gotoMessages(context.popup()), [{ type: 'goto', index: 0 }]);
  } finally {
    context.cleanup();
  }
});

test('次へ/前へボタン: 位置を進め、両端では止まる', async () => {
  const context = await setupPresenter();
  try {
    start();
    context.markReady();

    context.els.nextBtn.dispatch('click');
    assert.equal(context.els.positionEl.textContent, '2 / 3');
    assert.equal(context.els.prevBtn.disabled, false);
    assert.equal(context.els.notesEl.textContent, 'スピーカーノートはありません');

    context.els.nextBtn.dispatch('click');
    assert.equal(context.els.positionEl.textContent, '3 / 3');
    assert.equal(context.els.nextBtn.disabled, true, '最後のスライドでは「次へ」を押せないはず');

    context.els.nextBtn.dispatch('click');
    assert.equal(context.els.positionEl.textContent, '3 / 3', '最後より先へ進んでいる');

    context.els.prevBtn.dispatch('click');
    assert.equal(context.els.positionEl.textContent, '2 / 3');

    context.els.prevBtn.dispatch('click');
    context.els.prevBtn.dispatch('click');
    assert.equal(context.els.positionEl.textContent, '1 / 3', '1枚目より前へ戻っている');
  } finally {
    context.cleanup();
  }
});

test('最後のスライドでは「次のスライド」欄を空表示にする', async () => {
  const context = await setupPresenter();
  try {
    start();
    context.markReady();

    context.els.nextBtn.dispatch('click');
    context.els.nextBtn.dispatch('click');

    const lastEmpty = context.els.nextFrame.contentWindow.posted
      .filter((message) => message.type === 'empty')
      .at(-1);
    assert.deepEqual(lastEmpty, { type: 'empty', empty: true, message: 'これが最後のスライドです' });
  } finally {
    context.cleanup();
  }
});

test('キー操作: 発表中は前後移動・先頭/末尾移動・Escapeで終了できる', async () => {
  const context = await setupPresenter();
  try {
    start();
    context.markReady();

    const press = (key, extra = {}) => {
      let prevented = false;
      context.win.emit('keydown', { key, preventDefault: () => { prevented = true; }, ...extra });
      return prevented;
    };

    assert.equal(press('ArrowRight'), true);
    assert.equal(context.els.positionEl.textContent, '2 / 3');
    assert.equal(press('PageDown'), true);
    assert.equal(context.els.positionEl.textContent, '3 / 3');
    assert.equal(press('ArrowUp'), true);
    assert.equal(context.els.positionEl.textContent, '2 / 3');
    assert.equal(press('Home'), true);
    assert.equal(context.els.positionEl.textContent, '1 / 3');
    assert.equal(press('End'), true);
    assert.equal(context.els.positionEl.textContent, '3 / 3');
    assert.equal(press(' ', { shiftKey: true }), true);
    assert.equal(context.els.positionEl.textContent, '2 / 3');

    assert.equal(press('a'), false, '割り当てのないキーで既定動作を止めている');
    assert.equal(press('ArrowRight', { ctrlKey: true }), false, 'Ctrl併用はブラウザ操作として通すはず');

    assert.equal(press('Escape'), true);
    assert.equal(isPresenting(), false);
  } finally {
    context.cleanup();
  }
});

test('キー操作: 発表中でなければ何もしない', async () => {
  const context = await setupPresenter();
  try {
    let prevented = false;
    context.win.emit('keydown', { key: 'ArrowRight', preventDefault: () => { prevented = true; } });

    assert.equal(prevented, false);
    assert.equal(context.els.positionEl.textContent, '');
  } finally {
    context.cleanup();
  }
});

test('別ウィンドウからのキー操作・クリックを本体側で処理する', async () => {
  const context = await setupPresenter();
  try {
    start();
    context.markReady();
    const popup = context.popup();

    context.win.emit('message', { source: popup, data: { type: 'keydown', key: 'ArrowRight' } });
    assert.equal(context.els.positionEl.textContent, '2 / 3');

    context.win.emit('message', { source: popup, data: { type: 'click' } });
    assert.equal(context.els.positionEl.textContent, '3 / 3');
  } finally {
    context.cleanup();
  }
});

test('終了ボタン: 別ウィンドウを閉じ、発表中の表示を戻す', async () => {
  const context = await setupPresenter();
  try {
    start();
    const popup = context.popup();

    context.els.endBtn.dispatch('click');

    assert.equal(isPresenting(), false);
    assert.equal(popup.closed, true, '別ウィンドウが閉じられていない');
    assert.equal(document.body.classList.contains('is-presenting'), false);
    assert.equal(context.win.timerCount(), 0, '別ウィンドウの監視タイマーが残っている');
  } finally {
    context.cleanup();
  }
});

test('別ウィンドウが利用者に閉じられた場合は発表を終了する', async () => {
  const context = await setupPresenter();
  try {
    start();
    const popup = context.popup();
    assert.equal(context.win.timerCount(), 1, '別ウィンドウの監視タイマーが動いていない');

    popup.closed = true;
    context.win.runTimers();

    assert.equal(isPresenting(), false);
    assert.equal(document.body.classList.contains('is-presenting'), false);
  } finally {
    context.cleanup();
  }
});

test('end: 発表していない状態で呼んでも何も起きない', async () => {
  const context = await setupPresenter();
  try {
    end();

    assert.equal(isPresenting(), false);
    assert.equal(context.win.openedWindows.length, 0);
  } finally {
    context.cleanup();
  }
});

test('本体画面を離れるときは投影用ウィンドウも閉じる', async () => {
  const context = await setupPresenter();
  try {
    start();
    const popup = context.popup();

    context.win.emit('beforeunload', {});

    assert.equal(popup.closed, true);
  } finally {
    context.cleanup();
  }
});
