// dom.js
// 複数のモジュールが同じ形で書いていたDOM操作の小さな共通処理をまとめる。
// 画面の意味（何をどう表示するか）は各モジュール側に残し、ここには
// 「要素を作る」「タブ状のボタンの選択状態を反映する」「修飾キーを判定する」
// といった、機能に依存しない手続きだけを置く。

/**
 * 要素を作る（クラス名・テキストは任意）。
 * @param {string} tag
 * @param {string|null} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
export function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * タブ状のボタン（`role="tab"`相当）の選択状態を、見た目（`is-active`）と
 * 支援技術向けの`aria-selected`の両方へ同時に反映する。
 * 文書/スライドの切替（app.js）とヘルプのタブ切替（help.js）で共用する。
 */
export function setTabSelected(button, isActive) {
  button.classList.toggle('is-active', isActive);
  button.setAttribute('aria-selected', String(isActive));
}

/**
 * Ctrl/Alt/Metaを伴うキー操作かどうか。ブラウザ自身の操作（Ctrl+P等）を
 * 独自のキー処理で奪わないための判定に使う。
 */
export function hasModifierKey(event) {
  return event.ctrlKey || event.altKey || event.metaKey;
}
