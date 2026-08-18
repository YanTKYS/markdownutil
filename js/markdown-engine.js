// markdown-engine.js
// markdown-itの初期化オプションと、Markdown本文をレンダリングへ渡す前の共通前処理
// （Marp向けfront matterとHTMLコメントの除去）を一箇所へ集約する。
// プレビュー（preview.js）とWord出力（word-export.js）の両方から呼び出し、
// パーサーの設定（html/linkify/breaks）と「本文として扱う範囲」を完全に一致させる。
// front matterの位置を表す正規表現はスライドのテーマ読み書き（slide-preview.js）でも
// 共用し、front matterの書式判定が複数箇所で食い違わないようにする。

import MarkdownIt from '../vendor/markdown-it/markdown-it.esm.min.mjs';

/**
 * html: false により、Markdown内に書かれた生HTML（<script>等）はそのままテキストとして
 * エスケープ表示され、実行されない。安全側の既定設定をそのまま利用し、独自のサニタイズ処理は
 * 追加しない。markdown-itの既定のリンク検証（javascript: 等の危険なスキームを拒否）もそのまま使う。
 */
export function createMarkdownIt() {
  return new MarkdownIt({
    html: false,
    linkify: true,
    breaks: false,
  });
}

// 先頭の `---` 〜 `---` で囲まれたブロック。`---`の後ろに空白が入っていても
// front matterとして扱う（打ち間違いで入りやすく、Marp側は許容するため）。
export const FRONT_MATTER_PATTERN = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * ブロックの中身がMarpのディレクティブ（`key: value`）だけでできているか。
 * 本文が水平線`---`で始まる文書の本文を、front matterと誤認して丸ごと消して
 * しまわないための判定で、1行でも`key: value`の形でない行があれば偽とする。
 * 見やすさのためにディレクティブの間へ空行を入れた場合も想定し、空行は読み飛ばす。
 */
function isDirectiveBlock(body) {
  const lines = body.split(/\r?\n/).filter((line) => line.trim() !== '');
  return lines.length > 0 && lines.every((line) => /^[^:]+:/.test(line));
}

/**
 * Marp向けのfront matterと、HTMLコメント（スピーカーノート・通常のMarkdownコメント）を
 * 取り除く。どちらもMarpが自分で解釈する「本文ではない情報」であり、markdown-itは
 * `html: false`のため本文の文字としてそのまま表示してしまう（front matterは直後の`---`と
 * 合わさって見出しにすらなる）。プレビューとWord出力で同じ本文を見せるため、
 * 両方の入口でこの関数を通す。エディタのMarkdown（editor.value）自体は変更しない。
 */
export function stripFrontMatterAndComments(markdown) {
  let text = markdown;

  const frontMatter = text.match(FRONT_MATTER_PATTERN);
  if (frontMatter && isDirectiveBlock(frontMatter[1])) {
    text = text.slice(frontMatter[0].length);
  }

  return text.replace(/<!--[\s\S]*?-->/g, '');
}
