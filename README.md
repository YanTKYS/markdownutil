# MarkdownUtil

閉域環境（インターネットに接続できない庁内LAN等）でも利用できる、文書 → Markdown変換・
Markdown編集・Markdownプレビューを1画面にまとめたブラウザツールです。

Word・Excel・PowerPoint・PDF・CSV・RTF・OpenDocument等の文書を、サーバへアップロードせず
ブラウザ内だけでMarkdownへ変換します。文書内容はブラウザの外へ一切送信されません。

v0.1.0は、文書変換エンジン [AnyDoc](https://github.com/firecrawl/anydoc) のWebAssembly版
（`@firecrawl/anydoc-wasm`）が実際の業務文書で実用に耐えるかを検証することを主目的とした試験版
ですが、単なる技術検証にとどまらず「開く → 変換 → 編集 → プレビュー → コピー／保存」まで
一連の操作ができる実用可能な状態を目指しています。

## 特徴

- AnyDoc WASMによる、ブラウザ内・完全ローカルの文書→Markdown変換
- Markdown編集（標準`textarea`によるシンプルなエディタ）
- Markdownプレビュー（`markdown-it`によるリアルタイム表示、安全側の設定で生HTMLは無効）
- Markdownの保存（`.md`ファイルとしてダウンロード）
- Markdownのコピー（クリップボードへ一括コピー）
- 外部API不要・CDN不要・インターネット接続不要
- 静的Webサーバ（IIS等）に配置するだけで利用可能
- Node.js / Python / .NET等のランタイムを利用者端末に要求しない（ビルド時のみNode.jsを使用）

## 利用方法

1. `index.html` をブラウザで開く（またはIIS等で配信されたURLへアクセスする）
2. ツールバーの「ファイルを開く」から文書を選択する、または編集領域へファイルをドラッグ&ドロップする
3. 対応文書であれば自動的にMarkdownへ変換される（`.md` / `.markdown` / `.txt` はそのまま読み込まれる）
4. 左側のMarkdown編集領域で内容を必要に応じて編集する
5. 右側のプレビューで表示結果を確認する
6. 「Markdownをコピー」でクリップボードへコピー、または「Markdownを保存」で`.md`ファイルとして保存する

画面上部のステータス表示に、変換完了・読み込み完了・変換中・エラー等の状態が随時表示されます。

## 画面構成

```text
┌─────────────────────────────────────────────┐
│ MarkdownUtil                                 │
│ [ファイルを開く][Markdownを保存][コピー][クリア] │
│ sample.docx → Markdown変換完了                │
├────────────────────┬──────────────────────────┤
│ Markdown           │ プレビュー                │
│ (textarea編集領域)  │ (markdown-itによる表示)   │
└────────────────────┴──────────────────────────┘
```

画面幅が狭い場合（目安860px以下）は、左右2ペインが上下に切り替わります。

## 対応形式

### AnyDocを経由して変換（動作確認済み）

以下は実際にサンプル文書を用いて変換・表示まで確認済みです。

| 形式 | 拡張子例 | 確認内容 |
| --- | --- | --- |
| Word | `.doc` `.docx` | 見出し・段落・太字/斜体・箇条書き・番号付きリスト・表 |
| Excel | `.xls` `.xlsx` | セル値・表構造・複数シート（シートごとに見出し＋表として出力） |
| PowerPoint | `.ppt` `.pptx` | スライドごとの見出し・本文・表 |
| PDF（テキストを含むもの） | `.pdf` | 段落・複数ページにまたがる内容 |
| CSV | `.csv` | 表への変換 |
| RTF | `.rtf` | 段落・簡易的な書式 |
| OpenDocument Text | `.odt` | 見出し・段落・箇条書き・表 |

### AnyDocが対応しているが本検証では未確認の形式

AnyDocの仕様上は以下も変換対象ですが、v0.1.0のテストでは代表的なサンプルを用意できなかった
ため未確認です。実際の業務文書での挙動は今後の利用の中で確認してください。

- `.docm` `.pptm` `.xlsm` `.xlsb` `.pps` `.ppsx` などのマクロ有効/派生形式（本体形式のパーサーで変換）
- `.ods`（表計算）・`.odp`（プレゼンテーション）
- `.epub`

### AnyDocを経由せず、そのまま読み込む形式

- `.md` / `.markdown`：Markdownとしてそのままエディタへ
- `.txt`：プレーンテキストとしてそのままエディタへ

文字コードはUTF-8を基本とします。

### 対応形式の管理方針

アプリ側では対応拡張子の一覧を重複して持たず、AnyDoc自身が公開している
`formatFromPath()` / `formatFromBytes()` の判定結果を変換可否の正本として利用しています
（`js/converter.js` 参照）。ファイル選択ダイアログの絞り込み表示のみ、UI上のヒントとして
別途一覧を持っています。

## ディレクトリ構成

```text
markdownutil/
├─ index.html          自作: 画面本体
├─ css/
│  └─ app.css           自作: スタイル
├─ js/
│  ├─ app.js             自作: UI全体（ファイル選択・D&D・保存・コピー・クリア・ステータス表示）
│  ├─ converter.js       自作: AnyDoc WASMの初期化・呼び出し・エラー正規化
│  └─ preview.js          自作: markdown-itによるプレビュー描画
├─ vendor/
│  ├─ anydoc/            外部: AnyDoc WASM本体（@firecrawl/anydoc-wasm, MIT）
│  └─ markdown-it/       外部: markdown-it本体（MIT）
├─ docs/
│  └─ TESTING.md         実施したテストの記録
├─ LICENSES/             サードパーティライセンス文書
└─ README.md
```

自作コード（`index.html` / `css/` / `js/`）と外部ライブラリ（`vendor/`）は明確に分離しています。

## IISなど静的Webサーバへの配置

MarkdownUtilはビルド済みの静的ファイル一式です。`markdownutil/` フォルダ全体を、IIS等の
静的Webサーバの公開フォルダへ配置するだけで利用できます。サーバ側での文書変換処理は
一切行わないため、追加のアプリケーションプール設定やランタイムのインストールは不要です。

### `.wasm` の配信について

- `vendor/anydoc/anydoc_wasm_bg.wasm` は静的ファイルとしてそのまま配信できます。
- `js/app.js` はESモジュール（`<script type="module">`）としてブラウザから直接読み込まれ、
  AnyDocの初期化コード（`vendor/anydoc/anydoc_wasm.js`）は自分自身のファイルパスを基準に
  `anydoc_wasm_bg.wasm` を相対パスで取得します。そのため `markdownutil/` フォルダごと配置
  場所（サブフォルダ・仮想ディレクトリ）を変更しても、内部の相対配置さえ崩さなければ
  正常に動作します。
- 望ましいMIME typeは `application/wasm` です。IISのバージョンやサーバ設定によっては
  `.wasm` にこのMIME typeが登録されておらず、`application/octet-stream` 等で配信される
  場合があります。その場合もAnyDoc側に自動フォールバック処理があるため動作はしますが
  （`WebAssembly.instantiateStreaming` が使えず `WebAssembly.instantiate` にフォールバック
  し、初期化がわずかに遅くなります）、可能であれば以下のいずれかの方法でMIME typeを
  登録することを推奨します。
  - IISマネージャーの「MIME の種類」で、拡張子 `.wasm` に種類 `application/wasm` を追加する
  - 既存の`web.config`がある場合は、`<staticContent>` セクションへ以下を追記する

    ```xml
    <staticContent>
      <remove fileExtension=".wasm" />
      <mimeMap fileExtension=".wasm" mimeType="application/wasm" />
    </staticContent>
    ```

  既存のIIS設定・`web.config`と競合する可能性があるため、本リポジトリでは`web.config`を
  同梱していません。必要に応じて配置環境側で追加してください。

## 閉域環境での利用について

- CDNを利用していません。AnyDoc・markdown-itを含め、必要なファイルはすべて`vendor/`配下に
  同梱されています。
- 外部APIを利用していません。文書の変換・Markdownのレンダリングはすべてブラウザ内で完結します。
- 選択した文書の内容をサーバへアップロードすることはありません。
- 実行時にインターネット接続を必要としません（初回アクセス時も含め、外部ホストへの通信は
  発生しません）。
- テレメトリ・アクセス解析等の外部送信も行っていません。
- localStorage / sessionStorage / IndexedDB / Cookie / 外部サーバのいずれにも、読み込んだ
  文書やMarkdown本文を保存しません。ページを閉じると内容は消えます（明示的に
  「Markdownを保存」した場合のみファイルとして残ります）。

上記は開発者ツールのNetworkタブで外部ホストへの通信が発生しないことを確認済みです
（`docs/TESTING.md` 参照）。

## 既知の制限（v0.1.0）

- 元文書のレイアウトを完全に再現するものではありません。MarkdownはあくまでMarkdownとして
  表現可能な範囲に変換されます。
- 複雑な表・段組み・図形を多用したレイアウトは、変換結果が崩れる、または簡略化される場合が
  あります。
- PDFは元データの構造（テキストの埋め込み方や配置）により、変換品質が変わります。段落や
  改行の境界がPDF側の情報に依存するため、意図と異なる位置で改行・分割される場合があります。
- スキャンPDF・画像だけで構成されたPDFはテキストを抽出できず、変換できません。その場合は
  「このPDFからテキストを取得できませんでした。スキャンPDFには対応していない可能性があります。」
  と表示されます。本ツールはOCR機能を持たず、外部サービスへの送信も行いません。
- 画像・図形・埋め込みオブジェクト等は、Markdownの性質上、元文書と同等には再現されません
  （AnyDocの`toDocument`はアセット情報を保持しますが、v0.1.0の変換フローでは
  `toMarkdownBytes`によるMarkdown直接出力のみを利用しています）。
- パスワード保護・暗号化された文書は変換できません。
- v0.1.0はAnyDocの実用性確認を兼ねた試験版であり、対応形式のうち代表的なものしか
  実文書で検証していません（「対応形式」の章を参照）。
- 複数ファイルの一括変換、OCR、AIによる補正、Markdown構文補完、WYSIWYG編集、複数文書の
  タブ管理、自動保存、履歴管理、クラウド保存などはv0.1.0の対象外です。

## サードパーティライブラリとライセンス

同梱している外部ライブラリの名称・バージョン・ライセンス・入手元・利用目的は
[`LICENSES/THIRD_PARTY_NOTICES.md`](LICENSES/THIRD_PARTY_NOTICES.md) にまとめています。
ライセンス全文は`LICENSES/`および各`vendor/*/LICENSE`を参照してください。

- AnyDoc WASM（`@firecrawl/anydoc-wasm`）: MIT License
- markdown-it: MIT License

## テストについて

実施した変換・操作・異常系・閉域確認の一覧と結果は
[`docs/TESTING.md`](docs/TESTING.md) に記載しています。

## 開発メモ（ビルドについて）

配布物自体は静的ファイルのみで、利用時にNode.js等は不要です。ただし本リポジトリの
`vendor/`配下は、npmで公開されている`@firecrawl/anydoc-wasm`と`markdown-it`のビルド済み
成果物をそのまま取り込んだものです。更新する場合は、それぞれのnpmパッケージを取得し、
ブラウザ向けビルド成果物（AnyDocは`anydoc_wasm.js` / `anydoc_wasm_bg.wasm` /
`anydoc_wasm.d.ts`、markdown-itは`dist/browser/markdown-it.esm.min.mjs`）を
`vendor/`配下へ差し替えてください。
