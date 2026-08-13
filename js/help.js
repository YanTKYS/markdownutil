// help.js
// 「? ヘルプ」で開くモーダルを担当する。「使い方」「Markdown」「Marp」「プレゼン」の
// 4タブで構成され、コンテンツの保持、タブ切替、開閉、記法例のクリップボードコピーを
// ここへ集約する。app.jsには要素の受け渡しとボタンの配線程度しか持ち込まない。
// あくまで「その場で読める使い方・早見表」であり、README相当の詳細解説や
// チュートリアル、編集内容への自動挿入やWYSIWYG化は行わない。

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

// 「使い方」タブに載せる内容。あくまで「このページで何ができて、どう使うか」を
// その場で一読できる要約であり、README相当の詳細な説明や外部マニュアルは持ち込まない。
const GUIDE_FEATURES = [
  'Office文書（Word/Excel/PowerPoint）やPDFをMarkdownへ変換する',
  '変換したMarkdown、または直接書いたMarkdownをその場で編集する',
  '編集結果を「文書」タブで整形表示する',
  '編集結果を「スライド」タブで表示する（Marp記法対応）',
  'Markdownをテキストファイルとして保存する',
  '編集内容をクリップボードへコピーする',
  'スライドをHTMLファイルとして書き出す（発表用スライドショーとして単体で開ける）',
  'スライドを印刷・PDF化する',
];

const GUIDE_STEPS = [
  'ファイルをドラッグ＆ドロップするか「ファイルを開く」で読み込む（Office文書・PDFはMarkdownへ自動変換される。すでにMarkdownがあれば直接貼り付けてもよい）',
  '左側のMarkdownエディタで内容を確認・編集する',
  '右側の「文書」「スライド」タブを切り替えて、仕上がりを確認する',
  '必要に応じて保存・コピー・HTML出力・印刷を行う',
  'スライドを人前で見せたい場合は「プレゼン」タブを参照する',
];

const GUIDE_FILE_TYPES = 'Word／Excel／PowerPoint／PDF／CSV／RTF／OpenDocument（.odt/.ods/.odp）／EPUB／Markdown（.md, .txt）など、代表的な形式に対応する（実際に変換できるかどうかは読み込み時にAnyDocが判定する）。';
const GUIDE_FILE_NOTE = '画像だけをスキャンしたPDF（文字情報を持たないPDF）は、文字として読み取れないためMarkdownへ変換できない場合がある。その場合は元文書やOCR済みのファイルを利用する。';

const GUIDE_DOC_VS_SLIDE = [
  { term: '「文書」タブ', desc: '同じMarkdownを、見出し・箇条書き・表などを整形した「読み物」として表示する。' },
  { term: '「スライド」タブ', desc: '同じMarkdownを「---」で区切り、1枚ずつのスライドとして表示する。Marp独自の記法（テーマ・背景・スピーカーノート等）は「Marp」タブを参照。' },
];

// 「プレゼン」タブに載せる内容。
const PRESENTATION_STEPS = [
  '「スライド」タブに切り替え、内容を確認する',
  'スライドツールバーの「プレゼン表示」を押す（別ウィンドウが開く）',
  '開いた別ウィンドウを、プロジェクターや外部ディスプレイ側へ手動でドラッグして移動する（自動での移動・全画面化は行わない。IIS配置はHTTP想定のため、ブラウザの画面配置API等には依存しない）',
  '必要であれば別ウィンドウ側で全画面表示にする。元のウィンドウには発表者ビュー（現在/次のスライド・スピーカーノート・ページ位置）が表示され、進行操作は元のウィンドウ側から行う',
];

const PRESENTER_VIEW_FEATURES = [
  '現在のスライドと次のスライドを並べて表示する',
  'スピーカーノート（発表メモ）を表示する',
  '現在のページ位置（例: 2 / 5）を表示する',
  '「前へ」「次へ」ボタンとキーボード操作でスライドを進める',
  '「終了」でプレゼンを終了し、別ウィンドウも閉じる',
];

const PRESENTATION_NOTE_EXAMPLE = {
  title: 'スピーカーノートの書き方（例）',
  desc: 'スライドの区切りの間に書いたHTMLコメントが、発表者ビューのメモになる。記法の詳細は「Marp」タブを参照。',
  code: '<!--\nここに発表時のメモを書く。\n発表者ビューに表示される。\n-->',
};

const HTML_EXPORT_NOTE = 'スライドツールバーの「HTML出力」で、Marp Coreを同梱せず、単体でスライドショーできるHTMLファイルとして保存できる。キーボード・クリックでのページ送り、全画面表示、印刷に対応する（発表者ビューなしの簡易版）。';

let els = null; // { openBtn, overlay, dialog, closeBtn, tabButtons, panels, statusCallback }
let lastFocused = null;
let rendered = false;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildItem(item) {
  const article = document.createElement('article');
  article.className = 'help-item';

  article.appendChild(el('h3', 'help-item__title', item.title));
  article.appendChild(el('p', 'help-item__desc', item.desc));

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
  copyBtn.addEventListener('click', () => copySnippet(item.code, copyBtn));
  codeWrap.appendChild(copyBtn);

  article.appendChild(codeWrap);
  return article;
}

function buildPanel(items) {
  const section = document.createElement('div');
  section.className = 'help-panel';
  items.forEach((item) => section.appendChild(buildItem(item)));
  return section;
}

function buildGuidePanel() {
  const wrap = document.createElement('div');
  wrap.className = 'help-guide';

  wrap.appendChild(el('p', 'help-guide__intro', 'MarkdownUtilは、Office文書やPDFをMarkdownへ変換し、そのままブラウザ上で編集・「文書」「スライド」表示ができるツール。文書変換・編集・表示はブラウザ内で処理し、MarkdownUtil自身は外部APIやCDNへ通信しない。'));

  wrap.appendChild(el('h3', 'help-section__title', 'できること'));
  const features = el('ul', 'help-guide__list');
  GUIDE_FEATURES.forEach((text) => features.appendChild(el('li', null, text)));
  wrap.appendChild(features);

  wrap.appendChild(el('h3', 'help-section__title', '基本的な利用の流れ'));
  const steps = el('ol', 'help-guide__steps');
  GUIDE_STEPS.forEach((text) => steps.appendChild(el('li', null, text)));
  wrap.appendChild(steps);

  const flow = document.createElement('div');
  flow.className = 'help-flow';
  flow.appendChild(el('div', 'help-flow__box', 'Office文書 / PDF'));
  flow.appendChild(el('div', 'help-flow__arrow', '↓ 変換'));
  flow.appendChild(el('div', 'help-flow__box', 'Markdown（編集可能）'));
  flow.appendChild(el('div', 'help-flow__arrow', '↓ 表示切替'));
  const branch = document.createElement('div');
  branch.className = 'help-flow__branch';
  branch.appendChild(el('div', 'help-flow__box', '文書タブ'));
  branch.appendChild(el('div', 'help-flow__box', 'スライドタブ'));
  flow.appendChild(branch);
  wrap.appendChild(flow);

  wrap.appendChild(el('h3', 'help-section__title', '読み込めるファイル'));
  wrap.appendChild(el('p', 'help-guide__text', GUIDE_FILE_TYPES));
  wrap.appendChild(el('p', 'help-guide__note', GUIDE_FILE_NOTE));

  wrap.appendChild(el('h3', 'help-section__title', '「文書」タブと「スライド」タブの違い'));
  const defs = document.createElement('dl');
  defs.className = 'help-guide__defs';
  GUIDE_DOC_VS_SLIDE.forEach((entry) => {
    defs.appendChild(el('dt', null, entry.term));
    defs.appendChild(el('dd', null, entry.desc));
  });
  wrap.appendChild(defs);

  return wrap;
}

function buildPresentationPanel() {
  const wrap = document.createElement('div');
  wrap.className = 'help-guide';

  wrap.appendChild(el('p', 'help-guide__intro', 'スライド表示の内容を、別ウィンドウを使って発表用に映すための機能。'));

  wrap.appendChild(el('h3', 'help-section__title', 'プレゼン表示（外部ディスプレイの利用）'));
  const steps = el('ol', 'help-guide__steps');
  PRESENTATION_STEPS.forEach((text) => steps.appendChild(el('li', null, text)));
  wrap.appendChild(steps);
  wrap.appendChild(el('p', 'help-guide__note', 'HTTP配信（IISでの閉域環境配置）を前提としているため、外部ディスプレイへの自動移動・自動全画面化は行わない。ウィンドウの移動・全画面化は手動で行う。'));

  wrap.appendChild(el('h3', 'help-section__title', '発表者ビュー'));
  const features = el('ul', 'help-guide__list');
  PRESENTER_VIEW_FEATURES.forEach((text) => features.appendChild(el('li', null, text)));
  wrap.appendChild(features);

  wrap.appendChild(el('h3', 'help-section__title', 'スピーカーノート'));
  wrap.appendChild(buildItem(PRESENTATION_NOTE_EXAMPLE));

  wrap.appendChild(el('h3', 'help-section__title', 'HTML出力'));
  wrap.appendChild(el('p', 'help-guide__text', HTML_EXPORT_NOTE));

  return wrap;
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

// 一時的に「コピー済み」表示へ切り替える（ステータス表示はオーバーレイの背面になり
// 目に入りにくいため、コピー元のボタン自体でも分かるようにする）。
function flashCopied(button) {
  if (button._copyResetTimer) {
    window.clearTimeout(button._copyResetTimer);
  } else {
    button.dataset.originalLabel = button.textContent;
  }
  button.textContent = 'コピー済み';
  button._copyResetTimer = window.setTimeout(() => {
    button.textContent = button.dataset.originalLabel;
    button._copyResetTimer = null;
  }, 1200);
}

async function copySnippet(text, triggerBtn) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // execCommand('copy')は一時textareaへフォーカスを移すため、下のfinallyで
      // 呼び出し元の「コピー」ボタンへフォーカスを戻す。
      legacyCopy(text);
    }
    notify('記法例をコピーしました', 'success');
    if (triggerBtn) flashCopied(triggerBtn);
  } catch (error) {
    notify('コピーに失敗しました。テキストを選択して手動でコピーしてください。', 'error');
  } finally {
    if (triggerBtn && document.activeElement !== triggerBtn) {
      triggerBtn.focus();
    }
  }
}

function notify(message, tone) {
  if (els && typeof els.onStatus === 'function') {
    els.onStatus(message, tone);
  }
}

const TAB_NAMES = ['guide', 'markdown', 'marp', 'presentation'];

function renderPanelsOnce() {
  if (rendered) return;
  els.panels.guide.appendChild(buildGuidePanel());
  els.panels.markdown.appendChild(buildPanel(MARKDOWN_ITEMS));
  els.panels.marp.appendChild(buildPanel(MARP_ITEMS));
  els.panels.presentation.appendChild(buildPresentationPanel());
  rendered = true;
}

function setTab(name) {
  TAB_NAMES.forEach((tabName) => {
    const isActive = tabName === name;
    els.tabButtons[tabName].classList.toggle('is-active', isActive);
    els.tabButtons[tabName].setAttribute('aria-selected', String(isActive));
    els.panels[tabName].hidden = !isActive;
  });
}

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** ダイアログ内で、今実際に見えている（隠れたタブパネル内ではない）フォーカス可能要素。 */
function focusableElements() {
  return Array.from(els.dialog.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((el) => el.offsetParent !== null);
}

// role="dialog" aria-modal="true"を名乗る以上、Tab/Shift+Tabがダイアログの外
// （背面の通常画面）へ抜けてしまうと、見た目はモーダルなのにキーボードだけ背面を
// 操作できてしまう。フォーカス可能要素の先頭・末尾で折り返すことで閉じ込める。
function trapTab(event) {
  const focusable = focusableElements();
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey) {
    if (active === first || !els.dialog.contains(active)) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last || !els.dialog.contains(active)) {
    event.preventDefault();
    first.focus();
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
  } else if (event.key === 'Tab') {
    trapTab(event);
  }
}

export function open() {
  renderPanelsOnce();
  lastFocused = document.activeElement;
  els.overlay.hidden = false;
  setTab('guide');
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
 *   tabGuideBtn: HTMLButtonElement, tabMarkdownBtn: HTMLButtonElement, tabMarpBtn: HTMLButtonElement,
 *   tabPresentationBtn: HTMLButtonElement,
 *   guidePanel: HTMLElement, markdownPanel: HTMLElement, marpPanel: HTMLElement, presentationPanel: HTMLElement,
 *   onStatus?: (message: string, tone: string) => void,
 * }} elements
 */
export function init(elements) {
  els = {
    openBtn: elements.openBtn,
    overlay: elements.overlay,
    dialog: elements.dialog,
    closeBtn: elements.closeBtn,
    tabButtons: {
      guide: elements.tabGuideBtn,
      markdown: elements.tabMarkdownBtn,
      marp: elements.tabMarpBtn,
      presentation: elements.tabPresentationBtn,
    },
    panels: {
      guide: elements.guidePanel,
      markdown: elements.markdownPanel,
      marp: elements.marpPanel,
      presentation: elements.presentationPanel,
    },
    onStatus: elements.onStatus,
  };

  els.openBtn.addEventListener('click', open);
  els.closeBtn.addEventListener('click', close);
  TAB_NAMES.forEach((tabName) => {
    els.tabButtons[tabName].addEventListener('click', () => setTab(tabName));
  });

  // 背景（オーバーレイ自身)をクリックした場合だけ閉じる。ダイアログ内のクリックが
  // 誤ってバブリングしても閉じないよう、クリックされた要素そのものを確認する。
  els.overlay.addEventListener('click', (event) => {
    if (event.target === els.overlay) close();
  });
}
