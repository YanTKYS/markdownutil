// slide-preview-render.test.js
// slide-preview.jsのMarpレンダリングと、その結果を使う出力系
// （getSlideCount / getNoteForIndex / isRenderCurrent / buildStandaloneHtml / openPrintWindow）
// を検証する。Marp Coreの同梱バンドルをそのまま読み込むため、テーマや記法の細部ではなく
// MarkdownUtil側の責務（枚数の数え方・ノートの取り出し・出力HTMLの組み立て）を対象とする。
//
// これらの関数はモジュール内の「最後のレンダリング結果」を共有するため、
// テストは実行順に依存する。node --test はファイルごとに別プロセスで実行するので、
// 状態を持たないfront matter系のテストはslide-preview-theme.test.jsへ分けている。

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFrameDocument,
  buildStandaloneHtml,
  createMessagePort,
  getNoteForIndex,
  getSlideCount,
  isRenderCurrent,
  openPrintWindow,
  render,
} from '../js/slide-preview.js';

const TWO_SLIDES = [
  '---',
  'marp: true',
  'theme: default',
  '---',
  '',
  '# 1枚目',
  '',
  '<!--',
  '1枚目のノート',
  '-->',
  '',
  '---',
  '',
  '# 2枚目',
  '',
  '- 箇条書き',
  '',
].join('\n');

/* ---- レンダリング前の状態 ---- */

test('レンダリング前: 枚数0・ノートなし・出力不可', () => {
  assert.equal(getSlideCount(), 0);
  assert.equal(getNoteForIndex(0), '');
  assert.equal(isRenderCurrent('# A'), false);
  assert.equal(buildStandaloneHtml('題名', false), null);
  assert.equal(openPrintWindow('題名'), false);
});

/* ---- buildFrameDocument（描画用ドキュメント） ---- */

test('buildFrameDocument: 既定はparentへpostMessageする', () => {
  const html = buildFrameDocument();

  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /parent\.postMessage\(message, '\*'\)/);
  assert.ok(!html.includes('window.opener.postMessage'));
  assert.match(html, /id="slides"/);
});

test('buildFrameDocument: opener指定では別ウィンドウのopenerへ返す', () => {
  const html = buildFrameDocument('opener');

  assert.match(html, /window\.opener\.postMessage\(message, '\*'\)/);
});

test('buildFrameDocument: titleと追加HTMLを埋め込み、titleはエスケープする', () => {
  const html = buildFrameDocument('parent', '<div id="extra"></div>', '発表 <資料> & メモ');

  assert.match(html, /<title>発表 &lt;資料&gt; &amp; メモ<\/title>/);
  assert.match(html, /<div id="extra"><\/div>/);
});

test('buildFrameDocument: titleを省略した場合はtitleタグを出力しない', () => {
  assert.ok(!buildFrameDocument('parent').includes('<title>'));
});

/* ---- createMessagePort（iframe / 別ウィンドウとのやり取り） ---- */

function withFakeWindow(run) {
  const listeners = [];
  const previousWindow = globalThis.window;
  const targetWindow = { posted: [], postMessage(message) { this.posted.push(message); } };

  globalThis.window = {
    addEventListener(type, listener) {
      if (type === 'message') listeners.push(listener);
    },
    removeEventListener(type, listener) {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
  };

  const emit = (event) => listeners.slice().forEach((listener) => listener(event));

  try {
    run({ targetWindow, emit, listenerCount: () => listeners.length });
  } finally {
    globalThis.window = previousWindow;
  }
}

test('createMessagePort: ready前の送信は待ち行列に入り、ready後にまとめて送られる', () => {
  withFakeWindow(({ targetWindow, emit }) => {
    const readyCalls = [];
    const port = createMessagePort(() => targetWindow, { onReady: () => readyCalls.push(true) });

    port.send({ type: 'render', html: '<a>' });
    port.send({ type: 'goto', index: 1 });
    assert.deepEqual(targetWindow.posted, []);

    emit({ source: targetWindow, data: { type: 'ready' } });

    assert.deepEqual(targetWindow.posted, [{ type: 'render', html: '<a>' }, { type: 'goto', index: 1 }]);
    assert.equal(readyCalls.length, 1);

    port.send({ type: 'single', single: true });
    assert.deepEqual(targetWindow.posted.at(-1), { type: 'single', single: true });
  });
});

test('createMessagePort: 相手以外からのメッセージと非オブジェクトは無視する', () => {
  withFakeWindow(({ targetWindow, emit }) => {
    const received = [];
    const port = createMessagePort(() => targetWindow, { onMessage: (message) => received.push(message) });

    emit({ source: { other: true }, data: { type: 'ready' } });
    emit({ source: targetWindow, data: 'ready' });
    emit({ source: targetWindow, data: null });
    port.send({ type: 'goto', index: 0 });

    assert.deepEqual(received, []);
    assert.deepEqual(targetWindow.posted, [], 'readyになっていないのに送信された');

    emit({ source: targetWindow, data: { type: 'ready' } });
    emit({ source: targetWindow, data: { type: 'keydown', key: 'ArrowRight' } });

    assert.deepEqual(received, [{ type: 'keydown', key: 'ArrowRight' }]);
  });
});

test('createMessagePort: resetで待ち行列と準備状態を初期化する', () => {
  withFakeWindow(({ targetWindow, emit }) => {
    const port = createMessagePort(() => targetWindow);

    emit({ source: targetWindow, data: { type: 'ready' } });
    port.reset();
    port.send({ type: 'goto', index: 2 });

    assert.deepEqual(targetWindow.posted, [], 'reset後もready扱いのまま送信された');

    emit({ source: targetWindow, data: { type: 'ready' } });
    assert.deepEqual(targetWindow.posted, [{ type: 'goto', index: 2 }]);
  });
});

test('createMessagePort: destroyでmessageリスナーを外す', () => {
  withFakeWindow(({ targetWindow, emit, listenerCount }) => {
    const received = [];
    const port = createMessagePort(() => targetWindow, { onMessage: (message) => received.push(message) });

    assert.equal(listenerCount(), 1);
    port.destroy();
    assert.equal(listenerCount(), 0);

    emit({ source: targetWindow, data: { type: 'click' } });
    assert.deepEqual(received, []);
  });
});

/* ---- render（Marpレンダリング） ---- */

test('render: スライド枚数とスピーカーノートを取り出す', async () => {
  const result = await render(TWO_SLIDES);

  assert.deepEqual(result, { slideCount: 2, error: null });
  assert.equal(getSlideCount(), 2);
  assert.equal(getNoteForIndex(0), '1枚目のノート');
  assert.equal(getNoteForIndex(1), '');
  assert.equal(getNoteForIndex(-1), '');
  assert.equal(getNoteForIndex(99), '');
});

test('isRenderCurrent: 表示中のスライドが今のMarkdownと一致するかを返す', async () => {
  await render(TWO_SLIDES);

  assert.equal(isRenderCurrent(TWO_SLIDES), true);
  assert.equal(isRenderCurrent(`${TWO_SLIDES}\n# 追記\n`), false);
});

test('render: 解析に失敗した場合はエラーを返し、出力を許可しない', async () => {
  await render(TWO_SLIDES);

  // Marpはfront matterのYAMLの多少の崩れを読み飛ばすため、Marp自体が例外を投げる入力
  // （文字列以外）でエラー経路を確認する。
  const result = await render(123);

  assert.equal(result.error, 'Markdownを解析できませんでした。front matterの書式を確認してください。');
  assert.equal(result.slideCount, 2, '解析失敗時は直前の枚数を保つ');
  assert.equal(isRenderCurrent(TWO_SLIDES), false, '解析失敗後は古いMarkdownとも一致させない');
});

test('render: front matterのYAMLが多少崩れていてもMarp側が読み飛ばす', async () => {
  const result = await render('---\nmarp: true\ntheme: [壊れた\n---\n\n# A\n');

  assert.equal(result.error, null);
  assert.equal(result.slideCount, 1);
});

test('render: 空のMarkdownでもエラーにならない', async () => {
  const result = await render('');

  assert.equal(result.error, null);
  assert.equal(isRenderCurrent(''), true);
});

/* ---- buildStandaloneHtml / openPrintWindow（HTML出力・印刷） ---- */

test('buildStandaloneHtml: 単体で開けるスライドショーHTMLを組み立てる', async () => {
  await render(TWO_SLIDES);
  const html = buildStandaloneHtml('会議資料', false);

  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<title>会議資料<\/title>/);
  assert.match(html, /<div class="slideshow">/);
  assert.equal((html.match(/data-marpit-svg/g) || []).length >= 2, true);
  assert.match(html, /id="ss-next"/);
  assert.match(html, /id="ss-prev"/);
  assert.match(html, /id="ss-notes"/);
  assert.match(html, /1枚目のノート/, 'スピーカーノートが埋め込まれていない');
  assert.ok(!html.includes('window.print()'), '自動印刷しない指定なのにprintが埋め込まれている');
});

test('buildStandaloneHtml: 題名はHTMLエスケープする', async () => {
  await render(TWO_SLIDES);
  const html = buildStandaloneHtml('<script>alert("x")</script>', false);

  assert.match(html, /<title>&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;<\/title>/);
});

test('buildStandaloneHtml: ノート内の</script>はエスケープしてスクリプトを抜けさせない', async () => {
  await render('---\nmarp: true\n---\n\n# A\n\n<!--\n</script><script>alert(1)</script>\n-->\n');
  const html = buildStandaloneHtml('題名', false);

  assert.ok(!html.includes('</script><script>alert(1)'), 'ノートからscriptタグを抜け出せている');
  assert.match(html, /<\\\/script>/);
});

test('buildStandaloneHtml: autoPrintでは読み込み時に印刷ダイアログを開く', async () => {
  await render(TWO_SLIDES);
  const html = buildStandaloneHtml('会議資料', true);

  assert.match(html, /window\.addEventListener\("load", function \(\) \{ window\.print\(\); \}\)/);
});

test('buildStandaloneHtml: 印刷用の@pageサイズにスライドの寸法を使う', async () => {
  await render(TWO_SLIDES);
  const html = buildStandaloneHtml('会議資料', false);

  assert.match(html, /@page \{ size: 1280px 720px; margin: 0; \}/);
});

test('openPrintWindow: 印刷用HTMLのBlob URLを新しいウィンドウで開く', async () => {
  await render(TWO_SLIDES);

  const previousWindow = globalThis.window;
  const previousUrl = globalThis.URL;
  const opened = [];
  const revoked = [];
  const timeouts = [];

  globalThis.window = {
    open(url, target) {
      opened.push({ url, target });
      return { focus() {} };
    },
    setTimeout(callback, delay) {
      timeouts.push(delay);
      return 1;
    },
  };
  globalThis.URL = class extends previousUrl {
    static createObjectURL(blob) {
      globalThis.URL.lastBlob = blob;
      return 'blob:markdownutil/print';
    }

    static revokeObjectURL(url) {
      revoked.push(url);
    }
  };

  try {
    assert.equal(openPrintWindow('会議資料'), true);
    assert.deepEqual(opened, [{ url: 'blob:markdownutil/print', target: '_blank' }]);
    assert.equal(globalThis.URL.lastBlob.type, 'text/html;charset=utf-8');
    assert.deepEqual(timeouts, [60000]);
    assert.deepEqual(revoked, [], 'Blob URLは一定時間後に解放する想定');

    globalThis.window.open = () => null; // ポップアップブロック時
    assert.equal(openPrintWindow('会議資料'), false);
  } finally {
    globalThis.window = previousWindow;
    globalThis.URL = previousUrl;
  }
});
