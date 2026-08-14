// postmessage-security.test.js
// v0.6.4で取り込んだPR#21のセキュリティ強化（postMessageの送信元window・オリジン検証）を
// createMessagePort()に対して検証する。iframe/別ウィンドウ経由の描画指示（render等）を
// 他オリジンのページに偽装されないこと、送信時も自分のオリジンを指定していることを確認する。
// PR#19（v0.6.3）のエラー処理（1つの送信先へのpostMessage失敗が他の送信先への同期まで
// 止めないこと）が、このorigin検証を追加した後も維持されていることも合わせて確認する。

import test from 'node:test';
import assert from 'node:assert/strict';

import { createMessagePort } from '../js/slide-preview.js';

/**
 * createMessagePort()向けの最小限のグローバルwindow代用。
 * @param {{ origin?: string }} [options] 本体（MarkdownUtil）側のオリジン。
 *   未指定（undefined）のままだと、既存の（origin検証を追加する前からの）テストと
 *   同じ「送信先オリジンを検証しない」経路になる。
 */
function withFakeWindow({ origin } = {}, run) {
  const listeners = [];
  const previousWindow = globalThis.window;

  globalThis.window = {
    origin,
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
    run({ emit, listenerCount: () => listeners.length });
  } finally {
    globalThis.window = previousWindow;
  }
}

function makeTargetWindow() {
  return { posted: [], postedOrigins: [], postMessage(message, origin) {
    this.posted.push(message);
    this.postedOrigins.push(origin);
  } };
}

test('createMessagePort: 送信元windowとオリジンが一致するreadyメッセージは受け付ける', () => {
  withFakeWindow({ origin: 'http://127.0.0.1:8801' }, ({ emit }) => {
    const targetWindow = makeTargetWindow();
    const readyCalls = [];
    const port = createMessagePort(() => targetWindow, { onReady: () => readyCalls.push(true) });

    port.send({ type: 'render', html: '<a>' });
    emit({ source: targetWindow, origin: 'http://127.0.0.1:8801', data: { type: 'ready' } });

    assert.equal(readyCalls.length, 1);
    assert.deepEqual(targetWindow.posted, [{ type: 'render', html: '<a>' }]);
  });
});

test('createMessagePort: 送信元windowが自分の描画先と一致しないメッセージは拒否する', () => {
  withFakeWindow({ origin: 'http://127.0.0.1:8801' }, ({ emit }) => {
    const targetWindow = makeTargetWindow();
    const impostorWindow = makeTargetWindow();
    const readyCalls = [];
    const received = [];
    const port = createMessagePort(() => targetWindow, {
      onReady: () => readyCalls.push(true),
      onMessage: (message) => received.push(message),
    });

    // 他オリジンのページがwindow.open()等でMarkdownUtilの窓を取得し、
    // 自分のwindowをsourceとしてreadyや任意のメッセージを偽装しても処理しない。
    emit({ source: impostorWindow, origin: 'http://127.0.0.1:8801', data: { type: 'ready' } });
    emit({ source: impostorWindow, origin: 'http://127.0.0.1:8801', data: { type: 'keydown', key: 'Escape' } });

    assert.equal(readyCalls.length, 0, '偽装元からのreadyを受け付けている');
    assert.deepEqual(received, []);
    assert.equal(port.send !== undefined, true);
  });
});

test('createMessagePort: 送信元windowが一致していてもオリジンが異なれば拒否する', () => {
  withFakeWindow({ origin: 'http://127.0.0.1:8801' }, ({ emit }) => {
    const targetWindow = makeTargetWindow();
    const readyCalls = [];
    const port = createMessagePort(() => targetWindow, { onReady: () => readyCalls.push(true) });

    port.send({ type: 'render', html: '<a>' });
    // sourceは正しいiframe/別ウィンドウそのものだが、オリジンが自分（本体）と異なる場合
    // （＝file://等でoriginが無い相手にすり替わっている等）は受け付けない。
    emit({ source: targetWindow, origin: 'https://evil.example', data: { type: 'ready' } });

    assert.equal(readyCalls.length, 0, '異なるoriginからのreadyを受け付けている');
    assert.deepEqual(targetWindow.posted, [], 'readyになっていないのに送信された');
  });
});

test('createMessagePort: 送信時は本体自身のオリジンを送信先として指定する（`*`を使わない）', () => {
  withFakeWindow({ origin: 'http://127.0.0.1:8801' }, ({ emit }) => {
    const targetWindow = makeTargetWindow();
    const port = createMessagePort(() => targetWindow);

    emit({ source: targetWindow, origin: 'http://127.0.0.1:8801', data: { type: 'ready' } });
    port.send({ type: 'goto', index: 1 });

    assert.deepEqual(targetWindow.postedOrigins, ['http://127.0.0.1:8801']);
  });
});

test('createMessagePort: originが不明（file://相当）な場合は送信先に`*`を使う', () => {
  withFakeWindow({ origin: 'null' }, ({ emit }) => {
    const targetWindow = makeTargetWindow();
    const port = createMessagePort(() => targetWindow);

    emit({ source: targetWindow, origin: 'null', data: { type: 'ready' } });
    port.send({ type: 'goto', index: 0 });

    assert.deepEqual(targetWindow.postedOrigins, ['*']);
  });
});

test('createMessagePort: origin検証を追加しても、1つの送信先へのpostMessage失敗は他の送信先の同期を止めない（v0.6.3のエラー処理を維持）', () => {
  withFakeWindow({ origin: 'http://127.0.0.1:8801' }, ({ emit }) => {
    const originalConsoleError = console.error;
    const logs = [];
    console.error = (...args) => logs.push(args);

    try {
      const failingWindow = { postMessage() { throw new Error('postMessage denied'); } };
      const workingWindow = makeTargetWindow();
      const failingPort = createMessagePort(() => failingWindow);
      const workingPort = createMessagePort(() => workingWindow);

      emit({ source: failingWindow, origin: 'http://127.0.0.1:8801', data: { type: 'ready' } });
      emit({ source: workingWindow, origin: 'http://127.0.0.1:8801', data: { type: 'ready' } });

      // 1つ目の描画先が例外を投げても、ここで送信処理自体は落ちない。
      assert.doesNotThrow(() => failingPort.send({ type: 'render', html: '<a>' }));
      workingPort.send({ type: 'render', html: '<a>' });

      assert.equal(logs.length, 1);
      assert.match(logs[0][0], /\[MarkdownUtil\] createMessagePort/);
      assert.deepEqual(workingWindow.posted, [{ type: 'render', html: '<a>' }], '他の送信先への同期まで止まっている');
    } finally {
      console.error = originalConsoleError;
    }
  });
});
