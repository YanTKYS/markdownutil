// errors.js
// 例外の「開発者向けの記録」だけを担当する。利用者向けの日本語メッセージは各モジュール
// （converter.js / word-export.js / app.jsのステータス表示など）の責務とし、ここでは
// 原因となった例外を必ずコンソールへ残すことで、閉域環境での不具合調査（ブラウザの
// 開発者ツールしか使えない）に必要な情報が失われないようにする。
// 外部へ送信する処理は一切含まない。

const PREFIX = '[MarkdownUtil]';

/**
 * 利用者へは要約メッセージだけを見せる箇所でも、原因はコンソールへ残す。
 * @param {string} context どの処理で起きたか（例: 'convertToMarkdown'）
 * @param {unknown} error 捕捉した例外
 */
export function logError(context, error) {
  console.error(`${PREFIX} ${context}`, error);
}
