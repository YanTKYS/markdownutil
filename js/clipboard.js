// clipboard.js
// クリップボードへのコピーだけを担当する。Clipboard APIが使えない環境
// （HTTP配信の古いブラウザなど）では、一時的なtextareaとexecCommandへ自動的に切り替える。
// 呼び出し側（app.jsのMarkdownコピー、help.jsの記法例コピー）は成否だけを見ればよいが、
// 失敗の原因（権限拒否・HTTP配信でClipboard APIが使えない等）はコンソールへ残す。

import { logError } from './errors.js';

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
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      copyViaTextarea(text);
    }
    return true;
  } catch (error) {
    logError('copyText: クリップボードへのコピーに失敗', error);
    return false;
  }
}
