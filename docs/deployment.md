# 配置・閉域利用

MarkdownUtilはビルド済みの静的ファイル一式です。`markdownutil/` フォルダ全体を、IIS等の
静的Webサーバの公開フォルダへ配置するだけで利用できます。サーバ側での文書変換処理は
一切行わないため、追加のアプリケーションプール設定やランタイムのインストールは不要です。

## HTTP配信が必須（`file://`では動作しない）

`js/app.js`はESモジュールとしてimportを使って構成されているため、`file://`で`index.html`を
直接開くとブラウザのCORS制約によりモジュールを読み込めません。IIS等の本番配置に限らず、
開発時にローカルで確認する場合も、`python3 -m http.server`等の簡易HTTPサーバ経由で
開いてください。

## `.wasm` と `.mjs` の配信について

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
（[`docs/TESTING.md`](TESTING.md) 参照）。

## CSP（Content-Security-Policy）とpostMessageの制限

`index.html`に`Content-Security-Policy`を設定し、同梱ファイル以外の読み込みと外部への
送信を明示的に禁止しています（`default-src 'self'`を基本に、AnyDoc WASM実行に必要な
`wasm-unsafe-eval`、スライド表示用ドキュメント・Marpが生成するインライン`<script>`/`<style>`に
必要な`unsafe-inline`のみ個別に許可）。Markdown内に書いた外部URL画像（`img-src`）は
従来どおり表示できます（[`docs/slides.md`](slides.md)「外部通信について」参照）。

あわせて、スライドプレビュー用iframe・プレゼン専用ウィンドウとの`postMessage`によるやり取りは、
送信元のwindowと送信元オリジンの両方を照合し、一致しないメッセージは受け付けません。
`window.open()`は他オリジンのページからも参照でき、描画（`render`）メッセージを偽装されると
MarkdownUtilのオリジンで任意のHTML/スクリプトを実行されるおそれがあるための対策です。
送信時も、可能な場合は本体自身のオリジンを送信先に指定します（`file://`等でオリジンが
定まらない場合のみ、従来どおり`'*'`を使います）。1つの送信先へのpostMessageが失敗しても、
他の送信先（発表者ビューの現在/次スライドや投影用ウィンドウ）への同期は止まりません。
