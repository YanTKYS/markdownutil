// slide-preview.js
// Markdown -> Marp Core -> スライドプレビューを担当する。
// Marp初期化・レンダリング・iframeへの描画・テーマ関連・スライド枚数取得・
// プレゼン表示に必要な処理をここへ集約し、app.jsにはMarp固有のロジックを持ち込まない。
//
// slide/iSlide（https://github.com/YanTKYS/slide）で検証済みの実装方式
// （Marp Coreの初期化オプション、iframe + postMessageによるプレビュー分離、
// リモートWebフォントの@import除去、HTML出力・印刷・プレゼン表示の組み立て方）を参考にし、
// MarkdownUtil向けに再構成したもの。iSlide側のエディタ・ファイル入出力・localStorage自動保存・
// splitter等は持ち込まない。

export const THEMES = ['default', 'gaia', 'uncover'];

const FRONT_MATTER_PATTERN = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/;
// gaiaテーマ等がWebフォントを@importで外部から読み込むのを取り除く。
// (テーマのフォールバックフォントで表示され、Markdownの互換性には影響しない)
const REMOTE_IMPORT_PATTERN = /@import\s+(?:url\(\s*)?["']?(?:https?:)?\/\/[^;]*;/gi;
const SLIDE_SVG_PATTERN = /<svg[^>]*\bdata-marpit-svg\b/g;

// プレビュー用iframeの中身。Marpが生成したHTML/CSSをここへ流し込み、
// 親ページとはpostMessageだけでやり取りする（Marp側のCSSが本体DOMへ漏れないようにする）。
const PREVIEW_DOCUMENT_HTML = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"></head><body>
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
body.is-presenting { padding: 0; height: 100vh; overflow: hidden; background: #000000; }
body.is-presenting #slides { max-width: none; }
body.is-presenting #slides .marpit { display: block; }
body.is-presenting #slides .marpit > svg[data-marpit-svg] { display: none; }
body.is-presenting #slides .marpit > svg[data-marpit-svg].is-current {
  display: block; width: 100vw; height: 100vh; background: transparent; box-shadow: none;
}
</style>
<div id="slides"></div>
<script>
(function () {
  'use strict';
  var slidesElement = document.getElementById('slides');
  var styleElement = document.getElementById('marp-style');
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

  function setPresenting(presenting) {
    document.body.classList.toggle('is-presenting', presenting);
    if (presenting) scrollCurrentIntoView();
  }

  function scrollCurrentIntoView() {
    var slide = slides()[currentIndex];
    if (slide) slide.scrollIntoView({ block: 'center' });
  }

  function post(message) {
    parent.postMessage(message, '*');
  }

  window.addEventListener('message', function (event) {
    var message = event.data;
    if (!message || typeof message !== 'object') return;

    if (message.type === 'render') {
      render(message);
    } else if (message.type === 'present') {
      setPresenting(message.presenting);
    } else if (message.type === 'goto') {
      currentIndex = message.index;
      showCurrent();
      if (!document.body.classList.contains('is-presenting')) scrollCurrentIntoView();
    }
  });

  // iframe側にフォーカスがあってもプレゼン操作を親側で処理できるように転送する。
  // Ctrl/Alt等との組み合わせはブラウザの操作（Ctrl+P等）なので転送しない。
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
</body></html>`;

let marpPromise = null;
let frame = null;
let presenterHintEl = null;
let frameReady = false;
let lastRendered = null; // { html, css }
let slideCount = 0;
let slideIndex = 0;
let presenting = false;
// 最後に正しくレンダリングできたMarkdownそのもの（renderValidの代わりに、これと
// 「今のエディタの内容」を比較する）。解析失敗時、および入力のdebounce待ちや
// モード切替直後のように「再描画がまだ終わっていない」間は、画面には直前の内容が
// 残ったままになる。「render()が最後に成功したか」だけでは、その成功結果が
// 現在の入力内容と同じかまでは分からないため、入力そのものを記録して照合する。
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

function postToFrame(message) {
  if (frameReady && frame && frame.contentWindow) {
    frame.contentWindow.postMessage(message, '*');
  }
}

// iframeの準備が整った時点で現在の状態をまとめて送り直す。
// 準備前の描画要求を貯め込む必要がなく、iframeが読み込み直された場合にも復元できる。
function syncFrame() {
  if (lastRendered) postToFrame({ type: 'render', ...lastRendered });
  postToFrame({ type: 'present', presenting });
  postToFrame({ type: 'goto', index: slideIndex });
}

function updatePresenterHint() {
  if (!presenterHintEl) return;
  if (presenting && slideCount > 0) {
    presenterHintEl.textContent = `${slideIndex + 1} / ${slideCount}　（← → 移動 / Esc 終了）`;
    presenterHintEl.hidden = false;
  } else {
    presenterHintEl.hidden = true;
  }
}

/** プレゼン表示中のキー操作。処理したキーはtrueを返す（呼び出し側で既定動作を抑止する）。 */
function handlePresentationKey(key, shiftKey) {
  switch (key) {
    case 'Escape':
      exitPresentation();
      return true;
    case 'ArrowRight': case 'ArrowDown': case 'PageDown': case 'Enter':
      gotoSlide(slideIndex + 1);
      return true;
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
      gotoSlide(slideIndex - 1);
      return true;
    case ' ':
      gotoSlide(shiftKey ? slideIndex - 1 : slideIndex + 1);
      return true;
    case 'Home':
      gotoSlide(0);
      return true;
    case 'End':
      gotoSlide(slideCount - 1);
      return true;
    default:
      return false;
  }
}

function gotoSlide(index) {
  if (slideCount === 0) return;
  slideIndex = Math.min(Math.max(index, 0), slideCount - 1);
  postToFrame({ type: 'goto', index: slideIndex });
  updatePresenterHint();
}

function onFrameMessage(event) {
  if (!frame || event.source !== frame.contentWindow) return;
  const message = event.data;
  if (!message || typeof message !== 'object') return;

  if (message.type === 'ready') {
    frameReady = true;
    syncFrame();
  } else if (message.type === 'keydown') {
    if (presenting) handlePresentationKey(message.key, message.shiftKey);
  } else if (message.type === 'click') {
    if (presenting) gotoSlide(slideIndex + 1);
  }
}

/**
 * スライドプレビュー用のiframeとプレゼン表示ヒント要素を登録する。
 * アプリ起動時に一度だけ呼び出すこと。
 */
export function init(iframeEl, presenterHintOptionalEl) {
  frame = iframeEl;
  presenterHintEl = presenterHintOptionalEl || null;
  frameReady = false;
  frame.srcdoc = PREVIEW_DOCUMENT_HTML;

  window.addEventListener('message', onFrameMessage);
  window.addEventListener('keydown', (event) => {
    if (!presenting) return;
    // Ctrl+P（印刷）等のブラウザ操作を奪わないよう、修飾キー付きは対象外とする。
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    // スライド操作に使うキーだけ既定動作を抑止する（F5などはそのまま動く）。
    if (handlePresentationKey(event.key, event.shiftKey)) event.preventDefault();
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && presenting) {
      exitPresentation();
    }
  });
}

/**
 * MarkdownをMarpでレンダリングし、iframeへ反映する。
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
  slideCount = countSlides(rendered.html);
  slideIndex = Math.min(slideIndex, Math.max(slideCount - 1, 0));
  renderedSource = markdown;

  postToFrame({ type: 'render', ...lastRendered });
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

function slideSize(html) {
  const viewBox = html.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  return viewBox ? { width: viewBox[1], height: viewBox[2] } : { width: '1280', height: '720' };
}

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character]));
}

/**
 * 現在のスライドを単体で開けるHTML文字列を組み立てる（CSSを内包、外部参照なし）。
 * @param {string} title
 * @param {boolean} autoPrint 読み込み時に印刷ダイアログを自動で開くか
 * @returns {string|null} レンダリング済みの内容が無ければnull
 */
export function buildStandaloneHtml(title, autoPrint) {
  if (!lastRendered) return null;
  const size = slideSize(lastRendered.html);

  const documentStyle = [
    'html, body { margin: 0; padding: 0; }',
    'body { background: #525659; }',
    '.marpit { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 16px; }',
    '.marpit > svg[data-marpit-svg] {',
    '  display: block; width: 100%; max-width: ' + size.width + 'px; height: auto;',
    '  background: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);',
    '}',
    '@page { size: ' + size.width + 'px ' + size.height + 'px; margin: 0; }',
    '@media print {',
    '  body { background: #fff; }',
    '  .marpit { display: block; padding: 0; gap: 0; }',
    '  .marpit > svg[data-marpit-svg] {',
    '    width: ' + size.width + 'px; height: ' + size.height + 'px; max-width: none;',
    '    box-shadow: none; break-after: page; page-break-after: always;',
    '  }',
    '  .marpit > svg[data-marpit-svg]:last-of-type { break-after: auto; page-break-after: auto; }',
    '  .marpit > svg > foreignObject > section { break-before: auto; page-break-before: auto; }',
    '}',
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
    lastRendered.html,
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

export function enterPresentation() {
  presenting = true;
  document.body.classList.add('is-presenting');
  postToFrame({ type: 'present', presenting: true });
  updatePresenterHint();

  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {
      // 全画面が拒否されても、編集UIを隠した表示は継続する
    });
  }
}

export function exitPresentation() {
  presenting = false;
  document.body.classList.remove('is-presenting');
  postToFrame({ type: 'present', presenting: false });
  updatePresenterHint();

  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}
