// app.js
// UI全体の面倒を見る: ファイル選択、ドラッグ&ドロップ、エディタ更新、ボタン操作、
// 保存、コピー、クリア、ステータス表示。文書変換の詳細はconverter.js、
// プレビュー描画の詳細はpreview.jsに委ね、ここでは呼び出しと画面更新のみ行う。

import { convertToMarkdown, isTextFile, getExtension, ConversionError, preload, PICKER_EXTENSIONS_HINT } from './converter.js';
import { updatePreview } from './preview.js';

const openBtn = document.getElementById('open-btn');
const fileInput = document.getElementById('file-input');
const saveBtn = document.getElementById('save-btn');
const copyBtn = document.getElementById('copy-btn');
const clearBtn = document.getElementById('clear-btn');
const statusBar = document.getElementById('status-bar');
const editor = document.getElementById('editor');
const previewEl = document.getElementById('preview');
const dropZone = document.getElementById('editor-drop-zone');

const INITIAL_STATUS = 'ファイルを開くか、Markdownをドラッグ&ドロップしてください。';

const state = {
  isConverting: false,
  saveFilename: 'document.md',
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
  openBtn.disabled = value;
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

function refreshPreview() {
  updatePreview(previewEl, editor.value);
}

const debouncedRefreshPreview = debounce(refreshPreview, 150);

async function handleFile(file) {
  if (state.isConverting) return;

  setConverting(true);
  try {
    if (isTextFile(file.name)) {
      setStatus(`${file.name} を読み込んでいます...`, 'busy');
      const text = await file.text();
      editor.value = text;
      state.saveFilename = deriveSaveFilename(file.name);
      refreshPreview();
      setStatus(`${file.name} を読み込みました`, 'success');
    } else {
      setStatus('変換中...', 'busy');
      const markdown = await convertToMarkdown(file);
      editor.value = markdown;
      state.saveFilename = deriveSaveFilename(file.name);
      refreshPreview();
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

async function copyMarkdown() {
  const text = editor.value;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      legacyCopy(text);
    }
    setStatus('Markdownをコピーしました', 'success');
  } catch (error) {
    setStatus('コピーに失敗しました。テキストを選択して手動でコピーしてください。', 'error');
  }
}

function saveMarkdown() {
  const text = editor.value;
  const filename = state.saveFilename || 'document.md';
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus(`${filename} を保存しました`, 'success');
}

function clearAll() {
  if (editor.value.trim() && !window.confirm('編集中のMarkdownを消去します。よろしいですか？')) {
    return;
  }
  editor.value = '';
  state.saveFilename = 'document.md';
  refreshPreview();
  setStatus(INITIAL_STATUS);
}

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
  clearBtn.addEventListener('click', clearAll);

  editor.addEventListener('input', debouncedRefreshPreview);

  setupDragAndDrop();
  refreshPreview();

  // 初回変換を速くするため、バックグラウンドでWASM初期化を始めておく。
  preload();
}

init();
