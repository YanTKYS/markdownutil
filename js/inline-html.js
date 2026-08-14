// inline-html.js
// 文字列としてHTML／JavaScriptを組み立てる箇所（スライド描画用のiframe、プレゼン専用
// ウィンドウ、単体で開けるHTML出力）で共通して必要になる、エスケープと埋め込み用の
// 小さな部品をまとめる。どれも「生成したHTMLの中で本文がタグやスクリプトを
// 抜け出さないようにする」ためのもので、画面の見た目には関与しない。

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** HTMLへ埋め込むテキストのエスケープ（`&`・`<`・`>`・`"`）。 */
export function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (character) => HTML_ESCAPES[character]);
}

/**
 * インライン`<script>`の中へJSONとして値を埋め込む。本文に "</script>" 等が
 * 書かれていても<script>タグを抜け出さないようエスケープする。
 */
export function jsonForInlineScript(value) {
  return JSON.stringify(value).replace(/<\/(script)/gi, '<\\/$1');
}

/**
 * 全画面表示を切り替えるインラインJavaScript（生成するHTMLへ埋め込む本文）。
 * 全画面中なら解除し、そうでなければ全画面化する（APIが無い環境・拒否された
 * 場合は何もしない）。プレゼン専用ウィンドウとHTML出力のスライドショーで共用する。
 */
export const TOGGLE_FULLSCREEN_JS = [
  'if (document.fullscreenElement) {',
  '  document.exitFullscreen();',
  '} else if (document.documentElement.requestFullscreen) {',
  '  document.documentElement.requestFullscreen().catch(function () {});',
  '}',
].join('\n');

/**
 * Ctrl/Alt/Metaを伴うキー操作なら`return`するインラインJavaScript。
 * ブラウザ自身の操作（Ctrl+P等）を独自のキー処理で奪わないために使う
 * （モジュール側の同じ判定はdom.jsの`hasModifierKey()`）。
 */
export const SKIP_MODIFIER_KEY_JS = 'if (event.ctrlKey || event.altKey || event.metaKey) return;';
