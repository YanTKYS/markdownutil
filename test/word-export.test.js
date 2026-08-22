// word-export.test.js
// word-export.jsのMarkdown -> DOCX変換を検証する。生成物はZIP（OOXML）なので、
// test/helpers/docx-zip.jsで`word/document.xml`を取り出し、段落・書式・リスト・表が
// 意図した要素になっているかを確認する。
// v0.6.1/v0.6.2で修正した「表の列幅」「リスト項目に続く段落」「番号付きリストの連番」も
// 回帰テストとして含める。

import test from 'node:test';
import assert from 'node:assert/strict';

import { WordExportError, buildDocxBlob } from '../js/word-export.js';
import {
  readDocumentXml,
  readNumberingXml,
  readZipEntries,
  splitParagraphs,
  textOf,
} from './helpers/docx-zip.js';

/* ---- 入力チェック ---- */

test('buildDocxBlob: 空・空白のみのMarkdownはWordExportError', async () => {
  await assert.rejects(() => buildDocxBlob(''), (error) => {
    assert.ok(error instanceof WordExportError);
    assert.equal(error.message, 'Word出力するMarkdownがありません。');
    return true;
  });
  await assert.rejects(() => buildDocxBlob('   \n\t\n'), WordExportError);
  await assert.rejects(() => buildDocxBlob(undefined), WordExportError);
});

test('buildDocxBlob: 本文がfront matterとコメントだけの場合もWordExportError', async () => {
  await assert.rejects(
    () => buildDocxBlob('---\nmarp: true\ntheme: gaia\n---\n\n<!-- ノートだけ -->\n'),
    (error) => {
      assert.ok(error instanceof WordExportError);
      assert.equal(error.message, 'Word出力するMarkdownがありません。');
      return true;
    },
  );
});

test('buildDocxBlob: DOCXとして必要なエントリを含むBlobを返す', async () => {
  const blob = await buildDocxBlob('# 見出し\n\n本文\n');

  assert.ok(blob.size > 0);
  assert.match(blob.type, /wordprocessingml\.document/);
  assert.ok((await readDocumentXml(blob)).includes('<w:document'));
});

/* ---- front matter・コメントの除去 ---- */

test('buildDocxBlob: Marpのfront matterとHTMLコメントを本文から除く', async () => {
  const markdown = [
    '---',
    'marp: true',
    'theme: gaia',
    '---',
    '',
    '# 見出し',
    '',
    '<!-- スピーカーノート -->',
    '',
    '本文',
    '',
  ].join('\n');
  const xml = await readDocumentXml(await buildDocxBlob(markdown));

  assert.ok(!textOf(xml).includes('marp'), 'front matterが本文へ出力されている');
  assert.ok(!textOf(xml).includes('theme'), 'front matterが本文へ出力されている');
  assert.ok(!textOf(xml).includes('スピーカーノート'), 'コメントが本文へ出力されている');
  assert.match(textOf(xml), /見出し.*本文/s);
});

test('buildDocxBlob: 本文先頭の水平線はfront matterと誤認しない', async () => {
  const xml = await readDocumentXml(await buildDocxBlob('---\n\n# 見出し\n'));

  assert.match(textOf(xml), /見出し/);
  // 水平線は罫線付きの空段落として出力される
  assert.match(xml, /<w:bottom[^>]*w:val="single"/);
});

// front matterの書き方の揺れ（`---`の後ろの空白、ディレクティブの間の空行）で
// 除去に失敗すると、`marp: true`等がWord文書の本文へそのまま印字されてしまう。
for (const [name, markdown] of Object.entries({
  '`---`の後ろに空白がある': '--- \nmarp: true\ntheme: gaia\n--- \n\n# 見出し\n',
  'ディレクティブの間に空行がある': '---\nmarp: true\n\ntheme: gaia\n---\n\n# 見出し\n',
  '改行コードがCRLF': '---\r\nmarp: true\r\ntheme: gaia\r\n---\r\n\r\n# 見出し\r\n',
})) {
  test(`buildDocxBlob: front matterを本文から除く（${name}）`, async () => {
    const xml = await readDocumentXml(await buildDocxBlob(markdown));

    assert.ok(!textOf(xml).includes('marp'), 'front matterが本文へ出力されている');
    assert.ok(!textOf(xml).includes('theme'), 'front matterが本文へ出力されている');
    assert.match(textOf(xml), /見出し/);
  });
}

// 逆に、水平線で囲まれた本文をfront matterと誤認して消してしまわないこと。
// 1行でも`key: value`の形でない行があれば本文として扱う。
test('buildDocxBlob: 水平線で囲まれた本文はfront matterと誤認しない', async () => {
  const markdown = '---\n注意: これは本文です\nもう一行の本文\n---\n\n# 見出し\n';
  const xml = await readDocumentXml(await buildDocxBlob(markdown));

  assert.match(textOf(xml), /これは本文です/, '本文がfront matterとして消えている');
  assert.match(textOf(xml), /もう一行の本文/, '本文がfront matterとして消えている');
});

test('buildDocxBlob: front matterの直後にスライド区切りが続いても本文を残す', async () => {
  const markdown = '---\nmarp: true\n---\n\n# 1枚目\n\n---\n\n# 2枚目\n';
  const xml = await readDocumentXml(await buildDocxBlob(markdown));

  assert.ok(!textOf(xml).includes('marp'), 'front matterが本文へ出力されている');
  assert.match(textOf(xml), /1枚目/);
  assert.match(textOf(xml), /2枚目/);
});

/* ---- 見出し・段落・文字書式 ---- */

test('buildDocxBlob: 見出しレベルをWordの見出しスタイルへ対応させる', async () => {
  const markdown = '# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6\n';
  const xml = await readDocumentXml(await buildDocxBlob(markdown));

  ['Heading1', 'Heading2', 'Heading3', 'Heading4', 'Heading5', 'Heading6'].forEach((style) => {
    assert.match(xml, new RegExp(`<w:pStyle w:val="${style}"`), `${style} が出力されていない`);
  });
});

test('buildDocxBlob: 太字・斜体・インラインコードを1段落内で使い分ける', async () => {
  const xml = await readDocumentXml(await buildDocxBlob('通常 **太字** *斜体* `code`\n'));
  const paragraph = splitParagraphs(xml).find((entry) => textOf(entry).includes('太字'));

  assert.ok(paragraph, '対象の段落が見つからない');
  assert.match(paragraph, /<w:b\b/, '太字が出力されていない');
  assert.match(paragraph, /<w:i\b/, '斜体が出力されていない');
  assert.match(paragraph, /w:ascii="Consolas"/, 'インラインコードが等幅フォントになっていない');
  assert.equal(textOf(paragraph), '通常 太字 斜体 code');
});

test('buildDocxBlob: 通常改行は空白、Markdownの明示的な改行だけをWordの改行にする', async () => {
  const softbreakXml = await readDocumentXml(await buildDocxBlob('1行目\n2行目\n'));
  const hardbreakXml = await readDocumentXml(await buildDocxBlob('1行目  \n2行目\n'));
  const softbreakParagraph = splitParagraphs(softbreakXml).find((entry) => textOf(entry).includes('1行目'));
  const hardbreakParagraph = splitParagraphs(hardbreakXml).find((entry) => textOf(entry).includes('1行目'));

  assert.equal(textOf(softbreakParagraph), '1行目 2行目');
  assert.ok(!softbreakParagraph.includes('<w:br/>'), '通常改行が強制改行になっている');
  assert.match(hardbreakParagraph, /<w:br\/>/, '末尾の空白2つによる明示的な改行が反映されていない');
});

test('buildDocxBlob: リンクは書式を付けずテキストとして出力する', async () => {
  const xml = await readDocumentXml(await buildDocxBlob('[リンク文字](https://example.com/)\n'));

  assert.match(textOf(xml), /リンク文字/);
  assert.ok(!xml.includes('w:hyperlink'), 'ハイパーリンク化は非対応のはず');
});

test('buildDocxBlob: 画像は代替テキストのプレースホルダに置き換える', async () => {
  const withAlt = await readDocumentXml(await buildDocxBlob('![図1](image.png)\n'));
  const withoutAlt = await readDocumentXml(await buildDocxBlob('![](image.png)\n'));

  assert.match(textOf(withAlt), /\[画像: 図1（Word出力は非対応）\]/);
  assert.match(textOf(withoutAlt), /\[画像: 画像（Word出力は非対応）\]/);
  assert.ok(!withAlt.includes('<w:drawing'), '画像は埋め込まない');
});

test('buildDocxBlob: コードブロックは行ごとの改行を保った1段落にする', async () => {
  const xml = await readDocumentXml(await buildDocxBlob('```js\nconst a = 1;\nconst b = 2;\n```\n'));
  const paragraph = splitParagraphs(xml).find((entry) => textOf(entry).includes('const a = 1;'));

  assert.ok(paragraph, 'コードブロックの段落が見つからない');
  assert.match(textOf(paragraph), /const a = 1;const b = 2;/);
  assert.equal((paragraph.match(/<w:br\/>/g) || []).length, 1, '2行目の前で改行していない');
  assert.match(paragraph, /w:fill="F2F2F2"/, '背景色が付いていない');
});

test('buildDocxBlob: 引用は字下げと左罫線で表現する', async () => {
  const xml = await readDocumentXml(await buildDocxBlob('> 引用文\n'));
  const paragraph = splitParagraphs(xml).find((entry) => textOf(entry).includes('引用文'));

  assert.match(paragraph, /<w:ind[^>]*w:left="360"/);
  assert.match(paragraph, /<w:left[^>]*w:color="BFBFBF"/);
});

test('buildDocxBlob: 入れ子の引用は深さに応じて字下げを増やす', async () => {
  const xml = await readDocumentXml(await buildDocxBlob('> 外側\n>\n> > 内側\n'));
  const inner = splitParagraphs(xml).find((entry) => textOf(entry).includes('内側'));

  assert.match(inner, /<w:ind[^>]*w:left="720"/);
});

/* ---- リスト ---- */

test('buildDocxBlob: 箇条書きは階層ごとのbulletにする', async () => {
  const markdown = '- 親\n  - 子\n    - 孫\n';
  const xml = await readDocumentXml(await buildDocxBlob(markdown));

  assert.match(xml, /<w:numPr><w:ilvl w:val="0"\/><w:numId w:val="1"\/><\/w:numPr>/);
  assert.match(xml, /<w:ilvl w:val="1"\/>/);
  assert.match(xml, /<w:ilvl w:val="2"\/>/);
});

test('buildDocxBlob: 番号付きリストはnumberingを定義して参照する', async () => {
  const blob = await buildDocxBlob('1. 一\n2. 二\n');
  const xml = await readDocumentXml(blob);
  const numbering = await readNumberingXml(blob);

  assert.match(xml, /<w:numPr>/);
  assert.ok(numbering, 'numbering.xmlが生成されていない');
  assert.match(numbering, /<w:numFmt w:val="decimal"/);
});

test('buildDocxBlob: 離れた番号付きリストはそれぞれ1から数え直す（v0.6.0の連番対策）', async () => {
  const markdown = '1. 一\n2. 二\n\n段落\n\n1. 再開一\n2. 再開二\n';
  const blob = await buildDocxBlob(markdown);
  const numbering = await readNumberingXml(blob);
  const xml = await readDocumentXml(blob);

  const usedNumIds = new Set((xml.match(/<w:numId w:val="(\d+)"\/>/g) || []).map((entry) => entry));
  assert.equal(usedNumIds.size, 2, '2つの番号付きリストが同じnumIdを共有している');
  assert.equal((numbering.match(/<w:abstractNum\b/g) || []).length >= 2, true);
});

test('buildDocxBlob: 途中の番号から始まる番号付きリストはその番号から数える（プレビューと一致させる）', async () => {
  // 「1. 2.」→説明の段落→「3. 4.」のように番号を続けて書いた手順書で、
  // プレビュー（<ol start="3">）は3から、Word出力は1から数え始めてずれていた。
  const markdown = '1. 手順1\n2. 手順2\n\n説明の段落。\n\n3. 手順3\n4. 手順4\n';
  const blob = await buildDocxBlob(markdown);
  const numbering = await readNumberingXml(blob);

  const decimalStarts = (numbering.match(/<w:abstractNum\b[\s\S]*?<\/w:abstractNum>/g) || [])
    .filter((block) => block.includes('<w:numFmt w:val="decimal"'))
    .map((block) => (block.match(/<w:start w:val="(\d+)"\/>/) || [])[1]);

  assert.deepEqual(decimalStarts, ['1', '3'], '2つ目のリストが3から始まっていない');
});

test('buildDocxBlob: 入れ子の番号付きリストは同じnumbering参照を使う', async () => {
  const markdown = '1. 親\n   1. 子\n';
  const xml = await readDocumentXml(await buildDocxBlob(markdown));
  const usedNumIds = new Set((xml.match(/<w:numId w:val="(\d+)"\/>/g) || []));

  assert.equal(usedNumIds.size, 1, '入れ子は親と同じ参照を使うはず');
  assert.match(xml, /<w:ilvl w:val="1"\/>/);
});

test('buildDocxBlob: リスト項目に続く段落は記号を付けず本文位置へ字下げする（v0.6.2の修正）', async () => {
  const markdown = '- 項目\n\n  項目の補足\n';
  const xml = await readDocumentXml(await buildDocxBlob(markdown));
  const paragraphs = splitParagraphs(xml);
  const item = paragraphs.find((entry) => textOf(entry) === '項目');
  const continuation = paragraphs.find((entry) => textOf(entry) === '項目の補足');

  assert.ok(item && continuation, '対象の段落が見つからない');
  assert.match(item, /<w:numPr>/, '1段落目に記号が付いていない');
  assert.ok(!continuation.includes('<w:numPr>'), '2段落目にも記号が付いている（別項目に見えてしまう）');
  assert.match(continuation, /<w:ind[^>]*w:left="720"/, '2段落目が項目本文の位置に揃っていない');
});

/* ---- 表 ---- */

test('buildDocxBlob: 表はヘッダー行を太字・背景色付きで出力する', async () => {
  const markdown = '| 機能 | 内容 |\n| --- | --- |\n| 文書 | 表示 |\n';
  const xml = await readDocumentXml(await buildDocxBlob(markdown));

  assert.match(xml, /<w:tbl>/);
  assert.equal((xml.match(/<w:tr>/g) || []).length, 2);
  assert.match(xml, /w:fill="E7E7E7"/, 'ヘッダー行の背景色が付いていない');
  assert.match(textOf(xml), /機能内容文書表示/);
});

test('buildDocxBlob: 表の桁揃え（`---:`）を段落の配置として引き継ぐ', async () => {
  const markdown = '| 区分 | 件数 | 備考 |\n| :--- | ---: | :---: |\n| 相談 | 120 | 済 |\n';
  const xml = await readDocumentXml(await buildDocxBlob(markdown));
  const cells = (xml.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || [])
    .map((cell) => [textOf(cell), (cell.match(/<w:jc w:val="(\w+)"\/>/) || [])[1]]);

  assert.deepEqual(cells, [
    ['区分', 'left'], ['件数', 'right'], ['備考', 'center'],
    ['相談', 'left'], ['120', 'right'], ['済', 'center'],
  ]);
});

test('buildDocxBlob: 表の列幅は本文幅を列数で等分する（v0.6.2の修正）', async () => {
  const markdown = '| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n';
  const xml = await readDocumentXml(await buildDocxBlob(markdown));
  const gridColumns = xml.match(/<w:gridCol w:w="(\d+)"/g) || [];

  assert.equal(gridColumns.length, 3);
  gridColumns.forEach((column) => {
    assert.match(column, /w:w="3008"/, '9026twipsを3列で等分していない');
  });
});

/* ---- 既定の書式 ---- */

test('buildDocxBlob: 既定フォントは游ゴシック10.5pt', async () => {
  const blob = await buildDocxBlob('本文\n');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const styles = readZipEntries(bytes).get('word/styles.xml');

  assert.ok(styles, 'styles.xmlが生成されていない');
  assert.match(styles, /w:ascii="Yu Gothic"/);
  assert.match(styles, /<w:sz w:val="21"\/>/);
});
