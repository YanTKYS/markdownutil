# 依存ライブラリの管理

MarkdownUtilが同梱している外部ライブラリの管理方針をまとめます。ライブラリごとの
ライセンス・入手元・利用目的は[`LICENSES/THIRD_PARTY_NOTICES.md`](../LICENSES/THIRD_PARTY_NOTICES.md)、
各形式の変換仕様は[`docs/formats.md`](formats.md)を参照してください。

## 管理対象

| id | ライブラリ | 用途 |
| --- | --- | --- |
| `anydoc` | AnyDoc WASM（`@firecrawl/anydoc-wasm`） | 文書 → Markdown変換 |
| `markdown-it` | markdown-it | Markdownプレビュー |
| `marp` | Marp Core（`@marp-team/marp-core`） | スライド表示 |
| `docx` | docx | Word出力 |

## 正本

[`vendor/manifest.json`](../vendor/manifest.json)を、MarkdownUtilが現在同梱している
外部ライブラリとバージョンの正本とします。README.mdのライブラリ一覧表、
`LICENSES/THIRD_PARTY_NOTICES.md`のバージョン表記は、このファイルの内容と一致させてください。
`npm test`にこの一致を検証するテスト（`test/vendor-manifest.test.js`）があり、
1箇所だけ更新して他が古いままになる状態を検知できます。

## 更新時の原則

```text
upstream最新版確認
↓
release note / breaking change確認
↓
公式成果物取得
↓
vendor差し替え
↓
manifest更新
↓
ライセンス確認
↓
回帰テスト
↓
docs更新
```

配布物自体は静的ファイルのみで、利用者端末にNode.js等は不要です。`vendor/`配下の
更新作業自体にはNode.jsを使用します（`esbuild`での再バンドルを含む）。

## ライブラリ別の注意

### AnyDoc WASM

npm配布物の3ファイル（`anydoc_wasm.js` / `anydoc_wasm_bg.wasm` / `anydoc_wasm.d.ts`）を、
**同一リリースから同時に取得**してください。WASM本体だけ新しくしてJS glueやTypeScript
定義が旧バージョンのまま、といった部分更新は禁止です。npm配布物に含まれる
`package.json` / `LICENSE` / `README.md`（`UPSTREAM_README.md`として配置）もあわせて
取り込みます。

- 取得元: `https://registry.npmjs.org/@firecrawl/anydoc-wasm/-/anydoc-wasm-<version>.tgz`
- 配置先: `vendor/anydoc/`
- バージョン確認: `vendor/anydoc/package.json`の`version`

### markdown-it

ブラウザ向けESMビルド（`dist/browser/markdown-it.esm.min.mjs`）を、npm配布物そのまま
`vendor/markdown-it/markdown-it.esm.min.mjs`として配置します。再バンドルは不要です。

- 配置先: `vendor/markdown-it/`
- バージョン確認: `vendor/markdown-it/package.json`の`version`

### Marp Core

npmパッケージをそのまま配置するのではなく、**MarkdownUtil向けに再バンドルが必要**です。
`@marp-team/marp-core`をエントリポイントとして`esbuild`で
`format: 'esm', bundle: true, minify: true, platform: 'browser'`でビルドし、
`vendor/marp/marp-core.bundle.mjs`として配置します（[`slide`リポジトリ](https://github.com/YanTKYS/slide)の
`build/build.mjs`と同様の方法）。`vendor/marp/`には`package.json`を置いていないため、
バージョンはバンドル先頭のコメント（`/* @marp-team/marp-core (vX.Y.Z, MIT) ... */`）と
`vendor/manifest.json`で管理します。

再ビルド後は、CDN依存やリモートアセット（Webフォントの`@import`、絵文字画像化のCDN等）が
バンドルへ混入していないことを確認してください（詳細は[`docs/slides.md`](slides.md)の
「外部通信について」を参照）。

- 配置先: `vendor/marp/`
- バージョン確認: `vendor/marp/marp-core.bundle.mjs`先頭のコメント、および`vendor/manifest.json`

### docx

npmパッケージをそのまま配置するのではなく、**ブラウザ向けに再バンドルが必要**です。
npmパッケージの`dist/index.mjs`をエントリポイントとして`esbuild`でブラウザ向けESM
単一ファイルへ再バンドル・minifyし、`vendor/docx/docx.esm.min.mjs`として配置します。

再ビルド後は、bundle内へ取り込まれる依存ライブラリ（`jszip` / `nanoid` / `hash.js` /
`xml` / `xml-js`等）のバージョン・ライセンスも
[`LICENSES/docx-dependencies/`](../LICENSES/docx-dependencies/)とあわせて確認してください。

- 配置先: `vendor/docx/`
- バージョン確認: `vendor/docx/package.json`の`version`

## テストの実行

`vendor/`を更新したら、バージョン整合性テストを含むユニットテストを実行してください。

```bash
npm test
```

`test/vendor-manifest.test.js`が、`vendor/manifest.json`と各vendor配下・README.md・
`LICENSES/THIRD_PARTY_NOTICES.md`の不一致を検出します。実ブラウザでの確認項目は
[`docs/TESTING.md`](TESTING.md)を参照してください。
