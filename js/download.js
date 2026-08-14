// download.js
// ブラウザ内で生成したデータをファイルとして保存する／別ウィンドウで開く処理をまとめる。
// いずれもBlob URLを作って使い終わったら解放する、という同じ手順を踏むため、
// 呼び出し側（Markdown保存・Word出力・スライドのHTML出力・印刷用ウィンドウ）が
// URLの生成と解放を各々書かないようにする。サーバへの送信は一切行わない。
//
// 失敗時の原因はここでlogError()へ記録するが、利用者向けの日本語メッセージは
// 呼び出し側（app.js/slide-preview.js）の責務として残す（成功したのはどの保存/表示か、
// 失敗した場合に何と表示すべきかは呼び出し文脈でしか判断できないため）。

import { logError } from './errors.js';

// Blob URLの解放は、ブラウザがダウンロード／表示を始めるまで待つ必要がある。
// ダウンロードは要素をclick()した直後に始まるため短くてよいが、別ウィンドウは
// 読み込み・印刷ダイアログの表示まで参照され続けるため長めに待つ。
const DOWNLOAD_REVOKE_DELAY_MS = 1000;
const WINDOW_REVOKE_DELAY_MS = 60000;

/** Blobを指定したファイル名でダウンロードする。 */
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_REVOKE_DELAY_MS);
}

/** テキストをUTF-8のファイルとしてダウンロードする（`text/markdown`・`text/html`等）。 */
export function downloadTextFile(filename, text, mimeType) {
  downloadBlob(filename, new Blob([text], { type: `${mimeType};charset=utf-8` }));
}

/**
 * テキストをBlobとして新しいウィンドウ（タブ）で開く（印刷用ウィンドウ等）。
 * Blob URLを生成 → window.open()。開けた場合は表示・印刷ダイアログの表示まで
 * 参照され続けるため遅延revoke、開けなかった場合（ポップアップブロック）や例外時は
 * 即座にrevokeしてURLをリークさせない。例外時は原因をlogError()へ記録する。
 * @returns {boolean} 開けたか（ポップアップブロック時・例外時はfalse）
 */
export function openTextInNewWindow(text, mimeType) {
  let url = null;
  try {
    url = URL.createObjectURL(new Blob([text], { type: `${mimeType};charset=utf-8` }));
    const opened = window.open(url, '_blank');
    if (!opened) {
      URL.revokeObjectURL(url);
      return false;
    }
    window.setTimeout(() => URL.revokeObjectURL(url), WINDOW_REVOKE_DELAY_MS);
    return true;
  } catch (error) {
    if (url) URL.revokeObjectURL(url);
    logError('openTextInNewWindow: 別ウィンドウを開けなかった', error);
    return false;
  }
}
