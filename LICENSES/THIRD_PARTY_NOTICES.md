# サードパーティライブラリ一覧

MarkdownUtilが同梱している外部ライブラリの一覧です。いずれもリポジトリ内 `vendor/` 配下に
実体を配置しており、CDNや実行時のダウンロードには依存していません。

## 本ファイルの対象範囲

本ファイルと`LICENSES/`配下は、MarkdownUtilが同梱する第三者ライブラリの通知です。
MarkdownUtil自身のコード・文書には、ルートの[`LICENSE`](../LICENSE)（MIT License、
Copyright (c) 2026 YanTKYS）が適用されます。ただし`vendor/`配下の第三者ライブラリには適用されず、
各ライブラリの元のライセンスが引き続き適用されます。

## @firecrawl/anydoc-wasm

| 項目 | 内容 |
| --- | --- |
| ライブラリ名 | `@firecrawl/anydoc-wasm`（[anydoc](https://github.com/firecrawl/anydoc) のWebAssembly版） |
| バージョン | 0.2.3 |
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

## @marp-team/marp-core

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

「直接の依存」は`@marp-team/marp-core`・`@marp-team/marpit`が直接読み込むライブラリ、
「推移的な依存」はそれらがさらに読み込むライブラリである（2026-11-27に、`@marp-team/marp-core@4.4.0`を
`esbuild`（`bundle` / `minify` / `platform: 'browser'`）でバンドルし直して取り込まれるパッケージを
metafileで列挙し、実体の`vendor/marp/marp-core.bundle.mjs`と照合して作成。パッチバージョンは
再ビルド時の解決結果により前後し得るが、パッケージの構成とライセンスは変わらない）。

### 直接の依存

| ライブラリ名 | ライセンス | ライセンス全文 |
| --- | --- | --- |
| `@marp-team/marpit` | MIT | `LICENSES/marp-core-dependencies/marpit-LICENSE.txt` |
| `@marp-team/marpit-svg-polyfill` | MIT | `LICENSES/marp-core-dependencies/marpit-svg-polyfill-LICENSE.txt` |
| `highlight.js` | BSD-3-Clause | `LICENSES/marp-core-dependencies/highlight.js-LICENSE.txt` |
| `katex` | MIT | `LICENSES/marp-core-dependencies/katex-LICENSE.txt` |
| `mathjax-full` | Apache-2.0 | `LICENSES/marp-core-dependencies/mathjax-full-LICENSE.txt` |
| `postcss-selector-parser` | MIT | `LICENSES/marp-core-dependencies/postcss-selector-parser-LICENSE.txt` |
| `xss` | MIT | `LICENSES/marp-core-dependencies/xss-LICENSE.txt` |

### 推移的な依存

| ライブラリ名 | ライセンス | ライセンス全文 |
| --- | --- | --- |
| `postcss` | MIT | `LICENSES/marp-core-dependencies/postcss-LICENSE.txt` |
| `nanoid`（postcssが使用。3.x） | MIT | `LICENSES/marp-core-dependencies/nanoid-LICENSE.txt` |
| `picocolors` | ISC | `LICENSES/marp-core-dependencies/picocolors-LICENSE.txt` |
| `source-map-js` | BSD-3-Clause | `LICENSES/marp-core-dependencies/source-map-js-LICENSE.txt` |
| `@csstools/postcss-is-pseudo-class` | MIT-0 | `LICENSES/marp-core-dependencies/csstools-postcss-is-pseudo-class-LICENSE.txt` |
| `@csstools/selector-resolve-nested` | MIT-0 | `LICENSES/marp-core-dependencies/csstools-selector-resolve-nested-LICENSE.txt` |
| `@csstools/selector-specificity` | MIT-0 | `LICENSES/marp-core-dependencies/csstools-selector-specificity-LICENSE.txt` |
| `postcss-nesting` | MIT-0 | `LICENSES/marp-core-dependencies/postcss-nesting-LICENSE.txt` |
| `cssesc` | MIT | `LICENSES/marp-core-dependencies/cssesc-LICENSE.txt` |
| `cssfilter`（`xss`が使用） | MIT | `LICENSES/marp-core-dependencies/cssfilter-LICENSE.txt` |
| `markdown-it`（marpitが使用。14.x。上記の`vendor/markdown-it/`とは別のバンドル内コピー） | MIT | `LICENSES/marp-core-dependencies/markdown-it-LICENSE.txt` |
| `markdown-it-front-matter` | MIT | `LICENSES/marp-core-dependencies/markdown-it-front-matter-LICENSE.txt` |
| `linkify-it` | MIT | `LICENSES/marp-core-dependencies/linkify-it-LICENSE.txt` |
| `mdurl` | MIT | `LICENSES/marp-core-dependencies/mdurl-LICENSE.txt` |
| `uc.micro` | MIT | `LICENSES/marp-core-dependencies/uc.micro-LICENSE.txt` |
| `punycode.js` | MIT | `LICENSES/marp-core-dependencies/punycode.js-LICENSE.txt` |
| `entities` | BSD-2-Clause | `LICENSES/marp-core-dependencies/entities-LICENSE.txt` |
| `js-yaml` | MIT | `LICENSES/marp-core-dependencies/js-yaml-LICENSE.txt` |
| `lodash.kebabcase` | MIT | `LICENSES/marp-core-dependencies/lodash.kebabcase-LICENSE.txt` |
| `mhchemparser`（`mathjax-full`が使用） | Apache-2.0 | `LICENSES/marp-core-dependencies/mhchemparser-LICENSE.txt` |
| `util-deprecate` | MIT | `LICENSES/marp-core-dependencies/util-deprecate-LICENSE.txt` |

### バンドルのCSSに含まれるスタイル

`@marp-team/marp-core`のdefaultテーマ（`themes/default.scss`）は、`github-markdown-css` 5.9.0の
CSSをコンパイルして取り込んでいる。`esbuild`のmetafileには現れないが、`vendor/marp/marp-core.bundle.mjs`
内のdefaultテーマのCSSに含まれる（gaia / uncoverテーマには含まれない）。

| ライブラリ名 | ライセンス | ライセンス全文 |
| --- | --- | --- |
| `github-markdown-css`（defaultテーマのCSS） | MIT（Copyright (c) Sindre Sorhus） | `LICENSES/marp-core-dependencies/github-markdown-css-LICENSE.txt` |

「HTML出力」「印刷」で生成するスライドHTMLは、このCSSを埋め込むため、`<style>`の先頭に
Marp Core・Marpitと、`highlight.js`（コードのシンタックスハイライトのCSS。全テーマ）、
`github-markdown-css`（defaultテーマのみ）のライセンス全文をコメントとして残している
（`js/slide-licenses.js`。利用者の本文・画像は対象外）。

## docx

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

上記の直接依存がさらに読み込むライブラリも、`docx@9.7.1`の配布物（`dist/index.mjs`）の時点で取り込まれており、
`vendor/docx/docx.esm.min.mjs`に含まれている。ライセンス全文を`LICENSES/docx-dependencies/`に同梱している。

| ライブラリ名 | ライセンス | ライセンス全文 |
| --- | --- | --- |
| `pako`（`jszip`が使用） | MIT AND Zlib | `LICENSES/docx-dependencies/pako-LICENSE.txt` |
| `lie`（`jszip`が使用） | MIT | `LICENSES/docx-dependencies/lie-LICENSE.txt` |
| `immediate`（`lie`が使用） | MIT | `LICENSES/docx-dependencies/immediate-LICENSE.txt` |
| `setimmediate`（`jszip`が使用） | MIT | `LICENSES/docx-dependencies/setimmediate-LICENSE.txt` |
| `readable-stream`（`jszip`が使用。2.x） | MIT（Node.js由来部分を含む） | `LICENSES/docx-dependencies/readable-stream-LICENSE.txt` |
| `core-util-is` / `inherits` / `isarray` / `process-nextick-args` / `safe-buffer` / `string_decoder` / `util-deprecate`（`readable-stream`等が使用） | MIT（`inherits`はISC） | `LICENSES/docx-dependencies/`配下の同名`-LICENSE.txt` |
| `minimalistic-assert`（`hash.js`が使用） | ISC | `LICENSES/docx-dependencies/minimalistic-assert-LICENSE.txt` |
| `sax`（`xml-js`が使用） | ISC（1.4.1以前）またはBlue Oak Model License 1.0.0（1.4.2以降） | `LICENSES/docx-dependencies/sax-LICENSE.txt`（両方の全文を収録） |

`isarray`は配布物に独立したライセンスファイルがないため、READMEに記載されたMIT Licenseの全文を
`isarray-LICENSE.txt`として収録している。`pako`のZlibライセンスは`pako-LICENSE.txt`に含まれる。

## slide / iSlide との関係

MarkdownUtilのスライドプレビュー機能は、[`slide`リポジトリ](https://github.com/YanTKYS/slide)の
`iSlide`（MIT License）で検証済みだったMarp Core利用方式（初期化オプション、iframe +
`postMessage`によるプレビュー分離、リモートWebフォント`@import`の除去、HTML出力・印刷・
プレゼン表示の組み立て方）を参考に、MarkdownUtil向けへ再構成して実装した。iSlideのHTML/CSSや
エディタ・ファイル入出力・localStorage自動保存・splitter等はそのまま移植しておらず、
MarkdownUtil自身のUI・データフロー（AnyDoc変換・編集・保存等）に合わせて
`js/slide-preview.js`として書き直している。

## それ以外の依存

上記以外の外部ライブラリは使用していません。ファイル保存・クリップボードコピー等は
ブラウザ標準API（`Blob` / `URL.createObjectURL` / `Clipboard API` など）のみで実装しています。

## 追加時の方針

新たに外部ライブラリを追加する場合は、標準Web APIで代替できないかをまず検討し、
必要と判断した場合のみ `vendor/` へ実体を配置し、本ファイルへライブラリ名・バージョン・
ライセンス・入手元・利用目的を追記してください。
