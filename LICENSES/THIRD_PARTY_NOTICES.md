# サードパーティライブラリ一覧

MarkdownUtilが同梱している外部ライブラリの一覧です。いずれもリポジトリ内 `vendor/` 配下に
実体を配置しており、CDNや実行時のダウンロードには依存していません。

## @firecrawl/anydoc-wasm

| 項目 | 内容 |
| --- | --- |
| ライブラリ名 | `@firecrawl/anydoc-wasm`（[anydoc](https://github.com/firecrawl/anydoc) のWebAssembly版） |
| バージョン | 0.1.8 |
| ライセンス | MIT License（Copyright (c) 2026 Sideguide Technologies Inc.） |
| 入手元 | npm レジストリ: https://www.npmjs.com/package/@firecrawl/anydoc-wasm （ソース: https://github.com/firecrawl/anydoc） |
| 利用目的 | Word / Excel / PowerPoint / PDF / CSV / RTF / OpenDocument / EPUB 等の文書をブラウザ内でMarkdownへ変換するため |
| 配置場所 | `vendor/anydoc/`（`anydoc_wasm.js` / `anydoc_wasm_bg.wasm` / `anydoc_wasm.d.ts`） |
| ライセンス全文 | `vendor/anydoc/LICENSE`、`LICENSES/anydoc-wasm-LICENSE.txt` |

## markdown-it

| 項目 | 内容 |
| --- | --- |
| ライブラリ名 | `markdown-it` |
| バージョン | 15.0.0 |
| ライセンス | MIT License（Copyright (c) 2014 Vitaly Puzrin, Alex Kocharin） |
| 入手元 | npm レジストリ: https://www.npmjs.com/package/markdown-it （ソース: https://github.com/markdown-it/markdown-it） |
| 利用目的 | Markdownをプレビュー表示用のHTMLへ変換するため（`html: false` の安全な既定設定で使用） |
| 配置場所 | `vendor/markdown-it/`（ブラウザ向けビルド済みESM: `markdown-it.esm.min.mjs`） |
| ライセンス全文 | `vendor/markdown-it/LICENSE`、`LICENSES/markdown-it-LICENSE.txt` |

## それ以外の依存

上記2点以外の外部ライブラリは使用していません。ファイル保存・クリップボードコピー等は
ブラウザ標準API（`Blob` / `URL.createObjectURL` / `Clipboard API` など）のみで実装しています。

## 追加時の方針

新たに外部ライブラリを追加する場合は、標準Web APIで代替できないかをまず検討し、
必要と判断した場合のみ `vendor/` へ実体を配置し、本ファイルへライブラリ名・バージョン・
ライセンス・入手元・利用目的を追記してください。
