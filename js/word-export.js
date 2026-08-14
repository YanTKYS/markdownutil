// word-export.js
// 現在のMarkdownをMicrosoft Word形式（.docx）としてブラウザ内で生成する。
// markdown-it（markdown-engine.js経由）でMarkdownをトークン化し、HTMLを経由せず
// トークンを直接Word要素（vendor/docx）へ変換する。サーバへ本文を送信する処理は
// 一切含まない。
//
// 対応: 見出し(H1-H6)、段落、太字、斜体、インラインコード、箇条書き、番号付きリスト
// （最大3階層のネスト）、表、コードブロック、水平線、引用（インデント表現）。
// 非対応: 画像の埋め込み（代わりに代替テキストをプレースホルダとして出力する）、
// リンクのハイパーリンク化（リンク文字はプレーンテキストとして出力する）。
// Marp向けのfront matter（marp/theme/paginate等のYAML風ブロック）とHTMLコメント
// （スピーカーノート等）はWord本文から除外する。

import { createMarkdownIt } from './markdown-engine.js';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  LevelFormat,
  ShadingType,
} from '../vendor/docx/docx.esm.min.mjs';

const md = createMarkdownIt();

const BODY_FONT = 'Yu Gothic';
const MONO_FONT = 'Consolas';
const BODY_SIZE = 21; // 半ポイント単位。10.5pt
const ORDERED_LIST_REFERENCE = 'markdownutil-ordered-list';
const MAX_LIST_LEVEL = 2; // 0始まりで3階層まで（親・子・孫）
const HR_BORDER_COLOR = '999999';
const CODE_SHADING_FILL = 'F2F2F2';
const CODE_BORDER_COLOR = 'CCCCCC';
const TABLE_HEADER_SHADING_FILL = 'E7E7E7';
const QUOTE_BORDER_COLOR = 'BFBFBF';
const QUOTE_INDENT_TWIPS = 360;
// リスト1階層あたりの字下げ幅（twips）。番号付きリストのレベル定義と、
// リスト項目の2段落目以降の字下げの両方で使い、両者の位置をそろえる。
const LIST_INDENT_TWIPS = 720;
// 表の既定幅（twips）。A4縦（11906）から左右の余白（1440×2）を引いた本文幅。
// 列ごとの幅を明示しないと、Word側が極端に狭い列幅で表を描画することがある。
const TABLE_WIDTH_TWIPS = 9026;

const HEADING_LEVELS = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

export class WordExportError extends Error {}

/** 指定した階層（0始まり）のリストの字下げ幅。 */
function listIndentLeft(level) {
  return LIST_INDENT_TWIPS * (level + 1);
}

/** 番号付きリスト1つ分（最大3階層）のレベル定義。リストごとに新しいオブジェクトを作る。 */
function buildOrderedListLevels() {
  const levels = [];
  for (let level = 0; level <= MAX_LIST_LEVEL; level += 1) {
    levels.push({
      level,
      format: LevelFormat.DECIMAL,
      text: `%${level + 1}.`,
      alignment: AlignmentType.START,
      style: { paragraph: { indent: { left: listIndentLeft(level), hanging: 360 } } },
    });
  }
  return levels;
}

/**
 * Marp向けのfront matter（先頭の `---` 〜 `---` で、中身がすべて `key: value` 行の
 * ブロックに限定）と、HTMLコメント（スピーカーノート・通常のMarkdownコメント）を
 * Word出力前のMarkdownから取り除く。本文がハイフン3つの水平線で始まるだけの文書を
 * 誤ってfront matter扱いしないよう、中身がkey: value行だけの場合のみ対象とする。
 * プレビュー用のMarkdown（editor.value）そのものは変更しない。
 */
function stripFrontMatterAndComments(markdown) {
  let text = markdown;

  const frontMatterMatch = text.match(/^---\r?\n((?:[^\r\n]*:[^\r\n]*\r?\n)+)---\r?\n?/);
  if (frontMatterMatch) {
    text = text.slice(frontMatterMatch[0].length);
  }

  text = text.replace(/<!--[\s\S]*?-->/g, '');

  return text;
}

function makeRun(text, state) {
  const options = { text };
  if (state.bold) options.bold = true;
  if (state.italic) options.italics = true;
  if (state.code) options.font = MONO_FONT;
  return new TextRun(options);
}

/**
 * インライントークン列（段落・見出し・表セル等の中身）をTextRunの配列へ変換する。
 * strong/em/code_inlineの入れ子状態を単純なカウンタで追跡し、同一段落内で
 * 太字・斜体・等幅フォントが混在するケースに対応する。リンクの文字列はそのまま
 * プレーンテキストとして出力し（ハイパーリンク化は行わない）、画像はv0.6.0では
 * 対象外のため代替テキストのプレースホルダに置き換える。
 */
function buildRunsFromInlineTokens(children, baseState = {}) {
  const runs = [];
  const state = { bold: 0, italic: 0, ...baseState };

  (children || []).forEach((token) => {
    switch (token.type) {
      case 'text':
        if (token.content) runs.push(makeRun(token.content, state));
        break;
      case 'strong_open':
        state.bold += 1;
        break;
      case 'strong_close':
        state.bold -= 1;
        break;
      case 'em_open':
        state.italic += 1;
        break;
      case 'em_close':
        state.italic -= 1;
        break;
      case 'code_inline':
        runs.push(makeRun(token.content, { ...state, code: true }));
        break;
      case 'softbreak':
      case 'hardbreak':
        runs.push(new TextRun({ text: '', break: 1 }));
        break;
      case 'image': {
        const alt = token.content || '画像';
        runs.push(makeRun(`[画像: ${alt}（Word出力は非対応）]`, { ...state, italic: (state.italic || 0) + 1 }));
        break;
      }
      default:
        // link_open/link_close等、上記以外のトークンは書式を付けずテキスト部分のみ出力する。
        if (token.content) runs.push(makeRun(token.content, state));
        break;
    }
  });

  return runs.length ? runs : [new TextRun('')];
}

function buildHeadingParagraph(tokens, index) {
  const openToken = tokens[index];
  const inlineToken = tokens[index + 1];
  const level = Number(openToken.tag.slice(1)) || 6;
  return new Paragraph({
    heading: HEADING_LEVELS[level] || HeadingLevel.HEADING_6,
    children: buildRunsFromInlineTokens(inlineToken.children),
  });
}

function buildParagraph(tokens, index, listStack, quoteDepth) {
  const inlineToken = tokens[index + 1];
  const options = {
    children: buildRunsFromInlineTokens(inlineToken.children),
  };

  if (listStack.length > 0) {
    const top = listStack[listStack.length - 1];
    if (top.needsMarker) {
      // リスト項目の1段落目。ここにだけ中黒/番号を付ける。
      if (top.type === 'bullet') {
        options.bullet = { level: top.level };
      } else {
        options.numbering = { reference: top.reference, level: top.level };
      }
      top.needsMarker = false;
    } else {
      // 1つのリスト項目に複数の段落がある場合（項目に続く補足説明など）、
      // 2段落目以降にも中黒や番号を付けると別の項目に見えてしまう。記号は付けず、
      // 項目の本文と同じ位置まで字下げして続きだと分かるようにする。
      options.indent = { left: listIndentLeft(top.level) };
    }
  } else if (quoteDepth > 0) {
    options.indent = { left: QUOTE_INDENT_TWIPS * quoteDepth };
    options.border = {
      left: { style: BorderStyle.SINGLE, size: 6, color: QUOTE_BORDER_COLOR, space: 8 },
    };
  }

  return new Paragraph(options);
}

function buildHorizontalRuleParagraph() {
  return new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: HR_BORDER_COLOR, space: 1 },
    },
  });
}

function buildCodeBlockParagraph(content) {
  const lines = content.replace(/\n$/, '').split('\n');
  const runs = lines.map((line, idx) => new TextRun({
    text: line,
    font: MONO_FONT,
    break: idx > 0 ? 1 : 0,
  }));
  return new Paragraph({
    children: runs,
    shading: { type: ShadingType.CLEAR, fill: CODE_SHADING_FILL },
    border: {
      top: { style: BorderStyle.SINGLE, size: 4, color: CODE_BORDER_COLOR },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: CODE_BORDER_COLOR },
      left: { style: BorderStyle.SINGLE, size: 4, color: CODE_BORDER_COLOR },
      right: { style: BorderStyle.SINGLE, size: 4, color: CODE_BORDER_COLOR },
    },
  });
}

/** table_openからtable_closeまでを読み、docxのTableを組み立てる。次に処理すべきトークン位置も返す。 */
function buildTable(tokens, startIndex) {
  let i = startIndex + 1;
  const rows = [];
  let columnCount = 0;

  while (tokens[i].type !== 'table_close') {
    if (tokens[i].type === 'tr_open') {
      const result = buildTableRow(tokens, i);
      rows.push(result.row);
      columnCount = Math.max(columnCount, result.cellCount);
      i = result.nextIndex;
    } else {
      i += 1;
    }
  }
  i += 1; // table_closeを読み飛ばす

  // 列幅を明示しないと、Wordが本文幅いっぱいではなく極端に狭い幅で表を描画することがある。
  // 本文幅を列数で等分し、どの列にも同じ幅を割り当てる。
  const columnWidth = Math.floor(TABLE_WIDTH_TWIPS / Math.max(columnCount, 1));
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: Array(Math.max(columnCount, 1)).fill(columnWidth),
    rows,
  });
  return { table, nextIndex: i };
}

function buildTableRow(tokens, startIndex) {
  let i = startIndex + 1;
  const cells = [];

  while (tokens[i].type !== 'tr_close') {
    const isHeaderCell = tokens[i].type === 'th_open';
    if (isHeaderCell || tokens[i].type === 'td_open') {
      const inlineToken = tokens[i + 1];
      const runs = buildRunsFromInlineTokens(inlineToken.children, isHeaderCell ? { bold: 1 } : {});
      const cellOptions = { children: [new Paragraph({ children: runs })] };
      if (isHeaderCell) {
        cellOptions.shading = { type: ShadingType.CLEAR, fill: TABLE_HEADER_SHADING_FILL };
      }
      cells.push(new TableCell(cellOptions));
      i += 3; // th_open/td_open, inline, th_close/td_close
    } else {
      i += 1;
    }
  }
  i += 1; // tr_closeを読み飛ばす

  return { row: new TableRow({ children: cells }), nextIndex: i, cellCount: cells.length };
}

/**
 * markdown-itのブロックトークン列を、docxのセクション直下へ並べられる要素
 * （Paragraph / Table）の配列へ変換する。HTMLへ一度変換してからWord化するのではなく、
 * md.parse()のトークンを直接読み進める。
 */
function tokensToDocxChildren(tokens) {
  const children = [];
  const listStack = [];
  let quoteDepth = 0;
  let orderedListCount = 0;
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    switch (token.type) {
      case 'heading_open':
        children.push(buildHeadingParagraph(tokens, i));
        i += 3;
        break;
      case 'paragraph_open':
        children.push(buildParagraph(tokens, i, listStack, quoteDepth));
        i += 3;
        break;
      case 'list_item_open':
        // 次に現れる段落がこの項目の1段落目。そこにだけ中黒/番号を付ける。
        if (listStack.length > 0) listStack[listStack.length - 1].needsMarker = true;
        i += 1;
        break;
      case 'bullet_list_open':
        listStack.push({ type: 'bullet', level: Math.min(listStack.length, MAX_LIST_LEVEL) });
        i += 1;
        break;
      case 'ordered_list_open': {
        // 番号付きリストは、直近の祖先が同じ番号付きリストの入れ子でない限り新しい
        // numbering参照を割り当てる。同一参照を使い回すと、離れた場所にある別々の
        // 番号付きリストが1つの連番として続いてしまう（例: 1つ目が1〜3、2つ目が
        // 4から始まる）ため、文書内に複数ある場合はそれぞれ1から数え直させる。
        const parentOrdered = [...listStack].reverse().find((entry) => entry.type === 'ordered');
        const reference = parentOrdered
          ? parentOrdered.reference
          : `${ORDERED_LIST_REFERENCE}-${++orderedListCount}`;
        listStack.push({ type: 'ordered', level: Math.min(listStack.length, MAX_LIST_LEVEL), reference });
        i += 1;
        break;
      }
      case 'bullet_list_close':
      case 'ordered_list_close':
        listStack.pop();
        i += 1;
        break;
      case 'blockquote_open':
        quoteDepth += 1;
        i += 1;
        break;
      case 'blockquote_close':
        quoteDepth -= 1;
        i += 1;
        break;
      case 'hr':
        children.push(buildHorizontalRuleParagraph());
        i += 1;
        break;
      case 'fence':
      case 'code_block':
        children.push(buildCodeBlockParagraph(token.content));
        i += 1;
        break;
      case 'table_open': {
        const result = buildTable(tokens, i);
        children.push(result.table);
        i = result.nextIndex;
        break;
      }
      default:
        // list_item_open/close、thead/tbody等、上記以外の構造トークンは
        // 対応する段落/表側の処理で内容を読み終えているため読み飛ばす。
        i += 1;
        break;
    }
  }

  return { children, orderedListCount };
}

/**
 * MarkdownからDOCXのBlobを生成する。空・空白のみのMarkdownはエラーとする
 * （呼び出し側が「Word出力するMarkdownがありません」等を表示する前提）。
 * @param {string} markdown
 * @returns {Promise<Blob>}
 */
export async function buildDocxBlob(markdown) {
  if (!markdown || !markdown.trim()) {
    throw new WordExportError('Word出力するMarkdownがありません。');
  }

  let children;
  let orderedListCount;
  try {
    const cleaned = stripFrontMatterAndComments(markdown);
    const tokens = md.parse(cleaned, {});
    ({ children, orderedListCount } = tokensToDocxChildren(tokens));
  } catch {
    throw new WordExportError('Markdownを解析できませんでした。');
  }

  if (children.length === 0) {
    throw new WordExportError('Word出力するMarkdownがありません。');
  }

  try {
    const documentOptions = {
      styles: {
        default: {
          document: {
            run: { font: BODY_FONT, size: BODY_SIZE },
          },
        },
      },
      sections: [{ children }],
    };
    if (orderedListCount > 0) {
      const config = [];
      for (let n = 1; n <= orderedListCount; n += 1) {
        config.push({
          reference: `${ORDERED_LIST_REFERENCE}-${n}`,
          levels: buildOrderedListLevels(),
        });
      }
      documentOptions.numbering = { config };
    }

    const doc = new Document(documentOptions);
    return await Packer.toBlob(doc);
  } catch {
    throw new WordExportError('Wordファイルを作成できませんでした。');
  }
}
