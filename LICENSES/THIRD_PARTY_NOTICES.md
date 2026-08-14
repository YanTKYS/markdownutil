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

## @marp-team/marp-core（v0.2.0で追加）

| 項目 | 内容 |
| --- | --- |
| ライブラリ名 | `@marp-team/marp-core` |
| バージョン | 4.4.0 |
| ライセンス | MIT License（Copyright (c) 2018 Marp team） |
| 入手元 | npm レジストリ: https://www.npmjs.com/package/@marp-team/marp-core （ソース: https://github.com/marp-team/marp-core） |
| 利用目的 | Marp Markdownをスライド（HTML/CSS/SVG）へレンダリングするため（スライドプレビュー・HTML出力・印刷の元データ生成） |
| 配置場所 | `vendor/marp/`（自前ビルドしたブラウザ向けESMバンドル: `marp-core.bundle.mjs`） |
| ライセンス全文 | `vendor/marp/LICENSE`、`LICENSES/marp-core-LICENSE.txt` |
| 備考 | [`slide`（iSlide）](https://github.com/YanTKYS/slide)リポジトリで検証済みの初期化オプション（`emoji: { shortcode: true, unicode: false }`、`math: 'mathjax'`）を踏襲し、絵文字画像化（twemoji CDN）を避けている。バンドル自体はMarkdownUtil向けに`esbuild`でESM形式として再ビルドしたもので、iSlideのビルド済みファイルをそのまま転用してはいない。 |

`@marp-team/marp-core`は内部で以下のライブラリをバンドルしている。いずれも`vendor/marp/marp-core.bundle.mjs`に
含まれており、個別のファイルとしては配置していないが、ライセンス全文を`LICENSES/marp-core-dependencies/`に
同梱している。

| ライブラリ名 | ライセンス | ライセンス全文 |
| --- | --- | --- |
| `@marp-team/marpit` | MIT | `LICENSES/marp-core-dependencies/marpit-LICENSE.txt` |
| `@marp-team/marpit-svg-polyfill` | MIT | `LICENSES/marp-core-dependencies/marpit-svg-polyfill-LICENSE.txt` |
| `highlight.js` | BSD-3-Clause | `LICENSES/marp-core-dependencies/highlight.js-LICENSE.txt` |
| `katex` | MIT | `LICENSES/marp-core-dependencies/katex-LICENSE.txt` |
| `mathjax-full` | Apache-2.0 | `LICENSES/marp-core-dependencies/mathjax-full-LICENSE.txt` |
| `postcss-selector-parser` | MIT | `LICENSES/marp-core-dependencies/postcss-selector-parser-LICENSE.txt` |
| `xss` | MIT | `LICENSES/marp-core-dependencies/xss-LICENSE.txt` |

## docx（v0.6.0で追加）

| 項目 | 内容 |
| --- | --- |
| ライブラリ名 | `docx` |
| バージョン | 9.7.1 |
| ライセンス | MIT License（Copyright (c) 2016 Dolan） |
| 入手元 | npm レジストリ: https://www.npmjs.com/package/docx （ソース: https://github.com/dolanmiu/docx、ドキュメント: https://docx.js.org） |
| 利用目的 | 現在のMarkdownをMicrosoft Word形式（.docx）としてブラウザ内で生成するため |
| 配置場所 | `vendor/docx/`（npmパッケージの`dist/index.mjs`を`esbuild`でブラウザ向けESM単一ファイルへ再バンドル・minifyした`docx.esm.min.mjs`） |
| ライセンス全文 | `vendor/docx/LICENSE`、`LICENSES/docx-dependencies/`（同梱している依存ライブラリ分） |

`docx`は内部で以下のライブラリをバンドルしている（`docx`自身のpackage.jsonが宣言する直接依存）。
いずれも`vendor/docx/docx.esm.min.mjs`に含まれており、個別のファイルとしては配置していないが、
ライセンス全文を`LICENSES/docx-dependencies/`に同梱している。

| ライブラリ名 | ライセンス | ライセンス全文 |
| --- | --- | --- |
| `jszip` | MIT（デュアルライセンスのうちMITを採用） | `LICENSES/docx-dependencies/jszip-LICENSE.txt` |
| `nanoid` | MIT | `LICENSES/docx-dependencies/nanoid-LICENSE.txt` |
| `hash.js` | MIT | `LICENSES/docx-dependencies/hash.js-LICENSE.txt` |
| `xml` | MIT | `LICENSES/docx-dependencies/xml-LICENSE.txt` |
| `xml-js` | MIT | `LICENSES/docx-dependencies/xml-js-LICENSE.txt` |

## slide / iSlide との関係

MarkdownUtilのスライドプレビュー機能は、[`slide`リポジトリ](https://github.com/YanTKYS/slide)の
`iSlide`（MIT License）で検証済みだったMarp Core利用方式（初期化オプション、iframe +
`postMessage`によるプレビュー分離、リモートWebフォント`@import`の除去、HTML出力・印刷・
プレゼン表示の組み立て方）を参考に、MarkdownUtil向けへ再構成して実装した。iSlideのHTML/CSSや
エディタ・ファイル入出力・localStorage自動保存・splitter等はそのまま移植しておらず、
MarkdownUtil自身のUI・データフロー（v0.1.0のAnyDoc変換・編集・保存等）に合わせて
`js/slide-preview.js`として書き直している。

## それ以外の依存

上記以外の外部ライブラリは使用していません。ファイル保存・クリップボードコピー等は
ブラウザ標準API（`Blob` / `URL.createObjectURL` / `Clipboard API` など）のみで実装しています。

## 追加時の方針

新たに外部ライブラリを追加する場合は、標準Web APIで代替できないかをまず検討し、
必要と判断した場合のみ `vendor/` へ実体を配置し、本ファイルへライブラリ名・バージョン・
ライセンス・入手元・利用目的を追記してください。
