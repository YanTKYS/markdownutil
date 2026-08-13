// converter.js
// 文書 -> Markdown 変換を担当する。AnyDoc WASMの初期化・呼び出し・エラー正規化のみを行い、
// UI操作（DOM更新やボタン制御など）はここに持ち込まない。将来Web Workerへ切り出せる
// 境界を意識し、外部との入出力は「File/Blobを受け取りMarkdown文字列を返す」形に限定する。

import init, { formatFromPath, toMarkdownBytes } from '../vendor/anydoc/anydoc_wasm.js';

// AnyDocを経由せず、そのままエディタへ読み込むテキスト系拡張子。
export const TEXT_EXTENSIONS = ['md', 'markdown', 'txt'];

// ファイル選択ダイアログの絞り込み（accept属性）に使うヒント用の一覧。
// 実際に変換できるかどうかはAnyDoc自身のformatFromPath()/formatFromBytes()が判定するため、
// ここでの一覧はUI上の目安に過ぎず、対応形式の正本ではない。
export const PICKER_EXTENSIONS_HINT = [
  ...TEXT_EXTENSIONS,
  'doc', 'docx', 'docm',
  'xls', 'xlsx', 'xlsm', 'xlsb',
  'ppt', 'pptx', 'pptm', 'pps', 'ppsx',
  'pdf', 'csv', 'rtf', 'epub',
  'odt', 'ods', 'odp',
];

export class ConversionError extends Error {
  constructor(message, { code = 'unknown', cause } = {}) {
    super(message);
    this.name = 'ConversionError';
    this.code = code;
    this.cause = cause;
  }
}

let initPromise = null;

/** AnyDoc WASMを初期化する。複数回呼ばれても初期化は一度だけ行う。 */
function ensureInit() {
  if (!initPromise) {
    initPromise = init().catch((cause) => {
      initPromise = null;
      throw new ConversionError(
        'WASMモジュールの初期化に失敗しました。ページを再読み込みしてください。',
        { code: 'initFailed', cause },
      );
    });
  }
  return initPromise;
}

/** 起動時にバックグラウンドで初期化を始めておく（失敗はここでは無視し、実変換時に再度扱う）。 */
export function preload() {
  ensureInit().catch(() => {});
}

export function getExtension(filename) {
  const dot = filename.lastIndexOf('.');
  if (dot < 0 || dot === filename.length - 1) return '';
  return filename.slice(dot + 1).toLowerCase();
}

export function isTextFile(filename) {
  return TEXT_EXTENSIONS.includes(getExtension(filename));
}

function messageForError(error) {
  const code = error && error.code;
  const rawMessage = (error && error.message) || '';

  switch (code) {
    case 'encrypted':
      return 'このファイルはパスワード保護（暗号化）されているため変換できません。';
    case 'unsupported':
      if (/scanned/i.test(rawMessage) || /ocr/i.test(rawMessage)) {
        return 'このPDFからテキストを取得できませんでした。スキャンPDFには対応していない可能性があります。';
      }
      return 'この形式は変換に対応していません。';
    case 'malformed':
      return 'ファイルが破損しているか、読み取れない構造のため変換できませんでした。';
    case 'resourceLimit':
      return 'ファイルの規模が処理可能な上限を超えているため変換できませんでした。';
    case 'missingPart':
      return '変換に必要なデータがファイル内に見つからず、変換できませんでした。';
    case 'initFailed':
      return 'WASMモジュールの初期化に失敗しました。ページを再読み込みしてください。';
    default:
      return '変換できませんでした。ファイルが破損していないか確認してください。';
  }
}

/**
 * File(またはBlob)をMarkdown文字列へ変換する。
 * .md / .markdown / .txt はこの関数を使わず、呼び出し側でテキストとして直接読み込むこと。
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function convertToMarkdown(file) {
  await ensureInit();

  let buffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (cause) {
    throw new ConversionError('ファイルの読み込みに失敗しました。', { code: 'readFailed', cause });
  }

  const bytes = new Uint8Array(buffer);
  // 拡張子からAnyDocの形式を判定する。判定できない場合はundefinedを渡し、
  // AnyDoc自身に内容（バイト列）からの自動判定を委ねる。
  const format = formatFromPath(file.name) ?? undefined;

  try {
    return toMarkdownBytes(bytes, format);
  } catch (error) {
    throw new ConversionError(messageForError(error), { code: error && error.code, cause: error });
  }
}
