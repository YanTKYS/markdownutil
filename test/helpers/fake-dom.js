// fake-dom.js
// Node上でDOMを使うモジュール（clipboard.js・preview.jsのupdatePreview・presenter.js）を
// 検証するための最小限のDOMの代用。jsdom等を追加すると「依存パッケージなし」という
// 閉域環境向けの前提が崩れるため、テストが実際に使うAPI（createElement・appendChild・
// textContent・innerHTML・classList・addEventListener・execCommand・navigator.clipboard・
// window.open / setInterval）だけを手作りで用意する。

class FakeClassList {
  constructor() {
    this.tokens = new Set();
  }

  add(token) {
    this.tokens.add(token);
  }

  remove(token) {
    this.tokens.delete(token);
  }

  toggle(token, force) {
    const shouldAdd = typeof force === 'boolean' ? force : !this.tokens.has(token);
    if (shouldAdd) this.tokens.add(token);
    else this.tokens.delete(token);
    return shouldAdd;
  }

  contains(token) {
    return this.tokens.has(token);
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.style = {};
    this.className = '';
    this.classList = new FakeClassList();
    this.dataset = {};
    this.value = '';
    this.disabled = false;
    this.hidden = false;
    this.focused = false;
    this.selected = false;
    this.listeners = new Map();
    this._textContent = '';
    this.innerHTML = null;
    this.attributes = {};
  }

  /** dom.js の setTabSelected() 等、`aria-*` 属性の反映確認に使う。 */
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }

  get textContent() {
    if (this.children.length > 0) return this.children.map((child) => child.textContent).join('');
    return this._textContent;
  }

  set textContent(value) {
    this.children = [];
    this._textContent = String(value);
  }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  removeChild(child) {
    this.children = this.children.filter((entry) => entry !== child);
    child.parentNode = null;
    return child;
  }

  /** download.js の downloadBlob() 等、`link.remove()` の呼び出しに対応する。 */
  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  click() {
    this.dispatch('click');
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    const index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
  }

  /** テストからクリック等を発火させる。 */
  dispatch(type, event = {}) {
    (this.listeners.get(type) || []).slice().forEach((listener) => listener({ target: this, ...event }));
  }

  focus() {
    this.focused = true;
  }

  select() {
    this.selected = true;
  }
}

/** iframe相当。srcdocを設定するとcontentWindowが差し替わる（実ブラウザと同じ扱い）。 */
class FakeIframe extends FakeElement {
  constructor() {
    super('iframe');
    this._srcdoc = '';
    this.contentWindow = null;
  }

  get srcdoc() {
    return this._srcdoc;
  }

  set srcdoc(value) {
    this._srcdoc = value;
    this.contentWindow = {
      posted: [],
      postedOrigins: [],
      postMessage(message, origin) {
        this.posted.push(message);
        this.postedOrigins.push(origin);
      },
    };
  }
}

/**
 * グローバルの`document`（と任意で`navigator`）を差し替える。
 * @param {{ execCommand?: (command: string) => boolean, clipboard?: object|null }} [options]
 * @returns {{ document: object, restore: () => void, createdElements: FakeElement[] }}
 */
export function installFakeDom({ execCommand, clipboard } = {}) {
  const createdElements = [];
  const body = new FakeElement('body');
  const fakeDocument = {
    body,
    createElement(tagName) {
      const element = new FakeElement(tagName);
      createdElements.push(element);
      return element;
    },
    execCommand: execCommand || (() => false),
  };

  const previousDocument = globalThis.document;
  const previousNavigator = globalThis.navigator;
  const hadNavigator = 'navigator' in globalThis;

  globalThis.document = fakeDocument;
  if (clipboard !== undefined) {
    // Node 20以降の`navigator`はgetterのみのため、定義し直して差し替える。
    Object.defineProperty(globalThis, 'navigator', {
      value: clipboard === null ? {} : { clipboard },
      configurable: true,
      writable: true,
    });
  }

  return {
    document: fakeDocument,
    createdElements,
    restore() {
      globalThis.document = previousDocument;
      if (clipboard !== undefined) {
        if (hadNavigator) {
          Object.defineProperty(globalThis, 'navigator', {
            value: previousNavigator,
            configurable: true,
            writable: true,
          });
        } else {
          delete globalThis.navigator;
        }
      }
    },
  };
}

/**
 * グローバルの`window`を差し替える。messageイベントの発火、window.openで開かれた
 * 別ウィンドウ、setInterval/clearIntervalの手動実行をテストから操作できるようにする。
 * @param {{ openResult?: object|null, origin?: string }} [options]
 */
export function installFakeWindow({ openResult, origin } = {}) {
  const listeners = new Map();
  const intervals = new Map();
  const openedWindows = [];
  let nextTimerId = 1;
  let openReturns = openResult;

  const fakeWindow = {
    // 未指定（undefined）のままにしておくと、srcdoc iframe/window.open()経由の
    // postMessage先オリジン判定（`window.origin && window.origin !== 'null' ? ... : '*'`）が
    // 既存テストの挙動（送信先を'*'として扱う）と変わらない。origin検証を確認する
    // テストだけが明示的に値を指定する。
    origin,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      const registered = listeners.get(type) || [];
      const index = registered.indexOf(listener);
      if (index >= 0) registered.splice(index, 1);
    },
    open(url, name, features) {
      const opened = openReturns === undefined ? createFakePopup() : openReturns;
      openedWindows.push({ url, name, features, window: opened });
      return opened;
    },
    setInterval(callback, delay) {
      const id = nextTimerId;
      nextTimerId += 1;
      intervals.set(id, { callback, delay });
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    setTimeout(callback, delay) {
      const id = nextTimerId;
      nextTimerId += 1;
      intervals.set(id, { callback, delay, once: true });
      return id;
    },
    clearTimeout(id) {
      intervals.delete(id);
    },
  };

  const previousWindow = globalThis.window;
  globalThis.window = fakeWindow;

  return {
    window: fakeWindow,
    openedWindows,
    /** 最後にwindow.openで開かれた別ウィンドウ。 */
    lastOpened: () => openedWindows.at(-1)?.window ?? null,
    /** 次回以降のwindow.openの戻り値を差し替える（nullでポップアップブロックを再現）。 */
    setOpenResult(value) {
      openReturns = value;
    },
    emit(type, event) {
      (listeners.get(type) || []).slice().forEach((listener) => listener(event));
    },
    listenerCount: (type) => (listeners.get(type) || []).length,
    /** 登録中のインターバル/タイマーのコールバックを1回ずつ実行する。 */
    runTimers() {
      [...intervals.entries()].forEach(([id, timer]) => {
        timer.callback();
        if (timer.once) intervals.delete(id);
      });
    },
    timerCount: () => intervals.size,
    restore() {
      globalThis.window = previousWindow;
    },
  };
}

/**
 * window.openで開かれる別ウィンドウの代用（document.write可・closed監視可）。
 * @param {{ writeThrows?: boolean }} [options] document.write()を例外にする場合はtrue
 *   （プレゼン用ウィンドウの初期化失敗を再現する）。
 */
export function createFakePopup({ writeThrows = false } = {}) {
  const popup = {
    closed: false,
    written: '',
    posted: [],
    postedOrigins: [],
    postMessage(message, origin) {
      popup.posted.push(message);
      popup.postedOrigins.push(origin);
    },
    close() {
      popup.closed = true;
    },
  };
  popup.document = {
    open() {},
    write(html) {
      if (writeThrows) throw new Error('document.write failed');
      popup.written += html;
    },
    close() {},
  };
  return popup;
}

export { FakeElement, FakeIframe };
