# MarkdownUtil

閉域環境（インターネットに接続できない庁内LAN等）でも利用できる、文書 → Markdown変換・
Markdown編集・Markdownプレビューを1画面にまとめたブラウザツールです。

Word・Excel・PowerPoint・PDF・CSV・RTF・OpenDocument等の文書を、サーバへアップロードせず
ブラウザ内だけでMarkdownへ変換します。文書内容はブラウザの外へ一切送信されません。

v0.1.0では、文書変換エンジン [AnyDoc](https://github.com/firecrawl/anydoc) のWebAssembly版
（`@firecrawl/anydoc-wasm`）が実際の業務文書で実用に耐えるかを検証することを主目的とした
試験版として、「開く → 変換 → 編集 → プレビュー → コピー／保存」まで一連の操作ができる
状態を実装しました。

v0.2.0では、右ペインのプレビューに通常のMarkdown表示（文書モード）に加えて、
[Marp Core](https://github.com/marp-team/marp-core) によるスライドプレビュー（スライドモード）を
追加しました。同じMarkdownを、通常の文書としても、Marp記法によるスライドとしても確認できます。
スライド機能は [`slide`リポジトリ](https://github.com/YanTKYS/slide) の `iSlide` で検証済みの
実装方式を参考にしています（詳細は「スライドプレビュー」章と
[`LICENSES/THIRD_PARTY_NOTICES.md`](LICENSES/THIRD_PARTY_NOTICES.md) を参照）。

## 特徴

- AnyDoc WASMによる、ブラウザ内・完全ローカルの文書→Markdown変換
- Markdown編集（標準`textarea`によるシンプルなエディタ）
- Markdownプレビュー（`markdown-it`によるリアルタイム表示、安全側の設定で生HTMLは無効）
- Marp Coreによるスライドプレビュー（v0.2.0、標準的なMarp Markdownをそのまま表示）
- Markdownの保存（`.md`ファイルとしてダウンロード）
- Markdownのコピー（クリップボードへ一括コピー）
- スライドのHTML出力・印刷（PDF化）・プレゼン表示（v0.2.0）
- 外部API不要・CDN不要・インターネット接続不要
- 静的Webサーバ（IIS等）に配置するだけで利用可能
- Node.js / Python / .NET等のランタイムを利用者端末に要求しない（ビルド時のみNode.jsを使用）

## 利用方法

1. IIS等の静的Webサーバへ`markdownutil/`フォルダを配置し、配信されたURLへブラウザでアクセスする
   （`js/app.js`はESモジュールとしてimportを使って構成されているため、`file://`で`index.html`を
   直接開くとブラウザのCORS制約によりモジュールを読み込めません。開発時にローカルで確認する
   場合も、`python3 -m http.server`等の簡易HTTPサーバ経由で開いてください）
2. ツールバーの「ファイルを開く」から文書を選択する、または編集領域へファイルをドラッグ&ドロップする
3. 対応文書であれば自動的にMarkdownへ変換される（`.md` / `.markdown` / `.txt` はそのまま読み込まれる）
4. 左側のMarkdown編集領域で内容を必要に応じて編集する
5. 右側のプレビューで表示結果を確認する。「文書」ではmarkdown-itによる通常のプレビュー、
   「スライド」ではMarp Coreによるスライドプレビューを表示する
6. 「Markdownをコピー」でクリップボードへコピー、または「Markdownを保存」で`.md`ファイルとして保存する

画面上部のステータス表示に、変換完了・読み込み完了・変換中・エラー等の状態が随時表示されます。

## 画面構成

```text
┌───────────────────────────────────────────────────────────────┐
│ MarkdownUtil                                                   │
│ [ファイルを開く][Markdownを保存][コピー][クリア]                │
│ sample.docx → Markdown変換完了                                  │
├────────────────────┬────────────────────────────────────────────┤
│ Markdown           │ プレビュー [文書][スライド]  (スライド専用操作) │
│                    │                                            │
│ (textarea編集領域)  │ 文書モード: markdown-itによる表示            │
│                    │ スライドモード: Marp Coreによるスライド表示   │
└────────────────────┴────────────────────────────────────────────┘
```

「文書」「スライド」の切替は右ペイン上部で行います。テーマ・HTML出力・印刷・プレゼン表示は
スライドモードの時だけ表示され、通常のMarkdown編集・プレビュー中はツールバーがごちゃつかない
ようにしています。

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

## スライドプレビュー（Marp、v0.2.0）

右ペインの「スライド」タブでは、エディタと同じMarkdownを [Marp Core](https://github.com/marp-team/marp-core)
でレンダリングし、スライドとして表示します。**Markdownが唯一のデータ**であり、スライド専用の
別ファイル形式は持ちません。モードを切り替えるだけではMarkdown本文を書き換えません。

### 通常プレビューとの違い

| | 文書モード | スライドモード |
| --- | --- | --- |
| 使用ライブラリ | markdown-it | Marp Core |
| 表示内容 | 見出し・段落等を上から下へ通常のドキュメントとして表示 | `---`で区切られたスライドを1枚ずつ表示 |
| Markdownへの影響 | なし | なし（テーマをドロップダウンで変更した場合のみfront matterへ反映） |
| 専用操作 | なし | テーマ・HTML出力・印刷・プレゼン表示 |

AnyDocが生成したMarkdownや`.md`/`.txt`をそのまま読み込んだ場合など、Marp向けのfront matter
（`marp: true`等）が無いMarkdownでも、可能な範囲でスライドとして表示します（`---`が無ければ
1枚のスライドとして表示されます）。スライド表示するだけでfront matterが自動的に挿入される
ことはありません。

スライド表示に使うMarp Coreは、初めて「スライド」へ切り替えたときに読み込みます
（起動を軽くするため）。そのため初回の切替時のみ「スライドを準備しています...」と表示され、
わずかに時間がかかります。2回目以降はすぐに表示されます。

### Marp Markdownの例

```markdown
---
marp: true
theme: default
paginate: true
---

# タイトル

説明

---

## 2枚目

- 項目1
- 項目2
```

先頭のYAML front matterで設定を行い、`---`の行でスライドを区切ります。表・箇条書き・
コードブロック・リンク・画像など、通常のMarkdown記法もそのまま利用できます。詳しい記法は
[Marpの公式ドキュメント](https://marpit.marp.app/)を参照してください。

### テーマ

`default` / `gaia` / `uncover` の3つの標準テーマに対応しています。ツールバーのテーマ選択を
変更すると、その値がfront matterの`theme:`へ書き込まれます（front matterが無い場合は
`marp: true`とともに新設します）。そのため、テーマを切り替えてもMarkdownはMarp互換のまま
保たれ、他のMarp対応ツールで開いても同じテーマで表示されます。Markdown中に未知のテーマ名が
書かれている場合、それを消したり上書きしたりすることはありません（テーマ選択欄の表示だけ
`default`にフォールバックします）。独自テーマの登録機能はv0.2.0では用意していません。

### HTML出力

「HTML出力」で、現在のスライドを1つのHTMLファイルとしてダウンロードできます。スライドの
HTMLとCSSを内包しているため、そのファイル単体をブラウザで開くだけで閲覧できます（外部通信は
発生しません）。

### 印刷 / PDF化

「印刷」を押すと、印刷用に整形したスライドが新しいタブで開き、ブラウザの印刷ダイアログが
表示されます。送信先に「PDFに保存」を選ぶとPDFとして保存できます。独自のPDF生成エンジンは
持たず、ブラウザの印刷機能を利用します。用紙サイズはスライドサイズ（既定1280×720px）に
合わせて指定済みです。印刷設定では余白「なし」・背景のグラフィック「オン」を確認してください。

### プレゼン表示

「プレゼン表示」で編集画面を隠し、スライドを画面いっぱいに1枚ずつ表示します。

| 操作 | キー |
| --- | --- |
| 次のスライド | `→` `↓` `Space` `PageDown` / クリック |
| 前のスライド | `←` `↑` `Shift+Space` `PageUp` |
| 最初 / 最後 | `Home` / `End` |
| 編集画面へ戻る | `Esc` |

### 外部通信について（外部URL画像の注意）

MarkdownUtil自身がスライド表示のために外部のAPI・CDN・Webフォントへ通信することはありません。
これを保つため、Marp Coreの既定動作のうち次の2点だけ設定を変えています。

- 絵文字：既定では画像（twemoji CDN）へ置き換えますが、これを無効にしフォントの絵文字で表示します。
- テーマのWebフォント：`gaia`テーマ等が`@import`で読み込む外部Webフォントを取り除き、
  テーマのフォールバックフォントで表示します（見た目のフォントのみ変わり、記法には影響しません）。

数式は外部リソースを必要としないMathJaxで描画します。

ただし、これはあくまで「MarkdownUtil自身が外部へアクセスしないこと」の保証です。編集中の
Markdownに`![](https://example.com/photo.jpg)`のような外部URLの画像やリンクを記述した場合、
その取得は通常のWebページと同様にブラウザが行うため、外部通信が発生します。閉域環境で確認する
場合は、画像をdata URIで埋め込むか、ローカル/相対パスの画像を使ってください。

## ディレクトリ構成

```text
markdownutil/
├─ index.html          自作: 画面本体
├─ css/
│  └─ app.css           自作: スタイル
├─ js/
│  ├─ app.js             自作: UI全体（ファイル選択・D&D・保存・コピー・クリア・モード切替・ステータス表示）
│  ├─ converter.js       自作: AnyDoc WASMの初期化・呼び出し・エラー正規化
│  ├─ preview.js          自作: markdown-itによる通常プレビュー描画
│  └─ slide-preview.js    自作: Marp Coreの初期化・レンダリング・iframe描画・テーマ・HTML出力・印刷・プレゼン表示
├─ vendor/
│  ├─ anydoc/            外部: AnyDoc WASM本体（@firecrawl/anydoc-wasm, MIT）
│  ├─ markdown-it/       外部: markdown-it本体（MIT）
│  └─ marp/              外部: Marp Core本体（@marp-team/marp-core, MIT）
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

### `.wasm` と `.mjs` の配信について

本ツールは`.wasm`（AnyDoc本体）に加えて、`.mjs`（markdown-itとMarp Coreのビルド済みESモジュール:
`vendor/markdown-it/markdown-it.esm.min.mjs`、`vendor/marp/marp-core.bundle.mjs`）も静的
ファイルとして配信します。いずれもIIS側で拡張子が未登録だと問題になるため、実機配置時は
すべて確認してください。

- `vendor/anydoc/anydoc_wasm_bg.wasm`、`vendor/markdown-it/markdown-it.esm.min.mjs`、
  `vendor/marp/marp-core.bundle.mjs` はいずれも静的ファイルとしてそのまま配信できます。
- `js/app.js` はESモジュール（`<script type="module">`）としてブラウザから直接読み込まれ、
  `js/converter.js`・`js/preview.js`・`js/slide-preview.js`もESモジュールのimportで
  読み込まれます。AnyDocの初期化コード（`vendor/anydoc/anydoc_wasm.js`）は自分自身の
  ファイルパスを基準に`anydoc_wasm_bg.wasm`を相対パスで取得します。そのため
  `markdownutil/` フォルダごと配置場所（サブフォルダ・仮想ディレクトリ）を変更しても、
  内部の相対配置さえ崩さなければ正常に動作します。
- `.wasm`の望ましいMIME typeは `application/wasm`、`.mjs`は`text/javascript`です。
  IISのバージョンやサーバ設定によっては、これらの拡張子がMIMEマップに未登録の場合があります。
  - `.wasm`が`application/octet-stream`等の誤ったMIME typeで配信された場合、AnyDoc側に
    自動フォールバック処理があるため動作はしますが（`WebAssembly.instantiateStreaming`が
    使えず`WebAssembly.instantiate`にフォールバックし、初期化がわずかに遅くなります）、
    MIME typeの登録を推奨します。
  - `.mjs`が未登録の場合、IISは拡張子そのものを認識できず**404**を返すことがあります
    （ブラウザのモジュール読み込みはMIME typeの厳格チェックも行うため、誤ったMIME typeで
    配信された場合も同様に失敗します）。そのため`.mjs`のMIME設定は`.wasm`以上に確認が
    必要です。影響範囲は次のとおりです。
    - `vendor/markdown-it/markdown-it.esm.min.mjs` が配信できない場合、画面全体が動作しません。
    - `vendor/marp/marp-core.bundle.mjs` が配信できない場合は、文書の変換・編集・通常プレビュー・
      保存・コピーはそのまま利用でき、スライドモードへ切り替えたときだけ
      「スライド表示機能を読み込めませんでした。」と表示されます（Marp Coreはスライドモードを
      初めて使うときに読み込むため、他の機能を巻き込みません）。
  - 実機IISでの配置後は、`.wasm`・`.mjs`双方について、ブラウザの開発者ツールのNetworkタブで
    200応答と想定どおりのContent-Typeで返っていることを必ず確認してください。
  - 登録方法は次のいずれかです。
    - IISマネージャーの「MIME の種類」で、拡張子`.wasm`に`application/wasm`、拡張子`.mjs`に
      `text/javascript`を追加する
    - 既存の`web.config`がある場合は、`<staticContent>`セクションへ以下を追記する

      ```xml
      <staticContent>
        <remove fileExtension=".wasm" />
        <mimeMap fileExtension=".wasm" mimeType="application/wasm" />
        <remove fileExtension=".mjs" />
        <mimeMap fileExtension=".mjs" mimeType="text/javascript" />
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

## 既知の制限

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
- v0.1.0はAnyDocの実用性確認を兼ねた試験版です。現時点のテスト（`docs/TESTING.md`）は
  プログラムで生成した単純なサンプル文書による基本的な変換性能の確認にとどまり、結合セルを
  多用した帳票Word、図形を多く含むPowerPoint、複雑なレイアウトのPDFといった実業務文書での
  変換品質はまだ確認できていません。IIS実機配置後、庁内の実文書を用いた検証を別途行う
  予定です。
- 複数ファイルの一括変換、OCR、AIによる補正、Markdown構文補完、WYSIWYG編集、複数文書の
  タブ管理、自動保存、履歴管理、クラウド保存などは対象外です。
- スライドプレビューは、AnyDocが生成した通常のMarkdownを「自動でスライドへ整形する」もの
  ではありません（見出しごとに`---`を自動挿入する、AIが要約する等の処理は行いません）。
  現在のMarkdownをそのままMarp記法として表示するだけなので、意図した枚数・区切りで
  スライド化するには、front matterや`---`区切りをMarkdown側に書く必要があります。
- 元のMarkdown中に水平線として`---`単体の行が含まれている場合、Marpはそれをスライド区切りと
  解釈します。これはMarp記法の仕様であり、MarkdownUtil側で特別に補正はしていません。
- スライド機能はPPTX出力、独自スライドエンジン、独自テーマエディタ、WYSIWYGスライド編集、
  複数資料管理を持ちません。
- スライドの一時編集内容をlocalStorage等へ自動保存する機能はありません（v0.1.0からの方針を
  継続しています）。

## サードパーティライブラリとライセンス

同梱している外部ライブラリの名称・バージョン・ライセンス・入手元・利用目的は
[`LICENSES/THIRD_PARTY_NOTICES.md`](LICENSES/THIRD_PARTY_NOTICES.md) にまとめています。
ライセンス全文は`LICENSES/`および各`vendor/*/LICENSE`を参照してください。

- AnyDoc WASM（`@firecrawl/anydoc-wasm`）: MIT License
- markdown-it: MIT License
- Marp Core（`@marp-team/marp-core`）: MIT License（内部で利用するhighlight.js等の
  ライセンスも`LICENSES/marp-core-dependencies/`にまとめています）

## テストについて

実施した変換・操作・異常系・閉域確認の一覧と結果は
[`docs/TESTING.md`](docs/TESTING.md) に記載しています。

## 開発メモ（ビルドについて）

配布物自体は静的ファイルのみで、利用時にNode.js等は不要です。ただし本リポジトリの
`vendor/`配下は、npmで公開されている`@firecrawl/anydoc-wasm`・`markdown-it`のビルド済み
成果物をそのまま取り込んだもの、および`@marp-team/marp-core`をMarkdownUtil向けに
ビルドし直したものです。更新する場合は、それぞれのnpmパッケージを取得し、以下を
`vendor/`配下へ差し替えてください。

- AnyDoc: `anydoc_wasm.js` / `anydoc_wasm_bg.wasm` / `anydoc_wasm.d.ts`（npm配布物そのまま）
- markdown-it: `dist/browser/markdown-it.esm.min.mjs`（npm配布物そのまま）
- Marp Core: `@marp-team/marp-core`をエントリポイントとして`esbuild`で
  `format: 'esm', bundle: true, minify: true, platform: 'browser'`でビルドし直した
  `marp-core.bundle.mjs`（npm配布物をそのまま使うのではなく、ブラウザ向けESMとして
  再ビルドしている点がAnyDoc・markdown-itと異なります。[`slide`リポジトリ](https://github.com/YanTKYS/slide)の
  `build/build.mjs`と同様の方法です）
