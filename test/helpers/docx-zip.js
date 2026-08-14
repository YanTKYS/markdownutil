// docx-zip.js
// テスト用の最小限のZIP展開。Word出力（.docx）はZIPなので、生成されたBlobから
// `word/document.xml` 等のXMLを取り出して内容を検証するために使う。
// 外部パッケージを追加しないため、Node組み込みのzlibだけでcentral directoryを読む。

import { inflateRawSync } from 'node:zlib';

const CENTRAL_SIGNATURE = 0x02014b50;
const STORED = 0;
const DEFLATED = 8;

/**
 * ZIPのバイト列から「エントリ名 -> 内容（文字列）」のMapを作る。
 * @param {Uint8Array} bytes
 * @returns {Map<string, string>}
 */
export function readZipEntries(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = new Map();

  for (let offset = 0; offset + 4 <= bytes.length; offset += 1) {
    if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) continue;

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = Buffer.from(bytes.slice(offset + 46, offset + 46 + nameLength)).toString('utf8');

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.slice(dataStart, dataStart + compressedSize);

    if (method === STORED) {
      entries.set(name, Buffer.from(data).toString('utf8'));
    } else if (method === DEFLATED) {
      entries.set(name, inflateRawSync(Buffer.from(data)).toString('utf8'));
    } else {
      throw new Error(`unsupported zip compression method: ${method}`);
    }

    offset += 45 + nameLength + extraLength + commentLength;
  }

  return entries;
}

/** DOCXのBlobから `word/document.xml` を取り出す。 */
export async function readDocumentXml(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const xml = readZipEntries(bytes).get('word/document.xml');
  if (!xml) throw new Error('word/document.xml not found in docx');
  return xml;
}

/** DOCXのBlobから `word/numbering.xml` を取り出す（無ければnull）。 */
export async function readNumberingXml(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return readZipEntries(bytes).get('word/numbering.xml') ?? null;
}

/**
 * document.xmlを段落（`<w:p>`）単位に分割する。順序や個数を確認しやすくするための
 * 単純な文字列分割で、XMLパーサーとしての正確さは求めていない。
 */
export function splitParagraphs(xml) {
  return xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
}

/** 段落・セル等のXML断片から、`<w:t>`のテキストを連結して取り出す。 */
export function textOf(xmlFragment) {
  const parts = xmlFragment.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || [];
  return parts
    .map((part) => part.replace(/<[^>]*>/g, ''))
    .join('')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
