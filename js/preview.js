// preview.js
// Markdown -> HTML のプレビュー描画のみを担当する。
// (ライブラリ名との混同を避けるため、自作ファイル名は markdown.js ではなく preview.js とする)

import MarkdownIt from '../vendor/markdown-it/markdown-it.esm.min.mjs';

// html: false により、Markdown内に書かれた生HTML（<script>等）はそのままテキストとして
// エスケープ表示され、実行されない。安全側の既定設定をそのまま利用し、独自のサニタイズ処理は
// 追加しない。markdown-itの既定のリンク検証（javascript: 等の危険なスキームを拒否）もそのまま使う。
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
});

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
