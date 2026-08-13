// help.js
// 「? ヘルプ」で開く、Markdown / Marp記法の早見表を担当する。
// 記法データの保持、タブ切替、開閉、記法例のクリップボードコピーをここへ集約し、
// app.jsには要素の受け渡しとボタンの配線程度しか持ち込まない。
// あくまで「書き方を忘れたときにその場で確認できる」早見表であり、
// 編集内容への自動挿入やWYSIWYG化は行わない。

const MARKDOWN_ITEMS = [
  {
    title: '見出し',
    desc: '#の数で見出しレベルを表す。',
    code: '# 見出し1\n## 見出し2\n### 見出し3',
  },
  {
    title: '太字・斜体',
    desc: '`**`で太字、`*`で斜体。',
    code: '**太字**\n*斜体*',
  },
  {
    title: '箇条書き',
    desc: '`-`で項目。半角スペースのインデントで子項目にする。',
    code: '- 項目1\n- 項目2\n  - 子項目',
  },
  {
    title: '番号付きリスト',
    desc: '`数字.`で番号付きの項目。',
    code: '1. 項目1\n2. 項目2',
  },
  {
    title: 'リンク',
    desc: '`[表示文字](URL)`の形式。',
    code: '[表示文字](https://example.com)',
  },
  {
    title: '画像',
    desc: '`![代替テキスト](画像のパス)`の形式。',
    code: '![代替テキスト](image.png)',
  },
  {
    title: '引用',
    desc: '行頭に`>`を付ける。',
    code: '> 引用文',
  },
  {
    title: 'コード',
    desc: '` ``` `で囲むとコードブロック（固定幅表示）になる。',
    code: '```text\nコード・固定幅表示\n```',
  },
  {
    title: '表',
    desc: '`|`で列を区切り、2行目に`---`の区切り行を置く。',
    code: '| 項目 | 内容 |\n| --- | --- |\n| A | 説明 |\n| B | 説明 |',
  },
  {
    title: '水平線',
    desc: '`-`を3つ以上並べる。※スライドモードでは、この`---`はMarpのスライド区切りとして扱われる（「Marp」タブの「スライド区切り」を参照）。',
    code: '---',
  },
];

const MARP_ITEMS = [
  {
    title: 'Marp有効化',
    desc: '先頭のfront matterに`marp: true`を書くと、Marp記法が有効なスライドとして扱われる。',
    code: '---\nmarp: true\n---',
  },
  {
    title: 'スライド区切り',
    desc: '本文中の`---`（前後に空行）でスライドを区切る。',
    code: '---',
  },
  {
    title: 'テーマ',
    desc: '`theme:`で切り替える。MarkdownUtilで使える既存テーマは default / gaia / uncover の3種類。',
    code: '---\nmarp: true\ntheme: default\n---',
  },
  {
    title: 'ページ番号',
    desc: '`paginate: true`でスライドにページ番号を表示する。',
    code: '---\npaginate: true\n---',
  },
  {
    title: '背景色',
    desc: 'そのスライドだけに適用するディレクティブ（`_`始まり）。',
    code: '<!-- _backgroundColor: #f5f5f5 -->',
  },
  {
    title: '文字色',
    desc: 'そのスライドだけの文字色を指定する。',
    code: '<!-- _color: #333333 -->',
  },
  {
    title: 'スライド単位のクラス',
    desc: 'テーマが用意するクラス（`lead`等）をそのスライドへ適用する。',
    code: '<!-- _class: lead -->',
  },
  {
    title: '背景画像',
    desc: '`![bg]`でスライド背景に画像を敷く。`cover`を付けるとスライド全体を覆うように拡大表示する。',
    code: '![bg](image.jpg)\n![bg cover](image.jpg)',
  },
  {
    title: 'スピーカーノート',
    desc: 'スライドの区切りの間に書いたHTMLコメントは、発表時のメモ（スピーカーノート）として扱われる。MarkdownUtil v0.3.xの発表者ビューに表示される。',
    code: '<!--\nここに発表時のメモを書く。\n発表者ビューに表示される。\n-->',
  },
];

let els = null; // { openBtn, overlay, dialog, closeBtn, tabButtons, panels, statusCallback }
let lastFocused = null;
let rendered = false;

function buildPanel(items) {
  const section = document.createElement('div');
  section.className = 'help-panel';

  items.forEach((item) => {
    const article = document.createElement('article');
    article.className = 'help-item';

    const title = document.createElement('h3');
    title.className = 'help-item__title';
    title.textContent = item.title;
    article.appendChild(title);

    const desc = document.createElement('p');
    desc.className = 'help-item__desc';
    desc.textContent = item.desc;
    article.appendChild(desc);

    const codeWrap = document.createElement('div');
    codeWrap.className = 'help-item__code-wrap';

    const pre = document.createElement('pre');
    pre.className = 'help-item__code';
    const code = document.createElement('code');
    code.textContent = item.code;
    pre.appendChild(code);
    codeWrap.appendChild(pre);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'help-item__copy-btn';
    copyBtn.textContent = 'コピー';
    copyBtn.addEventListener('click', () => copySnippet(item.code));
    codeWrap.appendChild(copyBtn);

    article.appendChild(codeWrap);
    section.appendChild(article);
  });

  return section;
}

function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
  if (!ok) throw new Error('execCommand copy failed');
}

async function copySnippet(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      legacyCopy(text);
    }
    notify('記法例をコピーしました', 'success');
  } catch (error) {
    notify('コピーに失敗しました。テキストを選択して手動でコピーしてください。', 'error');
  }
}

function notify(message, tone) {
  if (els && typeof els.onStatus === 'function') {
    els.onStatus(message, tone);
  }
}

function renderPanelsOnce() {
  if (rendered) return;
  els.panels.markdown.appendChild(buildPanel(MARKDOWN_ITEMS));
  els.panels.marp.appendChild(buildPanel(MARP_ITEMS));
  rendered = true;
}

function setTab(name) {
  const isMarkdown = name === 'markdown';
  els.tabButtons.markdown.classList.toggle('is-active', isMarkdown);
  els.tabButtons.markdown.setAttribute('aria-selected', String(isMarkdown));
  els.tabButtons.marp.classList.toggle('is-active', !isMarkdown);
  els.tabButtons.marp.setAttribute('aria-selected', String(!isMarkdown));

  els.panels.markdown.hidden = !isMarkdown;
  els.panels.marp.hidden = isMarkdown;
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
  }
}

export function open() {
  renderPanelsOnce();
  lastFocused = document.activeElement;
  els.overlay.hidden = false;
  setTab('markdown');
  document.addEventListener('keydown', handleKeydown);
  els.closeBtn.focus();
}

export function close() {
  if (els.overlay.hidden) return;
  els.overlay.hidden = true;
  document.removeEventListener('keydown', handleKeydown);
  if (lastFocused && typeof lastFocused.focus === 'function') {
    lastFocused.focus();
  }
}

/**
 * @param {{
 *   openBtn: HTMLButtonElement, overlay: HTMLElement, dialog: HTMLElement, closeBtn: HTMLButtonElement,
 *   tabMarkdownBtn: HTMLButtonElement, tabMarpBtn: HTMLButtonElement,
 *   markdownPanel: HTMLElement, marpPanel: HTMLElement,
 *   onStatus?: (message: string, tone: string) => void,
 * }} elements
 */
export function init(elements) {
  els = {
    openBtn: elements.openBtn,
    overlay: elements.overlay,
    dialog: elements.dialog,
    closeBtn: elements.closeBtn,
    tabButtons: { markdown: elements.tabMarkdownBtn, marp: elements.tabMarpBtn },
    panels: { markdown: elements.markdownPanel, marp: elements.marpPanel },
    onStatus: elements.onStatus,
  };

  els.openBtn.addEventListener('click', open);
  els.closeBtn.addEventListener('click', close);
  els.tabButtons.markdown.addEventListener('click', () => setTab('markdown'));
  els.tabButtons.marp.addEventListener('click', () => setTab('marp'));

  // 背景（オーバーレイ自身)をクリックした場合だけ閉じる。ダイアログ内のクリックが
  // 誤ってバブリングしても閉じないよう、クリックされた要素そのものを確認する。
  els.overlay.addEventListener('click', (event) => {
    if (event.target === els.overlay) close();
  });
}
