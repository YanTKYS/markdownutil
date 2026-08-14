// presenter.js
// 「プレゼン表示」を担当する。プレゼン専用の別ウィンドウ（投影用）と、
// MarkdownUtil本体側の発表者ビュー（現在/次スライド・スピーカーノート・前後操作）、
// および両者とウィンドウ間の同期（postMessage）をここへ集約する。
// Marpの描画そのものやスピーカーノートの取得はslide-preview.jsに委ね、
// このファイルは「発表という状態」と「複数の表示先を同じ位置へ同期させること」だけを扱う。
//
// 庁内IISはHTTP配信を前提とするため、Window Management API等による拡張ディスプレイの
// 自動検出・自動配置は行わない。プレゼン専用ウィンドウを開いたあとは、利用者自身が
// そのウィンドウを拡張ディスプレイへ移動し、ウィンドウ側の「全画面」を押す運用とする。

import { getRenderedPayload, getSlideCount, getNoteForIndex, buildFrameDocument, createMessagePort } from './slide-preview.js';
import { TOGGLE_FULLSCREEN_JS } from './inline-html.js';
import { hasModifierKey } from './dom.js';
import { logError } from './errors.js';

const NO_NOTE_TEXT = 'スピーカーノートはありません';
const NO_NEXT_TEXT = 'これが最後のスライドです';

// プレゼン専用ウィンドウの右下に「全画面」ボタンだけを追加する。投影先は
// スライドだけを映すことを優先するため、それ以外の飾りは付けない。
const POPUP_EXTRA_HTML = `<style>
.mu-fullscreen-btn {
  position: fixed; right: 12px; bottom: 12px; z-index: 30;
  appearance: none; border: 1px solid rgba(255, 255, 255, 0.5); background: rgba(0, 0, 0, 0.5);
  color: #fff; border-radius: 3px; padding: 6px 12px; font-size: 13px; cursor: pointer;
  font-family: -apple-system, "Segoe UI", "Hiragino Sans", Meiryo, sans-serif;
}
.mu-fullscreen-btn:hover { background: rgba(0, 0, 0, 0.75); }
/* 全画面化した後は投影内容をスライドだけにする。Escで解除できるため残す必要は薄い。 */
:fullscreen .mu-fullscreen-btn { display: none; }
</style>
<button type="button" class="mu-fullscreen-btn" id="mu-fullscreen-btn">⛶ 全画面</button>
<script>
document.getElementById('mu-fullscreen-btn').addEventListener('click', function (event) {
  // ドキュメント全体のclickリスナー（クリックで次のスライドへ進む）へ伝播すると、
  // 全画面化と同時にスライドが進んでしまうため止める。
  event.stopPropagation();
${TOGGLE_FULLSCREEN_JS}
});
<\/script>`;

let els = null; // { currentFrame, nextFrame, notesEl, positionEl, prevBtn, nextBtn, endBtn }
let currentPort = null;
let nextPort = null;
let popupWindow = null;
let popupPort = null;
let popupWatchTimer = null;

let presenting = false;
let presentIndex = 0;

function stopPopupWatch() {
  if (popupWatchTimer) {
    window.clearInterval(popupWatchTimer);
    popupWatchTimer = null;
  }
}

function startPopupWatch() {
  stopPopupWatch();
  // 別ウィンドウの終了はcloseイベントに頼らず（ブラウザによって発火が不安定なため）、
  // 定期的にclosedを確認する。負荷を気にする頻度ではない。
  popupWatchTimer = window.setInterval(() => {
    if (popupWindow && popupWindow.closed) {
      end();
    }
  }, 400);
}

function updateView() {
  if (!els) return;
  const total = getSlideCount();
  els.positionEl.textContent = total > 0 ? `${presentIndex + 1} / ${total}` : '- / -';

  const note = getNoteForIndex(presentIndex);
  els.notesEl.textContent = note && note.trim() ? note : NO_NOTE_TEXT;

  els.prevBtn.disabled = presentIndex <= 0;
  els.nextBtn.disabled = presentIndex >= total - 1;
}

/** 発表者ビューのiframeにスライド描画用の文書を読み込み、通信用ポートを作る。 */
function initFrame(frame) {
  frame.srcdoc = buildFrameDocument('parent');
  return createMessagePort(() => frame.contentWindow);
}

/** 描画先（発表者ビューのiframe・投影用ウィンドウ）へ、指定スライドの単一表示を指示する。 */
function showSlide(port, payload, index) {
  port.send({ type: 'render', ...payload });
  port.send({ type: 'single', single: true });
  port.send({ type: 'goto', index });
}

function syncAll() {
  const payload = getRenderedPayload();
  if (!payload) return;
  const total = getSlideCount();

  showSlide(currentPort, payload, presentIndex);

  if (presentIndex + 1 < total) {
    showSlide(nextPort, payload, presentIndex + 1);
    nextPort.send({ type: 'empty', empty: false });
  } else {
    nextPort.send({ type: 'empty', empty: true, message: NO_NEXT_TEXT });
  }

  if (popupPort) {
    showSlide(popupPort, payload, presentIndex);
  }

  updateView();
}

function goto(index) {
  const total = getSlideCount();
  if (total === 0) return;
  const next = Math.min(Math.max(index, 0), total - 1);
  if (next === presentIndex) return;
  presentIndex = next;
  syncAll();
}

/** プレゼン中のキー操作。処理した場合はtrueを返す（呼び出し側で既定動作を抑止する）。 */
function handleKey(key, shiftKey) {
  switch (key) {
    case 'Escape':
      end();
      return true;
    case 'ArrowRight': case 'ArrowDown': case 'PageDown': case 'Enter':
      goto(presentIndex + 1);
      return true;
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
      goto(presentIndex - 1);
      return true;
    case ' ':
      goto(shiftKey ? presentIndex - 1 : presentIndex + 1);
      return true;
    case 'Home':
      goto(0);
      return true;
    case 'End':
      goto(getSlideCount() - 1);
      return true;
    default:
      return false;
  }
}

function handleWindowKeydown(event) {
  if (!presenting) return;
  if (hasModifierKey(event)) return;
  if (handleKey(event.key, event.shiftKey)) event.preventDefault();
}

function closePopup() {
  stopPopupWatch();
  if (popupPort) {
    popupPort.destroy();
    popupPort = null;
  }
  if (popupWindow && !popupWindow.closed) {
    popupWindow.close();
  }
  popupWindow = null;
}

/**
 * 発表者ビューのDOM要素を登録する。アプリ起動時に一度だけ呼び出すこと。
 * @param {{
 *   currentFrame: HTMLIFrameElement, nextFrame: HTMLIFrameElement,
 *   notesEl: HTMLElement, positionEl: HTMLElement,
 *   prevBtn: HTMLButtonElement, nextBtn: HTMLButtonElement, endBtn: HTMLButtonElement,
 * }} elements
 */
export function init(elements) {
  els = elements;

  currentPort = initFrame(els.currentFrame);
  nextPort = initFrame(els.nextFrame);

  els.prevBtn.addEventListener('click', () => goto(presentIndex - 1));
  els.nextBtn.addEventListener('click', () => goto(presentIndex + 1));
  els.endBtn.addEventListener('click', end);

  window.addEventListener('keydown', handleWindowKeydown);

  // 親画面（本体）を再読み込み・離脱した場合も、投影用の別ウィンドウが孤立しないようにする。
  window.addEventListener('beforeunload', () => {
    if (popupWindow && !popupWindow.closed) popupWindow.close();
  });
}

/**
 * プレゼン専用の別ウィンドウを開き、発表者ビューへ切り替える。
 * 呼び出し前に、現在のMarkdownが正しく描画済みであること（isRenderCurrent等）を
 * 呼び出し側で確認しておくこと。
 * @returns {boolean} 開始できたか（ポップアップブロック時などはfalse）
 */
export function start() {
  if (presenting) return true;
  if (!getRenderedPayload() || getSlideCount() === 0) return false;

  try {
    popupWindow = window.open(
      '',
      'markdownutil-presenter',
      'width=1024,height=640,menubar=no,toolbar=no,location=no,status=no',
    );
  } catch (error) {
    logError('start: プレゼン用ウィンドウを開けなかった', error);
    popupWindow = null;
  }
  if (!popupWindow) return false;

  try {
    popupWindow.document.open();
    popupWindow.document.write(buildFrameDocument('opener', POPUP_EXTRA_HTML, 'MarkdownUtil プレゼン'));
    popupWindow.document.close();
  } catch (error) {
    // 開けたのに中身を書き込めなかった場合（拡張機能による制限等）。発表者ビューへ切り替える
    // 前に中途半端な空ウィンドウを閉じ、開始できなかったことを呼び出し側へ伝える。
    logError('start: プレゼン用ウィンドウの初期化に失敗', error);
    closePopup();
    return false;
  }

  popupPort = createMessagePort(() => popupWindow, {
    onMessage: (message) => {
      if (message.type === 'keydown') {
        handleKey(message.key, message.shiftKey);
      } else if (message.type === 'click') {
        goto(presentIndex + 1);
      }
    },
  });

  presenting = true;
  presentIndex = 0;
  startPopupWatch();
  document.body.classList.add('is-presenting');
  syncAll();

  return true;
}

/** プレゼンを終了し、別ウィンドウを閉じて発表者ビューを隠す。Markdownの内容は変更しない。 */
export function end() {
  if (!presenting) return;
  presenting = false;
  closePopup();
  document.body.classList.remove('is-presenting');
}

export function isPresenting() {
  return presenting;
}
