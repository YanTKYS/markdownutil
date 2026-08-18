// preview.js
// Markdown -> HTML のプレビュー描画のみを担当する。
// (ライブラリ名との混同を避けるため、自作ファイル名は markdown.js ではなく preview.js とする)

import { createMarkdownIt, stripFrontMatterAndComments } from './markdown-engine.js';
import { createElement } from './dom.js';

// パーサーの初期化はmarkdown-engine.jsに集約し、Word出力（word-export.js）と
// 同じ設定（html/linkify/breaks）を共有する。ここでのオプション値自体は変更していない。
const md = createMarkdownIt();

export function renderMarkdown(source) {
  if (!source) {
    return '';
  }
  // Marpのfront matterとHTMLコメント（スピーカーノート）は本文ではないため、
  // Word出力と同じ前処理で取り除いてから描画する。取り除かないと、front matterは
  // 直後の`---`と合わさって見出しとして表示され、コメントは`<!-- ... -->`という
  // 文字列のままプレビューへ出てしまう（markdown-itは`html: false`のため）。
  const body = stripFrontMatterAndComments(source);
  if (!body.trim()) {
    return '';
  }
  return md.render(body);
}

/** targetEl の中身をMarkdownのレンダリング結果で置き換える。 */
export function updatePreview(targetEl, source) {
  const html = renderMarkdown(source);

  if (!html) {
    targetEl.textContent = '';
    targetEl.appendChild(createElement('p', 'preview-empty', 'プレビューはここに表示されます。'));
    return;
  }

  // md.render()の出力は markdown-it (html: false) が生成したタグのみで構成されるため安全。
  targetEl.innerHTML = html;
}
