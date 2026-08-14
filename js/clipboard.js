// clipboard.js
// クリップボードへのコピーだけを担当する。Clipboard APIが使えない環境
// （HTTP配信の古いブラウザなど）、またはAPIが権限設定で拒否された場合は、
// 一時的なtextareaとexecCommandへ自動的に切り替える。
// 呼び出し側（app.jsのMarkdownコピー、help.jsの記法例コピー）は成否だけを見ればよいが、
// 失敗の原因（権限拒否・HTTP配信でClipboard APIが使えない等）はコンソールへ残す。

import { logError } from './errors.js';

/** コピーできなかった場合に表示する案内。表示方法（ステータス欄）は呼び出し側の責務。 */
export const COPY_FAILED_MESSAGE = 'コピーに失敗しました。テキストを選択して手動でコピーしてください。';

/** Clipboard APIが使えない場合の代替手段。一時的なtextareaを経由してコピーする。 */
function copyViaTextarea(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
  if (!copied) throw new Error('execCommand copy failed');
}

/**
 * テキストをクリップボードへコピーする。
 * @returns {Promise<boolean>} コピーできたか
 */
export async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Clipboard APIは存在していても、HTTP配信・権限設定・ブラウザ設定によって
      // writeText()だけが拒否されることがある。利用者のクリック操作中なら従来方式で
      // コピーできる可能性があるため、ここで処理を終えず代替手段を試す。
      logError('copyText: Clipboard APIでのコピーに失敗（代替手段を試行）', error);
    }
  }

  try {
    copyViaTextarea(text);
    return true;
  } catch (error) {
    logError('copyText: クリップボードへのコピーに失敗', error);
    return false;
  }
}
