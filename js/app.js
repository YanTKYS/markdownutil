// app.js
// UI全体の面倒を見る: ファイル選択、ドラッグ&ドロップ、エディタ更新、ボタン操作、
// 保存、コピー、クリア、ステータス表示、文書/スライドのプレビュー切替。
// 文書変換の詳細はconverter.js、通常プレビューの詳細はpreview.js、
// スライドプレビューの詳細はslide-preview.jsに委ね、ここでは呼び出しと画面更新のみ行う。

import { convertToMarkdown, isTextFile, getExtension, ConversionError, preload, PICKER_EXTENSIONS_HINT } from './converter.js';
import { updatePreview } from './preview.js';
import * as slidePreview from './slide-preview.js';
import * as presenter from './presenter.js';
import * as help from './help.js';
import { DOCUMENT_SAMPLE, SLIDE_SAMPLE } from './samples.js';
import { buildDocxBlob, WordExportError } from './word-export.js';
import { copyText, COPY_FAILED_MESSAGE } from './clipboard.js';
import { downloadBlob, downloadTextFile } from './download.js';
import { setTabSelected } from './dom.js';

const openBtn = document.getElementById('open-btn');
const fileInput = document.getElementById('file-input');
const saveBtn = document.getElementById('save-btn');
const copyBtn = document.getElementById('copy-btn');
const wordExportBtn = document.getElementById('word-export-btn');
const clearBtn = document.getElementById('clear-btn');
const statusBar = document.getElementById('status-bar');
const editor = document.getElementById('editor');
const previewEl = document.getElementById('preview');
const dropZone = document.getElementById('editor-drop-zone');

const modeDocBtn = document.getElementById('mode-doc-btn');
const modeSlideBtn = document.getElementById('mode-slide-btn');
const slideToolbar = document.getElementById('slide-toolbar');
const slideStatus = document.getElementById('slide-status');
const slideThemeSelect = document.getElementById('slide-theme-select');
const slideExportBtn = document.getElementById('slide-export-html-btn');
const slidePrintBtn = document.getElementById('slide-print-btn');
const slidePresentBtn = document.getElementById('slide-present-btn');
const slideFrame = document.getElementById('slide-frame');

const presenterCurrentFrame = document.getElementById('presenter-current-frame');
const presenterNextFrame = document.getElementById('presenter-next-frame');
const presenterNotes = document.getElementById('presenter-notes');
const presenterPosition = document.getElementById('presenter-position');
const presenterPrevBtn = document.getElementById('presenter-prev-btn');
const presenterNextBtn = document.getElementById('presenter-next-btn');
const presenterEndBtn = document.getElementById('presenter-end-btn');

const helpBtn = document.getElementById('help-btn');
const helpOverlay = document.getElementById('help-overlay');
const helpDialog = document.getElementById('help-dialog');
const helpCloseBtn = document.getElementById('help-close-btn');
const helpTabGuideBtn = document.getElementById('help-tab-guide');
const helpTabMarkdownBtn = document.getElementById('help-tab-markdown');
const helpTabMarpBtn = document.getElementById('help-tab-marp');
const helpTabPresentationBtn = document.getElementById('help-tab-presentation');
const helpGuidePanel = document.getElementById('help-panel-guide');
const helpMarkdownPanel = document.getElementById('help-panel-markdown');
const helpMarpPanel = document.getElementById('help-panel-marp');
const helpPresentationPanel = document.getElementById('help-panel-presentation');

const INITIAL_STATUS = 'ファイルを開くか、Markdownをドラッグ&ドロップしてください。';

const state = {
  isConverting: false,
  isExportingWord: false,
  saveFilename: 'document.md',
  mode: 'doc', // 'doc' | 'slide'
};

function setStatus(message, tone = 'info') {
  statusBar.textContent = message;
  if (tone === 'info') {
    statusBar.removeAttribute('data-tone');
  } else {
    statusBar.setAttribute('data-tone', tone);
  }
}

function setConverting(value) {
  state.isConverting = value;
  // 変換完了時にeditor.valueを置き換えるため、処理中の編集を許すと職員が入力した
  // 内容が予告なく失われる。Markdown自体を変更できる操作だけを一時的に止める。
  openBtn.disabled = value;
  editor.disabled = value;
  clearBtn.disabled = value;
  slideThemeSelect.disabled = value;
  wordExportBtn.disabled = value || state.isExportingWord;
}

function debounce(fn, waitMs) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

function deriveSaveFilename(sourceFilename) {
  if (!sourceFilename) return 'document.md';
  const ext = getExtension(sourceFilename);
  if (ext === 'md' || ext === 'markdown') {
    // Markdownを直接開いた場合は元のファイル名をそのまま使う。
    return sourceFilename;
  }
  const dot = sourceFilename.lastIndexOf('.');
  const base = dot > 0 ? sourceFilename.slice(0, dot) : sourceFilename;
  return `${base}.md`;
}

/**
 * 保存用ファイル名から拡張子を取り除いた部分（HTML出力・Word出力のファイル名や
 * スライドのタイトルの元にする）。
 */
function saveFilenameBase() {
  return (state.saveFilename || 'document.md').replace(/\.(md|markdown)$/i, '');
}

/* ---------- プレビュー（文書 / スライド） ---------- */

function refreshDocPreview() {
  updatePreview(previewEl, editor.value);
}

function syncThemeSelect() {
  const theme = slidePreview.readTheme(editor.value);
  slideThemeSelect.value = slidePreview.THEMES.includes(theme) ? theme : 'default';
}

// スライドの状態（枚数・エラー）はスライドツールバー内に表示する。
// 描画のたびに上書きされるため、エラーが解消すれば自動的に消える。
function setSlideStatus(text, isError) {
  slideStatus.textContent = text;
  if (isError) {
    slideStatus.dataset.tone = 'error';
  } else {
    delete slideStatus.dataset.tone;
  }
}

async function refreshSlidePreview() {
  // Marp Coreの初回読み込み中だけ表示される（読み込み済みなら描画前に上書きされる）。
  setSlideStatus('スライドを準備しています...', false);

  const { slideCount, error } = await slidePreview.render(editor.value);
  setSlideStatus(error || (slideCount > 0 ? `${slideCount}枚` : ''), Boolean(error));
  syncThemeSelect();
}

function refreshActivePreview() {
  if (state.mode === 'slide') {
    refreshSlidePreview();
  } else {
    refreshDocPreview();
  }
}

const debouncedRefreshActive = debounce(refreshActivePreview, 150);

function applyModeUI(mode) {
  state.mode = mode;
  const isSlide = mode === 'slide';

  setTabSelected(modeDocBtn, !isSlide);
  setTabSelected(modeSlideBtn, isSlide);

  previewEl.hidden = isSlide;
  slideFrame.hidden = !isSlide;
  slideToolbar.hidden = !isSlide;
}

function switchMode(mode) {
  if (state.mode === mode) return;
  applyModeUI(mode);
  refreshActivePreview();
}

/* ---------- ファイル読み込み ---------- */

async function handleFile(file) {
  if (state.isConverting) return;

  setConverting(true);
  try {
    if (isTextFile(file.name)) {
      setStatus(`${file.name} を読み込んでいます...`, 'busy');
      const text = await file.text();
      editor.value = text;
      state.saveFilename = deriveSaveFilename(file.name);
      refreshActivePreview();
      setStatus(`${file.name} を読み込みました`, 'success');
    } else {
      setStatus('変換中...', 'busy');
      const markdown = await convertToMarkdown(file);
      editor.value = markdown;
      state.saveFilename = deriveSaveFilename(file.name);
      refreshActivePreview();
      setStatus(`${file.name} → Markdown変換完了`, 'success');
    }
  } catch (error) {
    const message = error instanceof ConversionError
      ? error.message
      : 'ファイルを読み込めませんでした。';
    setStatus(message, 'error');
  } finally {
    setConverting(false);
  }
}

/* ---------- コピー / 保存 / クリア ---------- */

async function copyMarkdown() {
  if (await copyText(editor.value)) {
    setStatus('Markdownをコピーしました', 'success');
  } else {
    setStatus(COPY_FAILED_MESSAGE, 'error');
  }
}

function saveMarkdown() {
  const filename = state.saveFilename || 'document.md';
  downloadTextFile(filename, editor.value, 'text/markdown');
  setStatus(`${filename} を保存しました`, 'success');
}

async function exportWord() {
  if (state.isConverting || state.isExportingWord) return;
  if (!editor.value.trim()) {
    setStatus('Word出力するMarkdownがありません。', 'error');
    return;
  }

  // Word出力を押した時点のMarkdownとファイル名をスナップショットする。生成は非同期
  // （長文ほど時間がかかる）なので、await中にeditor.value/state.saveFilenameが
  // 別ファイルの読み込み等で変わっても、押した瞬間の文書がその文書の名前で保存されるようにする。
  const markdown = editor.value;
  const filename = `${saveFilenameBase()}.docx`;

  state.isExportingWord = true;
  wordExportBtn.disabled = true;
  setStatus('Wordファイルを作成しています...', 'busy');
  try {
    const blob = await buildDocxBlob(markdown);
    downloadBlob(filename, blob);
    setStatus(`${filename} を保存しました`, 'success');
  } catch (error) {
    const message = error instanceof WordExportError
      ? error.message
      : 'Wordファイルを作成できませんでした。';
    setStatus(message, 'error');
  } finally {
    state.isExportingWord = false;
    wordExportBtn.disabled = state.isConverting;
  }
}

function clearAll() {
  if (editor.value.trim() && !window.confirm('編集中のMarkdownを消去します。よろしいですか？')) {
    return;
  }
  editor.value = '';
  state.saveFilename = 'document.md';
  applyModeUI('doc');
  refreshActivePreview();
  setStatus(INITIAL_STATUS);
}

/* ---------- ヘルプのサンプル挿入 ---------- */

// エディタへ直接値を書き込む点はhandleFile()と同じ経路（editor.value代入 →
// applyModeUI/refreshActivePreview）を通す。debounce・文書プレビュー・スライド
// プレビュー・isRenderCurrent()による整合性はすべてrefreshActivePreview()側で
// 一括して面倒を見るため、ここで個別に描画処理を呼び直すことはしない。
// キーはそのまま挿入後の表示モード（'doc' | 'slide'）としても使う。
const SAMPLES = {
  doc: { markdown: DOCUMENT_SAMPLE, filename: 'document.md', label: '文書サンプル' },
  slide: { markdown: SLIDE_SAMPLE, filename: 'slide.md', label: 'スライドサンプル' },
};

function insertSample(mode) {
  const sample = SAMPLES[mode];

  // 変換完了時にeditor.valueを置き換えるため（setConverting()参照）、変換中に
  // サンプルを挿入すると変換結果で上書きされて消えてしまう。ヘルプ自体は開いたまま
  // 読めてよいので、挿入操作だけをここで止める。
  if (state.isConverting) {
    setStatus('変換中はサンプルを開けません。変換完了後にもう一度お試しください。', 'error');
    return;
  }
  if (editor.value.trim()
    && !window.confirm(`現在のMarkdownを${sample.label}に置き換えます。\nよろしいですか？`)) {
    return;
  }

  editor.value = sample.markdown;
  state.saveFilename = sample.filename;
  applyModeUI(mode);
  refreshActivePreview();
  help.close();
  setStatus(`${sample.label}を挿入しました`, 'success');
  editor.focus();
}

/* ---------- ドラッグ&ドロップ ---------- */

function setupDragAndDrop() {
  const activate = (event) => {
    event.preventDefault();
    if (state.isConverting) return;
    dropZone.classList.add('drag-active');
  };
  const deactivate = (event) => {
    if (!event || !dropZone.contains(event.relatedTarget)) {
      dropZone.classList.remove('drag-active');
    }
  };

  dropZone.addEventListener('dragenter', activate);
  dropZone.addEventListener('dragover', activate);
  dropZone.addEventListener('dragleave', deactivate);
  dropZone.addEventListener('dragend', () => dropZone.classList.remove('drag-active'));

  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('drag-active');
    if (state.isConverting) return;
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  // ウィンドウ全体では既定動作（ブラウザがファイルを直接開く）を防ぐだけにする。
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());
}

/* ---------- スライド専用操作 ---------- */

/**
 * 出力・印刷・プレゼン表示の前提を満たしているか確認する。
 * 解析エラー中、および入力のdebounce待ちや再描画中のように「画面のスライドがまだ今の
 * Markdownを反映していない」間は、古い内容を出力してしまうため許可しない。
 */
function hasSlides() {
  if (!slidePreview.isRenderCurrent(editor.value)) {
    setStatus('現在のMarkdownがまだスライドへ反映されていません。少し待ってから再度お試しください。', 'error');
    return false;
  }
  if (slidePreview.getSlideCount() === 0) {
    setStatus('表示できるスライドがありません。Markdownを入力してください。', 'error');
    return false;
  }
  return true;
}

function setupSlideControls() {
  slidePreview.init(slideFrame);
  presenter.init({
    currentFrame: presenterCurrentFrame,
    nextFrame: presenterNextFrame,
    notesEl: presenterNotes,
    positionEl: presenterPosition,
    prevBtn: presenterPrevBtn,
    nextBtn: presenterNextBtn,
    endBtn: presenterEndBtn,
  });

  modeDocBtn.addEventListener('click', () => switchMode('doc'));
  modeSlideBtn.addEventListener('click', () => switchMode('slide'));

  slideThemeSelect.addEventListener('change', () => {
    const updated = slidePreview.writeTheme(editor.value, slideThemeSelect.value);
    if (updated !== editor.value) {
      editor.value = updated;
    }
    refreshSlidePreview();
  });

  slideExportBtn.addEventListener('click', () => {
    if (!hasSlides()) return;
    const title = saveFilenameBase();
    downloadTextFile(`${title}.html`, slidePreview.buildStandaloneHtml(title, false), 'text/html');
    setStatus(`${title}.html を保存しました`, 'success');
  });

  slidePrintBtn.addEventListener('click', () => {
    if (!hasSlides()) return;
    if (!slidePreview.openPrintWindow(saveFilenameBase())) {
      setStatus('印刷用ウィンドウを開けませんでした。ポップアップの許可を確認してください。', 'error');
    }
  });

  slidePresentBtn.addEventListener('click', () => {
    if (!hasSlides()) return;
    if (!presenter.start()) {
      setStatus('プレゼン用ウィンドウを開けませんでした。ポップアップの許可を確認してください。', 'error');
    }
  });
}

/* ---------- 起動 ---------- */

function init() {
  fileInput.accept = PICKER_EXTENSIONS_HINT.map((ext) => `.${ext}`).join(',');

  openBtn.addEventListener('click', () => {
    if (state.isConverting) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (file) handleFile(file);
  });

  saveBtn.addEventListener('click', saveMarkdown);
  copyBtn.addEventListener('click', copyMarkdown);
  wordExportBtn.addEventListener('click', exportWord);
  clearBtn.addEventListener('click', clearAll);

  editor.addEventListener('input', debouncedRefreshActive);

  setupDragAndDrop();
  setupSlideControls();
  help.init({
    openBtn: helpBtn,
    overlay: helpOverlay,
    dialog: helpDialog,
    closeBtn: helpCloseBtn,
    tabGuideBtn: helpTabGuideBtn,
    tabMarkdownBtn: helpTabMarkdownBtn,
    tabMarpBtn: helpTabMarpBtn,
    tabPresentationBtn: helpTabPresentationBtn,
    guidePanel: helpGuidePanel,
    markdownPanel: helpMarkdownPanel,
    marpPanel: helpMarpPanel,
    presentationPanel: helpPresentationPanel,
    onStatus: setStatus,
    onInsertDocumentSample: () => insertSample('doc'),
    onInsertSlideSample: () => insertSample('slide'),
  });
  refreshActivePreview();

  // 初回変換を速くするため、バックグラウンドでWASM初期化を始めておく。
  preload();
}

init();
