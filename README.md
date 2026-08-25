# MarkdownUtil

閉域環境（インターネットに接続できない庁内LAN等）でも利用できる、文書 → Markdown変換・
Markdown編集・Markdownプレビュー・スライド表示・Word出力を1画面にまとめたブラウザツールです。

Word・Excel・PowerPoint・PDF・CSV・RTF・OpenDocument等の文書を、サーバへアップロードせず
ブラウザ内だけでMarkdownへ変換します。文書内容はブラウザの外へ一切送信されません。

## 主な機能

- AnyDoc WASMによる、ブラウザ内・完全ローカルの文書 → Markdown変換
- Markdown編集（`textarea`）とMarkdownプレビュー（`markdown-it`。生HTMLは無効化した
  安全側の設定）
- Marp Coreによるスライドプレビュー・HTML出力・印刷（PDF化）・プレゼン表示（発表者ビュー付き）
- Markdownの保存（`.md`ダウンロード）・コピー
- Markdown → Word（`.docx`）出力（`docx`ライブラリ、Microsoft Word不要）
- Markdown / Marpの記法早見表と、文書 / スライドのサンプルを試せる「? ヘルプ」
- 外部API不要・CDN不要・インターネット接続不要。静的Webサーバ（IIS等）に配置するだけで
  利用可能
- 利用者端末にNode.js等のランタイムは不要（本リポジトリの開発・ビルド時のみNode.jsを使用）

## 基本的な使い方

1. IIS等の静的Webサーバへ`markdownutil/`フォルダを配置し、配信されたURLへブラウザでアクセスする
   （`file://`で`index.html`を直接開くと動作しません。詳しくは「配置・閉域利用」を参照）
2. ツールバーの「ファイルを開く」から文書を選択する、または編集領域へファイルをドラッグ&ドロップする
3. 対応文書であれば自動的にMarkdownへ変換される（`.md` / `.markdown` / `.txt` はそのまま読み込まれる）
4. 左側のMarkdown編集領域で内容を必要に応じて編集する
5. 右側のプレビューで表示結果を確認する。「文書」ではmarkdown-itによる通常のプレビュー、
   「スライド」ではMarp Coreによるスライドプレビューを表示する
6. 「Markdownをコピー」でクリップボードへコピー、または「Markdownを保存」で`.md`ファイルとして保存する

画面上部のステータス表示に、変換完了・読み込み完了・変換中・エラー等の状態が随時表示されます。
左右2ペイン構成で、画面幅が狭い場合（目安860px以下）は上下に切り替わります。

## 対応形式

Word・Excel・PowerPoint・PDF（テキストを含むもの）・CSV・RTF・OpenDocument・EPUBを、
AnyDoc WASM経由でMarkdownへ変換します。`.md` / `.markdown` / `.txt` はAnyDocを経由せず
そのままエディタへ読み込みます。

文書からMarkdownで表現できる文章構造や内容を抽出します。元文書のレイアウトや装飾を
完全に再現することは目的としていません。

形式ごとの対応拡張子・変換仕様（数式・チェックボックス・PDF・Spreadsheetの扱い等）の詳細は
[`docs/formats.md`](docs/formats.md)を参照してください。

## 同梱ライブラリ

| ライブラリ | バージョン | 用途 |
| --- | --- | --- |
| AnyDoc WASM | 0.2.3 | 文書 → Markdown変換 |
| markdown-it | 15.0.0 | Markdownプレビュー |
| Marp Core | 4.4.0 | スライド表示 |
| docx | 9.7.1 | Word出力 |

いずれもMIT Licenseで、CDNや実行時のダウンロードには依存せず`vendor/`配下に実体を
同梱しています。同梱バージョンの正本は[`vendor/manifest.json`](vendor/manifest.json)です。
ライセンス・入手元・利用目的の詳細は
[`LICENSES/THIRD_PARTY_NOTICES.md`](LICENSES/THIRD_PARTY_NOTICES.md)、更新手順は
[`docs/dependencies.md`](docs/dependencies.md)を参照してください。

## 配置・閉域利用

- IIS等の静的Webサーバの公開フォルダへ配置するだけで利用できます。サーバ側での文書変換
  処理は行わないため、追加のランタイムのインストールは不要です。
- `file://`で`index.html`を直接開くと、ESモジュールがブラウザのCORS制約で読み込めません。
  HTTP配信が必須です（開発時のローカル確認も簡易HTTPサーバ経由で行ってください）。
- `.wasm`（AnyDoc本体）と`.mjs`（markdown-it・Marp Coreのビルド済みESモジュール）を静的
  ファイルとして配信します。IISでは`.wasm → application/wasm`のMIME設定を確認してください
  （未登録でも動作はしますが初期化がわずかに遅くなります。`.mjs`が未登録の場合は404になり
  画面が動作しません）。
- 外部API・CDNへの通信は行いません。文書の変換・Markdownのレンダリングはすべてブラウザ内で
  完結し、インターネット接続を必要とせず、選択した文書をサーバへアップロードすることも
  ありません。

IIS配置時の詳しいMIME設定手順、閉域環境での確認項目、CSPの設定内容は
[`docs/deployment.md`](docs/deployment.md)を参照してください。

## 詳細ドキュメント

- [対応形式・変換仕様](docs/formats.md)
- [スライドプレビュー（Marp）](docs/slides.md)
- [Markdown → Word出力](docs/word-export.md)
- [配置・閉域利用](docs/deployment.md)
- [依存ライブラリの管理](docs/dependencies.md)
- [テスト記録](docs/TESTING.md)
- [リリースノート](docs/release-note.md)
- [Third-party notices](LICENSES/THIRD_PARTY_NOTICES.md)
