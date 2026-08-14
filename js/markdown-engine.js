// markdown-engine.js
// markdown-itの初期化オプションを一箇所へ集約する。プレビュー（preview.js）とWord出力
// （word-export.js）の両方から呼び出し、パーサーの設定（html/linkify/breaks）を
// 完全に一致させる。パーサー自体の挙動やオプション値はここでは変更しない
// （既存の文書プレビューの出力結果を変えないことを優先する）。

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
