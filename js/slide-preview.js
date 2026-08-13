// slide-preview.js
// Markdown -> Marp Core -> スライドの「描画」を担当する。
// Marp初期化・レンダリング（スピーカーノートの取得を含む）・編集時プレビュー用iframeへの
// 描画・テーマ関連・HTML出力・印刷をここへ集約し、app.jsにはMarp固有のロジックを持ち込まない。
//
// プレゼン専用ウィンドウ・発表者ビュー・ウィンドウ間同期はpresenter.jsの責務。
// slide-preview.jsは、presenter.jsが自分のiframe/別ウィンドウを組み立てるための部品
// （buildFrameDocument, createMessagePort, getRenderedPayload, getNoteForIndex）を提供する。
//
// slide/iSlide（https://github.com/YanTKYS/slide）で検証済みの実装方式
// （Marp Coreの初期化オプション、iframe + postMessageによるプレビュー分離、
// リモートWebフォントの@import除去）を参考にし、MarkdownUtil向けに再構成したもの。

export const THEMES = ['default', 'gaia', 'uncover'];

const FRONT_MATTER_PATTERN = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/;
// gaiaテーマ等がWebフォントを@importで外部から読み込むのを取り除く。
// (テーマのフォールバックフォントで表示され、Markdownの互換性には影響しない)
const REMOTE_IMPORT_PATTERN = /@import\s+(?:url\(\s*)?["']?(?:https?:)?\/\/[^;]*;/gi;
const SLIDE_SVG_PATTERN = /<svg[^>]*\bdata-marpit-svg\b/g;

/* ================================================================
   スライド描画用ドキュメント（iframe / 別ウィンドウで共用）
   ================================================================
   Marpが生成したHTML/CSSをこのドキュメントへ流し込み、postMessageだけで
   やり取りする。iframeとして埋め込む場合はpostTarget='parent'、
   window.open()で開いた別ウィンドウとして使う場合はpostTarget='opener'を渡す。
   Marp側のCSSが本体（MarkdownUtil）のDOMへ影響しないよう、常にこの独立した
   ドキュメント側で描画する。 */
export function buildFrameDocument(postTarget = 'parent', extraBodyHtml = '', title = '') {
  const target = postTarget === 'opener' ? 'window.opener' : 'parent';
  const titleTag = title ? `<title>${title.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</title>` : '';

  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">${titleTag}</head><body>
<style id="marp-style"></style>
<style>
html, body { margin: 0; padding: 0; }
body { padding: 16px; background: #525659; overflow-x: hidden; }
#slides { max-width: 1280px; margin: 0 auto; }
#slides .marpit { display: flex; flex-direction: column; gap: 16px; }
#slides .marpit > svg[data-marpit-svg] {
  display: block; width: 100%; height: auto;
  background: #ffffff; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
}
body.is-single { padding: 0; height: 100vh; overflow: hidden; background: #000000; }
body.is-single #slides { max-width: none; }
body.is-single #slides .marpit { display: block; }
body.is-single #slides .marpit > svg[data-marpit-svg] { display: none; }
body.is-single #slides .marpit > svg[data-marpit-svg].is-current {
  display: block; width: 100vw; height: 100vh; background: transparent; box-shadow: none;
}
body.is-empty #slides { display: none; }
.empty-message {
  display: none; height: 100vh; align-items: center; justify-content: center;
  color: #c8ccd2; font: 14px -apple-system, "Segoe UI", sans-serif; text-align: center; padding: 16px;
}
body.is-empty .empty-message { display: flex; }
</style>
<div id="slides"></div>
<div class="empty-message" id="empty-message"></div>
<script>
(function () {
  'use strict';
  var slidesElement = document.getElementById('slides');
  var styleElement = document.getElementById('marp-style');
  var emptyElement = document.getElementById('empty-message');
  var currentIndex = 0;

  // Marp Coreの自動縮小スクリプトはカスタム要素を使うが、再描画のたびに
  // 同じ名前を再登録しようとして例外になるため、二重登録は読み飛ばす。
  var defineCustomElement = customElements.define.bind(customElements);
  customElements.define = function (name, ctor, options) {
    if (customElements.get(name)) return;
    defineCustomElement(name, ctor, options);
  };

  function slides() {
    return slidesElement.querySelectorAll('svg[data-marpit-svg]');
  }

  // innerHTMLで挿入した<script>は実行されないため、同内容の要素に差し替える。
  function activateScripts(root) {
    root.querySelectorAll('script').forEach(function (original) {
      var script = document.createElement('script');
      Array.prototype.forEach.call(original.attributes, function (attribute) {
        script.setAttribute(attribute.name, attribute.value);
      });
      script.textContent = original.textContent;
      original.parentNode.replaceChild(script, original);
    });
  }

  function showCurrent() {
    var all = slides();
    if (all.length === 0) {
      currentIndex = 0;
    } else {
      currentIndex = Math.min(Math.max(currentIndex, 0), all.length - 1);
    }
    all.forEach(function (slide, i) {
      slide.classList.toggle('is-current', i === currentIndex);
    });
  }

  function render(message) {
    var scrollTop = document.scrollingElement.scrollTop;
    styleElement.textContent = message.css;
    slidesElement.innerHTML = message.html;
    activateScripts(slidesElement);
    document.scrollingElement.scrollTop = scrollTop;
    showCurrent();
  }

  // 単一表示モード：常に1枚だけを画面いっぱいに表示する（プレゼン用）。
  function setSingle(single) {
    document.body.classList.toggle('is-single', single);
    if (single) scrollCurrentIntoView();
  }

  // 「次のスライド」欄で、最後のスライドより先を指すよう求められた場合の表示。
  function setEmpty(empty, message) {
    document.body.classList.toggle('is-empty', empty);
    emptyElement.textContent = empty ? (message || '') : '';
  }

  function scrollCurrentIntoView() {
    var slide = slides()[currentIndex];
    if (slide) slide.scrollIntoView({ block: 'center' });
  }

  function post(message) {
    ${target}.postMessage(message, '*');
  }

  window.addEventListener('message', function (event) {
    var message = event.data;
    if (!message || typeof message !== 'object') return;

    if (message.type === 'render') {
      render(message);
    } else if (message.type === 'single') {
      setSingle(message.single);
    } else if (message.type === 'empty') {
      setEmpty(message.empty, message.message);
    } else if (message.type === 'goto') {
      currentIndex = message.index;
      showCurrent();
      if (!document.body.classList.contains('is-single')) scrollCurrentIntoView();
    }
  });

  // フォーカスがこのドキュメント側にあってもプレゼン操作を親/opener側で
  // 処理できるように転送する。Ctrl/Alt等との組み合わせはブラウザの操作
  // （Ctrl+P等）なので転送しない。
  window.addEventListener('keydown', function (event) {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    post({ type: 'keydown', key: event.key, shiftKey: event.shiftKey });
  });
  window.addEventListener('click', function () {
    post({ type: 'click' });
  });

  post({ type: 'ready' });
}());
</script>
${extraBodyHtml}
</body></html>`;
}

/* ================================================================
   iframe / 別ウィンドウとのメッセージ送受信をまとめる小さな部品。
   presenter.jsが自分のiframe・別ウィンドウを管理する際にも再利用する。
   ================================================================ */

/**
 * @param {() => (Window|null)} getTargetWindow 相手のwindowを返す関数
 *   （iframeはcontentWindowが読み込みのたびに変わるため関数にしている）
 * @param {{ onReady?: () => void, onMessage?: (message: object) => void }} [handlers]
 */
export function createMessagePort(getTargetWindow, handlers = {}) {
  let ready = false;
  let pendingQueue = [];

  function send(message) {
    const win = getTargetWindow();
    if (ready && win) {
      win.postMessage(message, '*');
    } else {
      pendingQueue.push(message);
    }
  }

  function handleMessage(event) {
    const win = getTargetWindow();
    if (!win || event.source !== win) return;
    const message = event.data;
    if (!message || typeof message !== 'object') return;

    if (message.type === 'ready') {
      ready = true;
      const queued = pendingQueue;
      pendingQueue = [];
      queued.forEach(send);
      if (handlers.onReady) handlers.onReady();
    } else if (handlers.onMessage) {
      handlers.onMessage(message);
    }
  }

  window.addEventListener('message', handleMessage);

  return {
    send,
    /** 読み込み直された（iframeのsrcdoc再設定など）際に呼び、待ち行列と準備状態をリセットする。 */
    reset() {
      ready = false;
      pendingQueue = [];
    },
    destroy() {
      window.removeEventListener('message', handleMessage);
      ready = false;
      pendingQueue = [];
    },
  };
}

/* ================================================================
   Marp初期化・レンダリング
   ================================================================ */

let marpPromise = null;
let mainFrame = null;
let mainPort = null;
let lastRendered = null; // { html, css }
let lastNotes = []; // 1スライドごとのスピーカーノート（文字列。無ければ''）
let slideCount = 0;
// 最後に正しくレンダリングできたMarkdownそのもの。render()が最後に成功したかではなく
// 「その結果が今の入力と同じか」を照合できるようにするため、入力自体を記録する。
let renderedSource = null;

// Marp Coreのバンドルは約3.8MBあり、起動時に読み込むと遅い端末では
// 数秒間ボタンが反応しなくなる。文書プレビューだけを使う場合には不要なので、
// スライドモードが初めて使われたときに動的importで読み込む。
function loadMarp() {
  if (!marpPromise) {
    marpPromise = import('../vendor/marp/marp-core.bundle.mjs')
      .then(({ Marp }) => new Marp({
        // 絵文字を画像(twemoji CDN)へ置き換えず、フォントの絵文字として表示する
        emoji: { shortcode: true, unicode: false },
        // KaTeXは外部CSS/フォントを必要とするため、同梱できるMathJaxを使う
        math: 'mathjax',
        script: true,
      }))
      .catch((error) => {
        marpPromise = null; // 失敗を保持し続けると再試行できなくなるため戻す
        throw error;
      });
  }
  return marpPromise;
}

function removeRemoteImports(css) {
  return css.replace(REMOTE_IMPORT_PATTERN, '');
}

function countSlides(html) {
  const matches = html.match(SLIDE_SVG_PATTERN);
  return matches ? matches.length : 0;
}

/**
 * 編集時のスライドプレビュー用iframeを登録する（常に全スライドを縦一覧表示）。
 * アプリ起動時に一度だけ呼び出すこと。
 */
export function init(iframeEl) {
  mainFrame = iframeEl;
  mainFrame.srcdoc = buildFrameDocument('parent');
  if (mainPort) mainPort.destroy();
  mainPort = createMessagePort(() => mainFrame.contentWindow, {
    onReady: () => {
      if (lastRendered) mainPort.send({ type: 'render', ...lastRendered });
    },
  });
}

/**
 * MarkdownをMarpでレンダリングし、編集時プレビューのiframeへ反映する。
 * エラーは利用者向けの日本語メッセージへ正規化して返す（表示方法は呼び出し側の責務）。
 * @param {string} markdown
 * @returns {Promise<{ slideCount: number, error: string|null }>}
 */
export async function render(markdown) {
  let marp;
  try {
    marp = await loadMarp();
  } catch {
    renderedSource = null;
    return { slideCount: 0, error: 'スライド表示機能を読み込めませんでした。ページを再読み込みしてください。' };
  }

  let rendered;
  try {
    rendered = marp.render(markdown || '');
  } catch {
    // front matterのYAMLが壊れている場合など。直前のプレビューは画面にそのまま残すが、
    // 今のMarkdownを反映したものではないため、出力系操作は許可しない。
    renderedSource = null;
    return { slideCount, error: 'Markdownを解析できませんでした。front matterの書式を確認してください。' };
  }

  lastRendered = { html: rendered.html, css: removeRemoteImports(rendered.css) };
  // Marpit公式のPresenter notes機能: ディレクティブ指定用YAMLを除いたHTMLコメントが
  // スライドごとの配列で得られる。1枚に複数コメントがある場合は空行で連結する。
  lastNotes = (rendered.comments || []).map((slideComments) => slideComments.join('\n\n'));
  slideCount = countSlides(rendered.html);
  renderedSource = markdown;

  if (mainPort) mainPort.send({ type: 'render', ...lastRendered });
  return { slideCount, error: null };
}

/** 現在レンダリングされているスライドの枚数。 */
export function getSlideCount() {
  return slideCount;
}

/**
 * 画面に表示中のスライドが、渡されたMarkdownをレンダリングした結果と一致するかどうか。
 * 解析エラー中はもちろん、入力のdebounce待ちや再描画中のように「まだ反映されていない」
 * 間も一致しない。「直前のrender()が成功したか」ではなく「その結果が今の入力と同じか」を
 * 見ることで、編集直後にHTML出力・印刷・プレゼン表示を実行した場合に古い内容が
 * 出力されてしまうことを防ぐ。
 */
export function isRenderCurrent(markdown) {
  return renderedSource !== null && renderedSource === markdown;
}

/** 直近のレンダリング結果（{ html, css }）。presenter.jsが自分のフレームに描画する際に使う。 */
export function getRenderedPayload() {
  return lastRendered;
}

/** 指定スライド（0始まり）のスピーカーノート。無ければ空文字を返す。 */
export function getNoteForIndex(index) {
  if (index < 0 || index >= lastNotes.length) return '';
  return lastNotes[index] || '';
}

/** front matterに書かれた現在のテーマ名を読み取る（未指定ならば空文字）。 */
export function readTheme(markdown) {
  const frontMatter = markdown.match(FRONT_MATTER_PATTERN);
  if (!frontMatter) return '';
  const theme = frontMatter[1].match(/^theme[ \t]*:[ \t]*(\S+?)[ \t\r]*$/m);
  return theme ? theme[1].replace(/^["']|["']$/g, '') : '';
}

/**
 * front matterへテーマを書き込んだMarkdownを返す（Markdown本文はそれ以外変更しない）。
 * front matterが無ければ`marp: true`とともに新設する。
 */
export function writeTheme(markdown, theme) {
  const frontMatter = markdown.match(FRONT_MATTER_PATTERN);

  if (!frontMatter) {
    return `---\nmarp: true\ntheme: ${theme}\n---\n\n${markdown}`;
  }

  const body = frontMatter[1];
  // front matterは必ず先頭から始まる（正規表現が^に固定されている）ため、
  // その中身は「1行目の改行の直後」から body.length 文字ぶん。そこだけを差し替える。
  const bodyStart = markdown.indexOf('\n') + 1;
  return markdown.slice(0, bodyStart) + withThemeLine(body, theme) + markdown.slice(bodyStart + body.length);
}

/** front matterの中身に`theme:`行を反映する（既にあれば置換、無ければ追記）。 */
function withThemeLine(body, theme) {
  const themeLine = `theme: ${theme}`;
  if (/^theme[ \t]*:.*$/m.test(body)) {
    return body.replace(/^theme[ \t]*:.*$/m, () => themeLine);
  }
  return body === '' ? themeLine : `${body}\n${themeLine}`;
}

/* ================================================================
   HTML出力・印刷
   出力したHTMLは単体でスライドショーでき、そのまま印刷/PDF化もできる。
   Marp Coreは含めず、レンダリング済みのSVGを1枚ずつ切り替えるだけの
   最小限のJavaScriptだけを埋め込む。
   ================================================================ */

function slideSize(html) {
  const viewBox = html.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  return viewBox ? { width: viewBox[1], height: viewBox[2] } : { width: '1280', height: '720' };
}

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character]));
}

// スピーカーノートの本文に "</script>" 等が書かれていても<script>タグを
// 抜け出さないよう、埋め込み前にエスケープする。
function jsonForInlineScript(value) {
  return JSON.stringify(value).replace(/<\/(script)/gi, '<\\/$1');
}

/**
 * 現在のスライドを単体で開けるHTML文字列を組み立てる。
 * 開いた直後は1枚ずつ表示するスライドショーとして動作し、キーボード・クリック・
 * 全画面・印刷に対応する。スピーカーノートは埋め込むが既定では非表示。
 * @param {string} title
 * @param {boolean} autoPrint 読み込み時に印刷ダイアログを自動で開くか
 * @returns {string|null} レンダリング済みの内容が無ければnull
 */
export function buildStandaloneHtml(title, autoPrint) {
  if (!lastRendered) return null;
  const size = slideSize(lastRendered.html);
  const notesJson = jsonForInlineScript(lastNotes);

  const documentStyle = [
    'html, body { margin: 0; padding: 0; height: 100%; }',
    'body {',
    '  background: #525659; overflow: hidden;',
    '  font-family: -apple-system, "Segoe UI", "Hiragino Sans", Meiryo, sans-serif;',
    '}',
    '.slideshow { position: relative; width: 100%; height: 100%; }',
    '.slideshow .marpit {',
    '  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;',
    '}',
    '.slideshow .marpit > svg[data-marpit-svg] { display: none; width: 100%; height: 100%; background: #fff; }',
    '.slideshow .marpit > svg[data-marpit-svg].is-current { display: block; }',
    '.ss-bar {',
    '  position: fixed; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 8px;',
    '  padding: 8px 12px; background: rgba(20, 20, 24, 0.72); color: #fff;',
    '  font-size: 13px; z-index: 20; transition: opacity 0.2s ease;',
    '}',
    '.ss-bar button {',
    '  appearance: none; border: 1px solid rgba(255,255,255,0.5); background: rgba(255,255,255,0.08);',
    '  color: #fff; border-radius: 3px; padding: 4px 10px; font-size: 13px; cursor: pointer;',
    '}',
    '.ss-bar button:hover { background: rgba(255,255,255,0.2); }',
    '.ss-position { font-variant-numeric: tabular-nums; }',
    '.ss-spacer { flex: 1; }',
    '.ss-notes {',
    '  position: fixed; left: 0; right: 0; bottom: 40px; max-height: 40vh; overflow: auto;',
    '  padding: 12px 16px; background: rgba(20, 20, 24, 0.92); color: #f0f0f0;',
    '  font-size: 14px; line-height: 1.6; white-space: pre-wrap; z-index: 19; display: none;',
    '}',
    '.ss-notes.is-visible { display: block; }',
    'body.ss-hide-ui .ss-bar { opacity: 0; pointer-events: none; }',
    '@media print {',
    '  .no-print, .ss-bar, .ss-notes { display: none !important; }',
    '  html, body { overflow: visible; }',
    '  body { background: #fff; }',
    '  .slideshow { position: static; }',
    '  .slideshow .marpit { position: static; display: block; }',
    '  .slideshow .marpit > svg[data-marpit-svg] {',
    '    display: block !important; width: ' + size.width + 'px; height: ' + size.height + 'px;',
    '    break-after: page; page-break-after: always;',
    '  }',
    '  .slideshow .marpit > svg[data-marpit-svg]:last-of-type { break-after: auto; page-break-after: auto; }',
    '  .slideshow .marpit > svg > foreignObject > section { break-before: auto; page-break-before: auto; }',
    '}',
    '@page { size: ' + size.width + 'px ' + size.height + 'px; margin: 0; }',
  ].join('\n');

  // Marp Coreは同梱しない。既にレンダリング済みのSVGの表示/非表示を切り替えるだけ。
  const script = [
    '(function () {',
    '  "use strict";',
    '  var notes = ' + notesJson + ';',
    '  var root = document.querySelector(".slideshow");',
    '  var slides = Array.prototype.slice.call(root.querySelectorAll("svg[data-marpit-svg]"));',
    '  var total = slides.length;',
    '  var index = 0;',
    '  var notesVisible = false;',
    '  var positionEl = document.getElementById("ss-position");',
    '  var notesEl = document.getElementById("ss-notes");',
    '',
    '  function show(i) {',
    '    index = Math.min(Math.max(i, 0), Math.max(total - 1, 0));',
    '    slides.forEach(function (svg, n) { svg.classList.toggle("is-current", n === index); });',
    '    positionEl.textContent = total > 0 ? (index + 1) + " / " + total : "0 / 0";',
    '    if (notesVisible) renderNotes();',
    '  }',
    '',
    '  function renderNotes() {',
    '    var note = notes[index];',
    '    notesEl.textContent = note && note.trim() ? note : "スピーカーノートはありません";',
    '  }',
    '',
    '  function toggleNotes(force) {',
    '    notesVisible = typeof force === "boolean" ? force : !notesVisible;',
    '    notesEl.classList.toggle("is-visible", notesVisible);',
    '    if (notesVisible) renderNotes();',
    '  }',
    '',
    '  function next() { show(index + 1); }',
    '  function prev() { show(index - 1); }',
    '',
    '  document.getElementById("ss-next").addEventListener("click", function (e) { e.stopPropagation(); next(); });',
    '  document.getElementById("ss-prev").addEventListener("click", function (e) { e.stopPropagation(); prev(); });',
    '  document.getElementById("ss-notes-toggle").addEventListener("click", function (e) {',
    '    e.stopPropagation(); toggleNotes();',
    '  });',
    '  document.getElementById("ss-fullscreen").addEventListener("click", function (e) {',
    '    e.stopPropagation();',
    '    if (document.fullscreenElement) { document.exitFullscreen(); }',
    '    else if (document.documentElement.requestFullscreen) { document.documentElement.requestFullscreen().catch(function () {}); }',
    '  });',
    '',
    '  root.addEventListener("click", function () { next(); });',
    '',
    '  window.addEventListener("keydown", function (event) {',
    '    if (event.ctrlKey || event.altKey || event.metaKey) return;',
    '    switch (event.key) {',
    '      case "ArrowRight": case "ArrowDown": case "PageDown": case "Enter": next(); break;',
    '      case "ArrowLeft": case "ArrowUp": case "PageUp": prev(); break;',
    '      case " ": event.shiftKey ? prev() : next(); break;',
    '      case "Home": show(0); break;',
    '      case "End": show(total - 1); break;',
    '      case "n": case "N": toggleNotes(); break;',
    '      default: return;',
    '    }',
    '    event.preventDefault();',
    '  });',
    '',
    '  show(0);',
    '}());',
  ].join('\n');

  const printScript = autoPrint
    ? '<script>window.addEventListener("load", function () { window.print(); });<\/script>'
    : '';

  return [
    '<!DOCTYPE html>',
    '<html lang="ja">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    '<style>',
    lastRendered.css,
    '</style>',
    '<style>',
    documentStyle,
    '</style>',
    '</head>',
    '<body>',
    '<div class="slideshow">',
    lastRendered.html,
    '</div>',
    '<div class="ss-notes no-print" id="ss-notes"></div>',
    '<div class="ss-bar no-print">',
    '<button type="button" id="ss-prev">← 前へ</button>',
    '<button type="button" id="ss-next">次へ →</button>',
    '<span class="ss-position" id="ss-position"></span>',
    '<span class="ss-spacer"></span>',
    '<button type="button" id="ss-notes-toggle">ノート</button>',
    '<button type="button" id="ss-fullscreen">全画面</button>',
    '</div>',
    `<script>${script}<\/script>`,
    printScript,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

/**
 * ブラウザの印刷機能で開けるよう、印刷用ウィンドウを新規タブで開く。
 * @returns {boolean} ウィンドウを開けたか（ポップアップブロック時はfalse）
 */
export function openPrintWindow(title) {
  const html = buildStandaloneHtml(title, true);
  if (!html) return false;

  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const printWindow = window.open(url, '_blank');
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);

  return Boolean(printWindow);
}
