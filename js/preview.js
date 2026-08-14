// preview.js
// Markdown -> HTML のプレビュー描画のみを担当する。
// (ライブラリ名との混同を避けるため、自作ファイル名は markdown.js ではなく preview.js とする)

import { createMarkdownIt } from './markdown-engine.js';

// パーサーの初期化はmarkdown-engine.jsに集約し、Word出力（word-export.js）と
// 同じ設定（html/linkify/breaks）を共有する。ここでのオプション値自体は変更していない。
const md = createMarkdownIt();

export function renderMarkdown(source) {
  if (!source || !source.trim()) {
    return '';
  }
  return md.render(source);
}

/** targetEl の中身をMarkdownのレンダリング結果で置き換える。 */
export function updatePreview(targetEl, source) {
  const html = renderMarkdown(source);

  if (!html) {
    targetEl.textContent = '';
    const empty = document.createElement('p');
    empty.className = 'preview-empty';
    empty.textContent = 'プレビューはここに表示されます。';
    targetEl.appendChild(empty);
    return;
  }

  // md.render()の出力は markdown-it (html: false) が生成したタグのみで構成されるため安全。
  targetEl.innerHTML = html;
}
