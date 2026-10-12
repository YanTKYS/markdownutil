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
 * タブ（`role="tab"`）の並びで、←/→（Home/End）キーによる移動を有効にする
 * （WAI-ARIAのタブパターン）。移動先のタブへフォーカスを移し、クリック操作と同じ
 * 経路で選択する。Tabキーでの移動は変えない（各タブはそのままTab停止位置になる）。
 * @param {HTMLElement[]} tabs 左から順に並んだタブのボタン
 */
export function bindTabArrowKeys(tabs) {
  tabs.forEach((tab, index) => {
    tab.addEventListener('keydown', (event) => {
      if (hasModifierKey(event) || event.shiftKey) return;
      let target = null;
      if (event.key === 'ArrowRight') target = tabs[(index + 1) % tabs.length];
      else if (event.key === 'ArrowLeft') target = tabs[(index - 1 + tabs.length) % tabs.length];
      else if (event.key === 'Home') target = tabs[0];
      else if (event.key === 'End') target = tabs[tabs.length - 1];
      if (!target) return;
      event.preventDefault();
      target.focus();
      target.click();
    });
  });
}

/**
 * Ctrl/Alt/Metaを伴うキー操作かどうか。ブラウザ自身の操作（Ctrl+P等）を
 * 独自のキー処理で奪わないための判定に使う。
 */
export function hasModifierKey(event) {
  return event.ctrlKey || event.altKey || event.metaKey;
}
