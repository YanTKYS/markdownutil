# テスト

MarkdownUtilの検証手段は、Node.js上のユニットテストと、実ブラウザでの手動確認の2つです。
過去のリリースで何を修正・確認したかは[`docs/release-note.md`](release-note.md)とGit履歴を
参照してください。

## ユニットテスト

Node.js組み込みのテストランナー（`node --test`）だけで実行でき、追加の依存パッケージは
不要です（閉域環境でも`npm install`なしに実行できます）。

```bash
npm test              # Node.js 20以上
npm run test:coverage # カバレッジ付き（Node.js 22以上）
```

- ブラウザ専用のAPI（DOM・`window.open`・クリップボード）は`test/helpers/fake-dom.js`の
  最小限の代用で置き換えています。
- Marp Core・docx・AnyDoc WASMは差し替えず、`vendor/`配下の実体をそのまま読み込みます。
  DOCXの中身は`test/helpers/docx-zip.js`（`node:zlib`のみ使用）で展開して検証します。
- AnyDocの変換テストで使う`.docx` / `.ods`は、`test/helpers/zip-write.js`でその場で
  組み立てます。リポジトリへバイナリのfixtureを置かないための方式です。
- `test/vendor-manifest.test.js`は、`vendor/manifest.json`とREADME・
  `LICENSES/THIRD_PARTY_NOTICES.md`・各vendor配下のバージョン整合性を検証します
  （[`docs/dependencies.md`](dependencies.md)参照）。
- `js/app.js`・`js/help.js`は画面全体の組み立て（UI配線）が中心のため、ユニットテストでは
  なく後述の手動確認で担保しています。

## 実ブラウザでの手動確認

`file://`では動作しないため、簡易HTTPサーバ経由で確認します。

```bash
python3 -m http.server 8801
```

機能に触れる変更を加えた場合は、少なくとも次を一通り確認してください。

| 区分 | 確認内容 |
| --- | --- |
| 変換 | Word / Excel / PowerPoint / PDF / CSV / RTF / OpenDocument / EPUBを開き、Markdownへ変換される |
| 変換（異常系） | パスワード保護・破損ファイル・画像のみのPDFで、`js/converter.js`の日本語メッセージが表示される |
| 編集・プレビュー | 入力に追従して文書プレビューが更新される。front matterとHTMLコメントが本文へ出ない |
| 保存・コピー | `.md`保存とクリップボードコピーが成功し、ステータス欄へ結果が出る |
| Word出力 | `.docx`が保存され、Wordで見出し・リスト・表・コードブロックが崩れず開ける |
| スライド | スライドモードへの切替・枚数表示・テーマ切替（front matterへの反映） |
| スライド出力 | HTML出力したファイル単体でスライドショーできる。印刷ウィンドウが開く |
| プレゼン | 投影用ウィンドウと発表者ビューが同期する。キーボード・ボタン・終了操作 |
| ヘルプ | 開閉・タブ切替・記法例のコピー・サンプル挿入 |
| 閉域条件 | 開発者ツールのNetworkタブで、配信元オリジンとBlob URL以外への通信が0件 |
| コンソール | エラーが出ていない（faviconの404を除く） |

変換品質を実業務の文書で確かめる場合は、結合セルを多用した帳票Word・図形を多く含む
PowerPoint・レイアウトの複雑なPDFなど、プログラムで生成したサンプルでは再現しにくい
文書を使ってください。

## IIS実機配置後の確認

[`docs/deployment.md`](deployment.md)の設定を行ったうえで、開発者ツールのNetworkタブで
次を確認します。

- `vendor/anydoc/anydoc_wasm_bg.wasm`が200・`application/wasm`で返る
- `vendor/markdown-it/markdown-it.esm.min.mjs`と`vendor/marp/marp-core.bundle.mjs`が
  200・`text/javascript`で返る（`.mjs`が未登録だと404になり、画面またはスライド表示が
  動作しません）
- 外部ホストへの通信が発生していない

## 依存ライブラリを更新した場合

[`docs/dependencies.md`](dependencies.md)の手順に従い、更新前後で変換結果・レンダリング結果を
比較してください。AnyDocの更新時は、代表的な形式を一通り変換し直し、`error.code`ごとの
エラーメッセージが従来どおり成立することもあわせて確認します。
