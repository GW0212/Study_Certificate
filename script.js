
const STORAGE_KEY = 'cert-study-site-data-v6';

const MENU_ICON_OPTIONS = ['📘','🖥️','🧪','✅','🗄️','📊','⌨️','🎨','🤖','🧠','📑','💻','📚','📝','📌','📈','🧾','🔖','📁','⭐'];
const presetMenus = [
  ['MOS', '🖥️'],
  ['CSTS', '🧪'],
  ['ISTQB', '✅'],
  ['SQLD', '🗄️'],
  ['ADSP', '📊'],
  ['ITQ', '⌨️'],
  ['GTQ', '🎨'],
  ['GTQ-AI', '🤖'],
  ['AI-POT', '🧠'],
  ['컴활 1급', '📑'],
  ['정보처리기사', '💻']
];

const defaultData = {
  selectedMenuId: 'menu-2',
  sidebarCollapsed: false,
  menus: presetMenus.map((item, index) => ({
    id: `menu-${index + 1}`,
    name: item[0],
    emoji: item[1],
    contentTitle: `${item[0]} 공부 메모`,
    contentText: index === 1 ? '여기에 시험 범위, 오답 정리, 핵심 개념을 정리하세요.\n\n예)\n- 테스트 전략\n- 테스트 프로세스\n- 명세 기반 테스트' : '',
    contentHtml: index === 1 ? '여기에 시험 범위, 오답 정리, 핵심 개념을 정리하세요.<br><br>예)<br>- 테스트 전략<br>- 테스트 프로세스<br>- 명세 기반 테스트' : '',
    attachments: []
  }))
};

let appData = loadData();
let isAdminMode = false;
let pendingAttachments = [];
let savedEditorRange = null;
let selectedInlineMedia = null;
let draggedInlineMedia = null;
let inlineMediaDragMode = 'move';
let inlineMediaPointerDrag = null;
let iconPickerTargetMenuId = null;

const menuList = document.getElementById('menuList');
const currentMenuTitle = document.getElementById('currentMenuTitle');
const contentView = document.getElementById('contentView');
const viewerSection = document.getElementById('viewerSection');
const editorSection = document.getElementById('editorSection');
const adminMenuActions = document.getElementById('adminMenuActions');
const adminStatus = document.getElementById('adminStatus');
const exitAdminBtn = document.getElementById('exitAdminBtn');
const contentTitleInput = document.getElementById('contentTitleInput');
const contentTextInput = document.getElementById('contentTextInput');
const youtubeInput = document.getElementById('youtubeInput');
const youtubePreviewEditor = document.getElementById('youtubePreviewEditor');
const localModeNotice = document.getElementById('localModeNotice');
const sidebar = document.getElementById('sidebar');
const searchInput = document.getElementById('searchInput');
const attachmentInput = document.getElementById('attachmentInput');
const attachmentListEditor = document.getElementById('attachmentListEditor');
const iconPickerModal = document.getElementById('iconPickerModal');
const iconPickerGrid = document.getElementById('iconPickerGrid');
const iconPickerCurrent = document.getElementById('iconPickerCurrent');
const iconPickerCancelBtn = document.getElementById('iconPickerCancelBtn');
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
const textColorPicker = document.getElementById('textColorPicker');
const colorApplyBtn = document.getElementById('colorApplyBtn');
const toolbarButtons = Array.from(document.querySelectorAll('.toolbar-btn'));

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function convertPlainTextToHtml(text) {
  return escapeHtml(text || '').replace(/\n/g, '<br>');
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultData);
    const parsed = JSON.parse(raw);
    if (!parsed.menus?.length) return structuredClone(defaultData);

    parsed.sidebarCollapsed = Boolean(parsed.sidebarCollapsed);
    parsed.menus = parsed.menus.map(menu => ({
      emoji: '📘',
      attachments: [],
      ...menu,
      attachments: Array.isArray(menu.attachments) ? menu.attachments : [],
      contentHtml: menu.contentHtml || convertPlainTextToHtml(menu.contentText || '')
    }));
    return parsed;
  } catch (error) {
    console.error('데이터 로드 실패:', error);
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function getSelectedMenu() {
  return appData.menus.find(menu => menu.id === appData.selectedMenuId) || appData.menus[0] || null;
}

function getYoutubeVideoId(url) {
  if (!url) return null;
  const trimmed = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  try {
    const parsed = new URL(trimmed);
    const id = parsed.searchParams.get('v');
    if (id && id.length === 11) return id;
  } catch (_) {}
  return null;
}

function extractYoutubeUrls(text) {
  if (!text) return [];
  const matches = String(text).match(/https?:\/\/[^\s<]+/g) || [];
  const urls = [];
  for (const match of matches) {
    if (getYoutubeVideoId(match)) urls.push(match);
  }
  return [...new Set(urls)];
}

function isLocalFileMode() {
  return window.location.protocol === 'file:';
}

function createYoutubeEmbed(videoId) {
  if (!videoId) return '';
  if (isLocalFileMode()) {
    return `
      <div class="video-block">
        <div class="video-caption">유튜브 미리보기</div>
        <div class="local-video-guide">
          <p>로컬 파일(file://)로 직접 열면 YouTube 정책상 오류 153이 발생할 수 있습니다.</p>
          <p><strong>start_server.bat</strong>으로 실행하면 정상 재생됩니다.</p>
          <a class="watch-link-btn" href="https://www.youtube.com/watch?v=${videoId}" target="_blank" rel="noopener noreferrer">유튜브에서 바로 보기</a>
        </div>
      </div>
    `;
  }
  const origin = encodeURIComponent(window.location.origin);
  return `
    <div class="video-block">
      <div class="video-caption">유튜브 미리보기</div>
      <div class="video-frame-wrap">
        <iframe
          src="https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&origin=${origin}"
          title="YouTube video preview"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen
        ></iframe>
      </div>
    </div>
  `;
}

function renderAttachmentsBlock(attachments) {
  if (!attachments?.length) return '';
  const items = attachments.map((item, index) => {
    const safeName = escapeHtml(item.name || `첨부파일 ${index + 1}`);
    const isImage = item.type?.startsWith('image/');
    const thumb = isImage
      ? `<div class="attachment-thumb"><img src="${item.data}" alt="${safeName}" /></div>`
      : `<div class="attachment-thumb pdf-badge">PDF</div>`;

    return `
      <a class="attachment-card attachment-download-card" href="${item.data}" download="${safeName}" title="클릭하면 다운로드됩니다">
        ${thumb}
        <div class="attachment-meta">${safeName}</div>
        <div class="attachment-click-hint">클릭하면 다운로드</div>
      </a>
    `;
  }).join('');
  return `
    <div class="attachments-block">
      <div class="attachments-title">첨부 파일</div>
      <div class="attachments-grid">${items}</div>
    </div>
  `;
}

function getSearchFilteredMenus() {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) return appData.menus;
  return appData.menus.filter(menu => {
    return [
      menu.name,
      menu.contentTitle,
      menu.contentText,
      menu.contentHtml,
      ...(menu.attachments || []).map(file => file.name)
    ].some(value => String(value || '').toLowerCase().includes(q));
  });
}

function renderMenus() {
  const filteredMenus = getSearchFilteredMenus();
  menuList.innerHTML = '';
  if (!filteredMenus.length) {
    menuList.innerHTML = `<li class="menu-empty">검색 결과가 없습니다.</li>`;
    return;
  }

  filteredMenus.forEach(menu => {
    const li = document.createElement('li');
    li.className = 'menu-item';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = menu.id === appData.selectedMenuId ? 'active' : '';
    button.innerHTML = `
      <span class="menu-main-label">
        <span class="menu-emoji" data-icon-menu="${menu.id}" title="${isAdminMode ? '아이콘 변경' : ''}">${escapeHtml(menu.emoji || '📘')}</span>
        <span class="menu-label">${escapeHtml(menu.name)}</span>
      </span>
      <span class="menu-actions-inline">
        <button type="button" class="menu-icon-btn edit-btn" data-edit-menu="${menu.id}" title="메뉴 제목 수정">✏️</button>
        <button type="button" class="menu-icon-btn delete-btn" data-delete-menu="${menu.id}" title="메뉴 삭제">✖</button>
      </span>
    `;
    button.addEventListener('click', () => {
      appData.selectedMenuId = menu.id;
      saveData();
      renderAll();
    });
    li.appendChild(button);
    menuList.appendChild(li);
  });

  if (isAdminMode) {
    document.querySelectorAll('[data-edit-menu]').forEach(btn => {
      btn.addEventListener('click', event => {
        event.stopPropagation();
        renameMenuInline(btn.getAttribute('data-edit-menu'));
      });
    });
    document.querySelectorAll('[data-delete-menu]').forEach(btn => {
      btn.addEventListener('click', event => {
        event.stopPropagation();
        deleteMenuInline(btn.getAttribute('data-delete-menu'));
      });
    });
    document.querySelectorAll('[data-icon-menu]').forEach(el => {
      el.addEventListener('click', event => {
        event.stopPropagation();
        openIconPicker(el.getAttribute('data-icon-menu'));
      });
    });
  }
}

function normalizeContentLinks(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.includes('http')) return NodeFilter.FILTER_REJECT;
      if (node.parentElement && ['A', 'SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  const urlRegex = /https?:\/\/[^\s<]+/g;
  for (const textNode of nodes) {
    const text = textNode.nodeValue;
    let match;
    let last = 0;
    const frag = document.createDocumentFragment();
    while ((match = urlRegex.exec(text)) !== null) {
      const before = text.slice(last, match.index);
      if (before) frag.appendChild(document.createTextNode(before));
      const url = match[0];
      const a = document.createElement('a');
      a.href = url;
      a.textContent = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      frag.appendChild(a);
      last = match.index + url.length;
    }
    const after = text.slice(last);
    if (after) frag.appendChild(document.createTextNode(after));
    textNode.parentNode.replaceChild(frag, textNode);
  }
}

function injectYoutubePreviews(container) {
  const anchors = Array.from(container.querySelectorAll('a[href]'));

  function getPreviewHost(anchor) {
    let el = anchor.parentElement;
    while (el && el !== container) {
      if (['P', 'LI', 'BLOCKQUOTE'].includes(el.tagName)) return el;
      if (el.tagName === 'DIV' && !el.classList.contains('rendered-rich-content') && !el.classList.contains('inline-youtube-preview')) {
        return el;
      }
      el = el.parentElement;
    }
    return anchor;
  }

  anchors.forEach(anchor => {
    const href = anchor.getAttribute('href') || '';
    const videoId = getYoutubeVideoId(href);
    if (!videoId) return;

    const previewWrap = document.createElement('div');
    previewWrap.className = 'inline-youtube-preview';
    previewWrap.innerHTML = createYoutubeEmbed(videoId);

    const host = getPreviewHost(anchor);
    if (host.nextElementSibling && host.nextElementSibling.classList?.contains('inline-youtube-preview')) {
      host.nextElementSibling.remove();
    }
    host.insertAdjacentElement('afterend', previewWrap);
  });
}

function renderContentHtmlWithEmbeds(rawHtml) {
  const wrapper = document.createElement('div');
  wrapper.className = 'rendered-rich-content';
  wrapper.innerHTML = rawHtml && rawHtml.trim() ? rawHtml : '';
  normalizeContentLinks(wrapper);
  injectYoutubePreviews(wrapper);
  return wrapper.outerHTML;
}

function renderContent() {
  const selected = getSelectedMenu();
  if (!selected) {
    currentMenuTitle.textContent = '-';
    contentView.innerHTML = document.getElementById('emptyStateTemplate').innerHTML;
    return;
  }

  currentMenuTitle.textContent = selected.name;
  const storedHtml = (selected.contentHtml && selected.contentHtml.trim()) ? selected.contentHtml : convertPlainTextToHtml(selected.contentText || '');
  const hasContent = selected.contentTitle || storedHtml;

  if (!hasContent) {
    contentView.innerHTML = document.getElementById('emptyStateTemplate').innerHTML;
  } else {
    contentView.innerHTML = `
      <article>
        <h3 class="note-title">${escapeHtml(selected.contentTitle || '제목 없음')}</h3>
      </article>
      <article>
        ${renderContentHtmlWithEmbeds(storedHtml)}
      </article>
    `;
  }

  if (isAdminMode) {
    contentTitleInput.value = selected.contentTitle || '';
    setEditorHtml(storedHtml);
    pendingAttachments = structuredClone(selected.attachments || []);
    renderEditorAttachmentList();
  }
}

function setEditorHtml(html) {
  contentTextInput.innerHTML = html && html.trim() ? html : '';
  upgradeInlineMediaElements();
}
function getEditorHtml() {
  const clone = contentTextInput.cloneNode(true);
  clone.querySelectorAll('.media-resize-handle, .inline-media-toolbar').forEach(node => node.remove());
  let html = clone.innerHTML
    .replace(/<div><br><\/div>$/g, '')
    .replace(/(<br>\s*)+$/g, '')
    .trim();
  return html;
}
function saveEditorSelection() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const range = sel.getRangeAt(0);
  if (!contentTextInput.contains(range.commonAncestorContainer)) return false;
  savedEditorRange = range.cloneRange();
  return true;
}
function restoreEditorSelection() {
  if (!savedEditorRange) return false;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedEditorRange);
  return true;
}
function getCurrentEditorRange() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    const liveRange = sel.getRangeAt(0);
    if (contentTextInput.contains(liveRange.commonAncestorContainer)) {
      savedEditorRange = liveRange.cloneRange();
      return liveRange;
    }
  }
  if (restoreEditorSelection()) {
    const sel2 = window.getSelection();
    if (sel2 && sel2.rangeCount) return sel2.getRangeAt(0);
  }
  return null;
}
function applyAlignmentToSelectedInlineMedia(cmd) {
  if (!selectedInlineMedia || !contentTextInput.contains(selectedInlineMedia)) return false;

  const media = selectedInlineMedia;
  media.style.display = 'block';
  media.style.marginTop = media.classList.contains('inline-pdf-wrap') ? '12px' : '0';
  media.style.marginBottom = media.classList.contains('inline-pdf-wrap') ? '12px' : '0';

  if (cmd === 'justifyLeft') {
    media.style.marginLeft = '0';
    media.style.marginRight = 'auto';
  } else if (cmd === 'justifyCenter') {
    media.style.marginLeft = 'auto';
    media.style.marginRight = 'auto';
  } else if (cmd === 'justifyRight') {
    media.style.marginLeft = 'auto';
    media.style.marginRight = '0';
  } else {
    return false;
  }

  saveEditorSelection();
  return true;
}

function applyEditorCommand(cmd, value = null) {
  contentTextInput.focus({ preventScroll: true });

  if (['justifyLeft', 'justifyCenter', 'justifyRight'].includes(cmd) && applyAlignmentToSelectedInlineMedia(cmd)) {
    return;
  }

  const range = getCurrentEditorRange();
  if (!range) return;

  const selectedText = String(range.toString() || '').trim();
  if (cmd === 'bold' && !selectedText) return;

  document.execCommand('styleWithCSS', false, true);
  document.execCommand(cmd, false, value);

  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    savedEditorRange = sel.getRangeAt(0).cloneRange();
  }
}
function renderEditorAttachmentList() {
  attachmentListEditor.innerHTML = '';
}
function renderYoutubePreviewInEditor() {
  youtubePreviewEditor.innerHTML = '';
}

function upgradeInlineMediaElements(root = contentTextInput) {
  root.querySelectorAll('.inline-media-wrap').forEach(media => {
    media.setAttribute('draggable', 'false');
    media.dataset.inlineMedia = 'true';
    const img = media.querySelector('img');
    if (img) {
      img.setAttribute('draggable', 'false');
    }
  });
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function placeCaretAtPoint(x, y) {
  contentTextInput.focus({ preventScroll: true });
  let range = null;
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y);
  } else if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }
  if (range && contentTextInput.contains(range.commonAncestorContainer)) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    savedEditorRange = range.cloneRange();
  }
}
function insertHtmlAtCaret(html) {
  contentTextInput.focus({ preventScroll: true });
  const range = getCurrentEditorRange();
  if (!range) {
    contentTextInput.insertAdjacentHTML('beforeend', html);
    upgradeInlineMediaElements();
    return;
  }
  range.deleteContents();
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const frag = document.createDocumentFragment();
  let lastNode = null;
  while (temp.firstChild) {
    lastNode = frag.appendChild(temp.firstChild);
  }
  range.insertNode(frag);
  if (lastNode) {
    range.setStartAfter(lastNode);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    savedEditorRange = range.cloneRange();
  }
  upgradeInlineMediaElements();
}

function insertNodeAtRange(node, range) {
  if (!node || !range) return false;
  range.deleteContents();
  range.insertNode(node);
  const spacer = document.createTextNode(' ');
  if (!node.nextSibling) {
    node.parentNode?.appendChild(spacer);
  } else {
    node.parentNode?.insertBefore(spacer, node.nextSibling);
  }
  const caretRange = document.createRange();
  caretRange.setStartAfter(spacer);
  caretRange.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(caretRange);
  savedEditorRange = caretRange.cloneRange();
  upgradeInlineMediaElements();
  return true;
}
function createInlineImageHtml(dataUrl, fileName = '') {
  const safeName = escapeHtml(fileName || 'image');
  return `<span class="inline-media-wrap inline-image-wrap" contenteditable="false" style="width: 180px; height: 180px;"><img src="${dataUrl}" alt="${safeName}" class="inline-image" /></span>`;
}
function createInlinePdfHtml(dataUrl, fileName = '') {
  const safeName = escapeHtml(fileName || 'PDF');
  return `
    <div class="inline-media-wrap inline-pdf-wrap" contenteditable="false" style="width: min(100%, 720px); height: 520px;">
      <div class="inline-pdf-header">${safeName}</div>
      <iframe src="${dataUrl}" class="inline-pdf-frame" title="${safeName}"></iframe>
    </div>
  `;
}
async function handleAttachmentFiles(files, options = {}) {
  const { insertInline = true } = options;
  for (const file of files) {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) continue;
    const dataUrl = await fileToDataUrl(file);
    if (insertInline) {
      const html = isImage ? createInlineImageHtml(dataUrl, file.name) : createInlinePdfHtml(dataUrl, file.name);
      insertHtmlAtCaret(html);
    } else {
      pendingAttachments.push({
        name: file.name,
        type: isPdf ? 'application/pdf' : file.type,
        data: dataUrl
      });
    }
  }
  if (attachmentInput) attachmentInput.value = '';
  renderEditorAttachmentList();
}
async function handleEditorPaste(event) {
  if (!isAdminMode) return;
  const items = Array.from(event.clipboardData?.items || []);
  const files = [];
  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  if (files.length) {
    event.preventDefault();
    await handleAttachmentFiles(files);
    return;
  }
  setTimeout(saveEditorSelection, 0);
}
async function handleEditorDrop(event) {
  if (!isAdminMode) return;
  event.preventDefault();
  contentTextInput.classList.remove('dragover');

  placeCaretAtPoint(event.clientX, event.clientY);
  const files = Array.from(event.dataTransfer?.files || []);
  if (files.length) {
    await handleAttachmentFiles(files, { insertInline: true });
    return;
  }
  const droppedText = event.dataTransfer?.getData('text/plain') || event.dataTransfer?.getData('text/uri-list') || '';
  if (droppedText && droppedText !== '__inline_media__') {
    contentTextInput.focus();
    document.execCommand('insertText', false, droppedText);
    saveEditorSelection();
  }
}
function handleEditorDragOver(event) {
  if (!isAdminMode) return;
  event.preventDefault();
  contentTextInput.classList.add('dragover');
}
function handleEditorDragLeave() {
  contentTextInput.classList.remove('dragover');
}

function handleInlineMediaDragStart(event) {
  return;
  const media = event.target.closest('.inline-media-wrap');
  if (!media || !contentTextInput.contains(media)) return;
  draggedInlineMedia = media;
  inlineMediaDragMode = (event.ctrlKey || event.altKey) ? 'copy' : 'move';
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copyMove';
    event.dataTransfer.setData('text/plain', '__inline_media__');
    try {
      event.dataTransfer.setDragImage(media, Math.min(40, media.clientWidth / 2), Math.min(40, media.clientHeight / 2));
    } catch (_) {}
  }
  media.classList.add('is-dragging');
}

function handleInlineMediaDragEnd() {
  removeInlineDropIndicator();
  contentTextInput.classList.remove('dragover');
}

function moveOrCopyInlineMediaAtPoint(event) {
  return false;
}


function isInlineMediaResizeHotspot(media, event) {
  const rect = media.getBoundingClientRect();
  const edgeSize = 18;
  return (rect.right - event.clientX) <= edgeSize && (rect.bottom - event.clientY) <= edgeSize;
}

function getCaretRangeFromPoint(x, y) {
  if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (!pos) return null;
    const range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    range.collapse(true);
    return range;
  }
  return null;
}

function removeInlineDropIndicator() {
  contentTextInput.querySelectorAll('.inline-drop-indicator').forEach(node => node.remove());
}

function getOrCreateInlineDropIndicator() {
  let indicator = contentTextInput.querySelector('.inline-drop-indicator');
  if (!indicator) {
    indicator = document.createElement('span');
    indicator.className = 'inline-drop-indicator';
    indicator.setAttribute('contenteditable', 'false');
  }
  return indicator;
}

function placeInlineDropIndicator(x, y) {
  removeInlineDropIndicator();
  const range = getCaretRangeFromPoint(x, y);
  if (!range) return false;
  if (!contentTextInput.contains(range.commonAncestorContainer)) return false;
  if (inlineMediaPointerDrag?.media?.contains(range.commonAncestorContainer)) return false;

  const indicator = getOrCreateInlineDropIndicator();
  const safeRange = range.cloneRange();
  safeRange.collapse(true);
  safeRange.insertNode(indicator);
  return true;
}

function cleanupInlinePointerDrag() {
  removeInlineDropIndicator();
  if (inlineMediaPointerDrag?.ghost?.parentNode) inlineMediaPointerDrag.ghost.remove();
  if (inlineMediaPointerDrag?.media) inlineMediaPointerDrag.media.classList.remove('is-dragging');
  document.body.classList.remove('inline-media-pointer-dragging');
  inlineMediaPointerDrag = null;
}

function createInlineMediaDragGhost(media) {
  const ghost = media.cloneNode(true);
  ghost.classList.add('inline-media-drag-ghost');
  ghost.style.width = `${media.offsetWidth}px`;
  ghost.style.height = `${media.offsetHeight}px`;
  document.body.appendChild(ghost);
  return ghost;
}

function positionInlineMediaDragGhost(ghost, x, y) {
  if (!ghost) return;
  ghost.style.left = `${x + 12}px`;
  ghost.style.top = `${y + 12}px`;
}

function setSelectedInlineMedia(media) {
  if (selectedInlineMedia && selectedInlineMedia !== media) {
    selectedInlineMedia.classList.remove('is-selected');
  }
  selectedInlineMedia = media || null;
  if (selectedInlineMedia) selectedInlineMedia.classList.add('is-selected');
}

function clearSelectedInlineMedia() {
  if (selectedInlineMedia) selectedInlineMedia.classList.remove('is-selected');
  selectedInlineMedia = null;
}

function startInlineMediaPointerDrag(event) {
  if (!isAdminMode) return;
  if (event.button !== 0) return;
  const media = event.target.closest('.inline-media-wrap');
  if (!media || !contentTextInput.contains(media)) {
    clearSelectedInlineMedia();
    return;
  }

  setSelectedInlineMedia(media);
  contentTextInput.focus({ preventScroll: true });

  // 리사이즈 핸들은 브라우저 기본 동작을 그대로 사용한다.
  if (isInlineMediaResizeHotspot(media, event)) return;

  event.preventDefault();
  event.stopPropagation();

  inlineMediaPointerDrag = {
    media,
    startX: event.clientX,
    startY: event.clientY,
    dragging: false,
    copy: false,
    ghost: null
  };
}

function handleInlineMediaPointerMove(event) {
  if (!inlineMediaPointerDrag) return;
  const dx = event.clientX - inlineMediaPointerDrag.startX;
  const dy = event.clientY - inlineMediaPointerDrag.startY;
  if (!inlineMediaPointerDrag.dragging) {
    if (Math.hypot(dx, dy) < 6) return;
    inlineMediaPointerDrag.dragging = true;
    inlineMediaPointerDrag.media.classList.add('is-dragging');
    document.body.classList.add('inline-media-pointer-dragging');
    inlineMediaPointerDrag.ghost = createInlineMediaDragGhost(inlineMediaPointerDrag.media);
  }
  positionInlineMediaDragGhost(inlineMediaPointerDrag.ghost, event.clientX, event.clientY);
  removeInlineDropIndicator();
  placeInlineDropIndicator(event.clientX, event.clientY);
  event.preventDefault();
}

function completeInlineMediaPointerDrop() {
  if (!inlineMediaPointerDrag?.dragging) {
    cleanupInlinePointerDrag();
    return;
  }
  const indicator = contentTextInput.querySelector('.inline-drop-indicator');
  if (!indicator) {
    cleanupInlinePointerDrag();
    return;
  }
  const source = inlineMediaPointerDrag.media;
  const node = inlineMediaPointerDrag.copy ? source.cloneNode(true) : source;
  indicator.replaceWith(node);
  const spacer = document.createTextNode(' ');
  if (!node.nextSibling) node.parentNode?.appendChild(spacer);
  else node.parentNode?.insertBefore(spacer, node.nextSibling);
  const range = document.createRange();
  range.setStartAfter(spacer);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  savedEditorRange = range.cloneRange();
  upgradeInlineMediaElements();
  cleanupInlinePointerDrag();
}

function handleInlineMediaPointerUp(event) {
  if (!inlineMediaPointerDrag) return;
  if (inlineMediaPointerDrag.dragging) {
    event?.preventDefault?.();
    placeInlineDropIndicator(event.clientX, event.clientY);
    completeInlineMediaPointerDrop();
    return;
  }
  cleanupInlinePointerDrag();
}

function updateLocalModeNotice() {
  if (isLocalFileMode()) {
    localModeNotice.classList.remove('hidden');
    localModeNotice.innerHTML = '현재 file:// 로 열려 있습니다. <strong>start_server.bat</strong>으로 실행하면 유튜브가 정상 재생됩니다.';
  } else {
    localModeNotice.classList.add('hidden');
    localModeNotice.innerHTML = '';
  }
}
function setAdminMode(enabled) {
  isAdminMode = enabled;
  editorSection.classList.toggle('hidden', !enabled);
  viewerSection.classList.toggle('hidden', enabled);
  adminMenuActions.classList.toggle('hidden', !enabled);
  exitAdminBtn.classList.toggle('hidden', !enabled);
  adminStatus.textContent = enabled ? '관리자 모드' : '일반 모드';
  document.body.classList.toggle('admin-mode-on', enabled);
  renderAll();
}
function toggleSidebar() {
  appData.sidebarCollapsed = !appData.sidebarCollapsed;
  sidebar.classList.toggle('collapsed', appData.sidebarCollapsed);
  saveData();
}
function syncSidebarToggleState() {
  const collapsed = sidebar.classList.contains('collapsed');
  sidebarToggleBtn.setAttribute('title', collapsed ? '사이드바 펼치기' : '사이드바 접기');
  sidebarToggleBtn.textContent = collapsed ? '▼' : '▲';
}
function addMenu() {
  const name = prompt('새 메뉴 이름을 입력하세요.');
  if (!name) return;
  const newMenu = {
    id: `menu-${Date.now()}`,
    name: name.trim(),
    emoji: '📘',
    contentTitle: '',
    contentText: '',
    contentHtml: '',
    attachments: []
  };
  appData.menus.push(newMenu);
  appData.selectedMenuId = newMenu.id;
  saveData();
  renderAll();
}
function renameMenuInline(menuId) {
  const target = appData.menus.find(menu => menu.id === menuId);
  if (!target) return alert('수정할 메뉴가 없습니다.');
  const newName = prompt('메뉴 제목을 수정하세요.', target.name);
  if (!newName) return;
  target.name = newName.trim();
  saveData();
  renderAll();
}
function deleteMenuInline(menuId) {
  const target = appData.menus.find(menu => menu.id === menuId);
  if (!target) return alert('삭제할 메뉴가 없습니다.');
  if (appData.menus.length === 1) {
    alert('마지막 메뉴는 삭제할 수 없습니다.');
    return;
  }
  const ok = confirm('메뉴를 삭제하시겠습니까?');
  if (!ok) return;
  appData.menus = appData.menus.filter(menu => menu.id !== menuId);
  if (appData.selectedMenuId === menuId) {
    appData.selectedMenuId = appData.menus[0]?.id || '';
  }
  saveData();
  renderAll();
}
function openIconPicker(menuId) {
  const target = appData.menus.find(menu => menu.id === menuId);
  if (!target) return;
  iconPickerTargetMenuId = menuId;
  iconPickerCurrent.textContent = `현재 아이콘: ${target.emoji || '📘'}`;
  iconPickerGrid.innerHTML = MENU_ICON_OPTIONS.map(icon => `
    <button type="button" class="icon-choice-btn" data-icon-choice="${icon}" title="${icon}">${icon}</button>
  `).join('');
  iconPickerGrid.querySelectorAll('[data-icon-choice]').forEach(btn => {
    btn.addEventListener('click', () => applyMenuIcon(btn.getAttribute('data-icon-choice')));
  });
  iconPickerModal.classList.remove('hidden');
}
function closeIconPicker() {
  iconPickerTargetMenuId = null;
  iconPickerModal.classList.add('hidden');
}
function applyMenuIcon(icon) {
  const target = appData.menus.find(menu => menu.id === iconPickerTargetMenuId);
  if (!target) return;
  target.emoji = icon;
  saveData();
  closeIconPicker();
  renderAll();
}
function saveCurrentContent() {
  const selected = getSelectedMenu();
  if (!selected) return;

  selected.contentTitle = contentTitleInput.value.trim();
  selected.contentHtml = getEditorHtml();
  selected.contentText = contentTextInput.innerText.replace(/\u00A0/g, ' ').trim();
  selected.attachments = structuredClone(pendingAttachments);
  saveData();
  renderAll();
  alert('저장되었습니다.');
}
function clearCurrentContent() {
  const selected = getSelectedMenu();
  if (!selected) return;
  const ok = confirm('현재 메뉴의 내용을 모두 삭제할까요?');
  if (!ok) return;
  selected.contentTitle = '';
  selected.contentText = '';
  selected.contentHtml = '';
  selected.attachments = [];
  pendingAttachments = [];
  saveData();
  renderAll();
}
function renderAll() {
  if (!getSelectedMenu() && appData.menus.length) {
    appData.selectedMenuId = appData.menus[0].id;
  }
  sidebar.classList.toggle('collapsed', appData.sidebarCollapsed);
  syncSidebarToggleState();
  updateLocalModeNotice();
  viewerSection.classList.toggle('hidden', isAdminMode);
  editorSection.classList.toggle('hidden', !isAdminMode);
  renderMenus();
  renderContent();
}

document.getElementById('adminToggleBtn').addEventListener('click', () => {
  const input = prompt('관리자 비밀번호를 입력하세요.');
  if (input === null) return;
  if (input === window.APP_CONFIG.ADMIN_PASSWORD) {
    setAdminMode(true);
  } else {
    alert('비밀번호가 일치하지 않습니다.');
  }
});
document.getElementById('exitAdminBtn').addEventListener('click', () => {
  const ok = confirm('관리자 모드를 종료하시겠습니까?');
  if (!ok) return;
  setAdminMode(false);
});
document.getElementById('addMenuBtn').addEventListener('click', addMenu);
document.getElementById('saveContentBtn').addEventListener('click', saveCurrentContent);
document.getElementById('clearContentBtn').addEventListener('click', clearCurrentContent);
sidebarToggleBtn.addEventListener('click', () => {
  toggleSidebar();
  syncSidebarToggleState();
});
iconPickerCancelBtn.addEventListener('click', closeIconPicker);
iconPickerModal.addEventListener('click', event => {
  if (event.target === iconPickerModal) closeIconPicker();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !iconPickerModal.classList.contains('hidden')) closeIconPicker();
});

contentTextInput.addEventListener('input', saveEditorSelection);
contentTextInput.addEventListener('mouseup', saveEditorSelection);
contentTextInput.addEventListener('keyup', saveEditorSelection);
contentTextInput.addEventListener('focus', saveEditorSelection);
contentTextInput.addEventListener('blur', () => {
  saveEditorSelection();
});
document.addEventListener('selectionchange', () => {
  saveEditorSelection();
});
document.addEventListener('mousedown', event => {
  if (event.target.closest('.inline-media-wrap')) return;
  if (event.target.closest('.editor-toolbar')) return;
  clearSelectedInlineMedia();
});
contentTextInput.addEventListener('paste', handleEditorPaste);
contentTextInput.addEventListener('drop', handleEditorDrop);
contentTextInput.addEventListener('dragover', handleEditorDragOver);
contentTextInput.addEventListener('dragleave', handleEditorDragLeave);
contentTextInput.addEventListener('dragstart', handleInlineMediaDragStart);
contentTextInput.addEventListener('dragend', handleInlineMediaDragEnd);
contentTextInput.addEventListener('mousedown', startInlineMediaPointerDrag);
contentTextInput.addEventListener('click', event => {
  const media = event.target.closest('.inline-media-wrap');
  if (media) setSelectedInlineMedia(media);
});
document.addEventListener('mousemove', handleInlineMediaPointerMove);
document.addEventListener('mouseup', handleInlineMediaPointerUp);
window.addEventListener('blur', cleanupInlinePointerDrag);

toolbarButtons.forEach(btn => {
  btn.addEventListener('mousedown', event => {
    saveEditorSelection();
    event.preventDefault();
    event.stopPropagation();
  });
  btn.addEventListener('click', () => {
    applyEditorCommand(btn.getAttribute('data-cmd'));
    saveEditorSelection();
  });
});
textColorPicker.addEventListener('mousedown', event => {
  saveEditorSelection();
  event.preventDefault();
  event.stopPropagation();
});
textColorPicker.addEventListener('input', () => {
  saveEditorSelection();
});
if (colorApplyBtn) {
  colorApplyBtn.addEventListener('mousedown', event => {
    saveEditorSelection();
    event.preventDefault();
    event.stopPropagation();
  });
  colorApplyBtn.addEventListener('click', () => {
    applyEditorCommand('foreColor', textColorPicker.value);
    saveEditorSelection();
  });
}

searchInput.addEventListener('input', renderMenus);
if (attachmentInput) {
  attachmentInput.addEventListener('change', async event => {
    await handleAttachmentFiles(Array.from(event.target.files || []), { insertInline: true });
  });
}

renderAll();
