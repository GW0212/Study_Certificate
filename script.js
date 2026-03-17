
const STORAGE_KEY = 'cert-study-site-data-v7';
const GITHUB_SYNC_KEY = 'cert-study-github-sync-v2';
const REMOTE_SYNC_META_KEY = 'cert-study-last-sync-meta-v1';
const REMOTE_DATA_PATH = 'site-data.json';

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
let githubSyncConfig = loadGithubSyncConfig();
let isRemoteDataLoaded = false;
let isAdminMode = false;
let syncInProgress = false;
let queuedSyncReason = '';
let lastKnownRemoteSha = null;
let lastLoadedRemoteText = '';
let pendingSyncTimer = null;
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
const toolbarButtons = Array.from(document.querySelectorAll('.toolbar-btn'));
const applyTextColorBtn = document.getElementById('applyTextColorBtn');
const githubOwnerInput = document.getElementById('githubOwnerInput');
const githubRepoInput = document.getElementById('githubRepoInput');
const githubBranchInput = document.getElementById('githubBranchInput');
const githubTokenInput = document.getElementById('githubTokenInput');
const githubAutoSyncCheckbox = document.getElementById('githubAutoSyncCheckbox');
const githubSyncStatus = document.getElementById('githubSyncStatus');
const saveGithubConfigBtn = document.getElementById('saveGithubConfigBtn');
const syncNowBtn = document.getElementById('syncNowBtn');
const saveContentBtn = document.getElementById('saveContentBtn');

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

function normalizeLoadedData(parsed) {
  if (!parsed?.menus?.length) return structuredClone(defaultData);
  parsed.sidebarCollapsed = Boolean(parsed.sidebarCollapsed);
  parsed.menus = parsed.menus.map(menu => ({
    emoji: '📘',
    attachments: [],
    ...menu,
    attachments: Array.isArray(menu.attachments) ? menu.attachments : [],
    contentHtml: menu.contentHtml || convertPlainTextToHtml(menu.contentText || '')
  }));
  return parsed;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultData);
    const parsed = JSON.parse(raw);
    return normalizeLoadedData(parsed);
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

function loadGithubSyncConfig() {
  try {
    const raw = localStorage.getItem(GITHUB_SYNC_KEY);
    if (!raw) return { owner: '', repo: '', branch: 'main', token: '', autoSync: false };
    const parsed = JSON.parse(raw);
    return {
      owner: String(parsed.owner || '').trim(),
      repo: String(parsed.repo || '').trim(),
      branch: String(parsed.branch || 'main').trim() || 'main',
      token: String(parsed.token || '').trim(),
      autoSync: Boolean(parsed.autoSync)
    };
  } catch (error) {
    console.error('GitHub 설정 로드 실패:', error);
    return { owner: '', repo: '', branch: 'main', token: '', autoSync: false };
  }
}

function saveGithubSyncConfig() {
  localStorage.setItem(GITHUB_SYNC_KEY, JSON.stringify(githubSyncConfig));
}

function fillGithubSyncForm() {
  if (!githubOwnerInput) return;
  githubOwnerInput.value = githubSyncConfig.owner || '';
  githubRepoInput.value = githubSyncConfig.repo || '';
  githubBranchInput.value = githubSyncConfig.branch || 'main';
  githubTokenInput.value = githubSyncConfig.token || '';
  githubAutoSyncCheckbox.checked = Boolean(githubSyncConfig.autoSync);
  updateGithubSyncStatus();
}

function updateGithubSyncStatus(message = '') {
  if (!githubSyncStatus) return;
  let text = message || '미설정';
  githubSyncStatus.classList.remove('ok', 'warn');
  if (githubSyncConfig.owner && githubSyncConfig.repo && githubSyncConfig.branch && githubSyncConfig.token) {
    text = message || (githubSyncConfig.autoSync ? '자동 반영 켜짐' : '연동 정보 저장됨');
    githubSyncStatus.classList.add(githubSyncConfig.autoSync ? 'ok' : 'warn');
  }
  githubSyncStatus.textContent = text;
}

function readGithubSyncForm() {
  githubSyncConfig = {
    owner: githubOwnerInput.value.trim(),
    repo: githubRepoInput.value.trim(),
    branch: githubBranchInput.value.trim() || 'main',
    token: githubTokenInput.value.trim(),
    autoSync: githubAutoSyncCheckbox.checked
  };
  saveGithubSyncConfig();
  updateGithubSyncStatus();
}


function loadRemoteSyncMeta() {
  try {
    const raw = localStorage.getItem(REMOTE_SYNC_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function saveRemoteSyncMeta(meta) {
  localStorage.setItem(REMOTE_SYNC_META_KEY, JSON.stringify(meta));
}

function currentDataJson() {
  return JSON.stringify(appData, null, 2);
}

function setSyncUiBusy(busy) {
  syncInProgress = busy;
  [saveContentBtn, syncNowBtn, saveGithubConfigBtn].forEach(btn => {
    if (btn) btn.disabled = busy;
  });
}

function setQueuedSync(reason = 'auto') {
  queuedSyncReason = reason;
}

function clearQueuedSync() {
  queuedSyncReason = '';
}

function scheduleDeferredAutoSync(reason = 'auto') {
  if (!githubSyncConfig.autoSync) return;
  if (pendingSyncTimer) clearTimeout(pendingSyncTimer);
  pendingSyncTimer = setTimeout(async () => {
    pendingSyncTimer = null;
    try {
      await persistAppData(reason);
    } catch (error) {
      console.error(error);
      updateGithubSyncStatus('자동 반영 실패');
    }
  }, 1200);
}

function normalizeGithubErrorMessage(error) {
  const message = String(error?.message || error || '알 수 없는 오류');
  if (message.includes('401')) return '401 인증 오류입니다. 토큰이 잘못됐거나 앞뒤 공백이 들어갔습니다.';
  if (message.includes('403')) return '403 권한 오류입니다. 토큰에 Contents: Read and write 권한이 있는지 확인하세요.';
  if (message.includes('409')) return '409 충돌 오류입니다. 최신 파일 기준으로 다시 시도해 주세요.';
  if (message.includes('422')) return '422 요청 형식 오류입니다. Owner / Repository / Branch 값을 다시 확인하세요.';
  return message;
}

function updateLastSyncMeta(commitSha = '', commitUrl = '', message = '') {
  const meta = {
    at: new Date().toISOString(),
    commitSha,
    commitUrl,
    message
  };
  saveRemoteSyncMeta(meta);
  return meta;
}

function showSyncResultAlert(prefix, resultMeta) {
  const when = resultMeta?.at ? new Date(resultMeta.at).toLocaleString('ko-KR') : new Date().toLocaleString('ko-KR');
  alert(`${prefix}
마지막 반영 시각: ${when}`);
}

function getRemoteFetchUrl() {
  const path = `${REMOTE_DATA_PATH}?v=${Date.now()}`;
  if (window.location.protocol === 'file:') return path;
  return new URL(path, window.location.href).toString();
}

async function tryLoadRemoteData() {
  if (window.location.protocol === 'file:') return false;
  try {
    const response = await fetch(getRemoteFetchUrl(), { cache: 'no-store' });
    if (!response.ok) return false;
    const remoteText = await response.text();
    const remoteData = JSON.parse(remoteText);
    if (!remoteData?.menus?.length) return false;
    appData = normalizeLoadedData(remoteData);
    lastLoadedRemoteText = JSON.stringify(appData, null, 2);
    saveData();
    isRemoteDataLoaded = true;
    return true;
  } catch (error) {
    console.warn('원격 site-data.json 로드 실패:', error);
    return false;
  }
}

async function fetchGithubFileState(owner, repo, branch, path) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`, {
    headers: {
      Authorization: `Bearer ${githubSyncConfig.token}`,
      Accept: 'application/vnd.github+json'
    }
  });
  if (response.status === 404) return { sha: null, text: '', exists: false };
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`기존 파일 조회 실패: ${response.status} ${errorText}`);
  }
  const json = await response.json();
  let decoded = '';
  if (json.content) {
    try {
      decoded = decodeURIComponent(escape(atob(String(json.content).replace(/\n/g, ''))));
    } catch (_) {
      decoded = '';
    }
  }
  return {
    sha: json.sha || null,
    text: decoded,
    exists: true
  };
}

function utf8ToBase64(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function selectedMenuSafeName() {
  const selected = getSelectedMenu();
  return selected?.name || '전체 메뉴';
}

async function pushSiteDataToGithub(reason = 'auto', options = {}) {
  readGithubSyncForm();
  const { owner, repo, branch, token, autoSync } = githubSyncConfig;
  if (!owner || !repo || !branch || !token) {
    throw new Error('GitHub 연동 정보가 비어 있습니다. Owner / Repository / Branch / Token을 먼저 입력하세요.');
  }
  if (!autoSync && reason !== 'manual' && !options.force) return false;
  if (syncInProgress && !options.fromQueue) {
    setQueuedSync(reason);
    updateGithubSyncStatus('이전 반영 완료 후 재시도 예정');
    return 'queued';
  }

  const desiredJson = currentDataJson();
  setSyncUiBusy(true);
  updateGithubSyncStatus('GitHub 반영 중...');

  try {
    let remoteState = await fetchGithubFileState(owner, repo, branch, REMOTE_DATA_PATH);
    lastKnownRemoteSha = remoteState.sha;

    if (remoteState.text && remoteState.text === desiredJson) {
      const meta = updateLastSyncMeta('', '', '동일 내용');
      updateGithubSyncStatus('이미 최신 내용입니다');
      return { ok: true, skipped: true, meta };
    }

    const message = `[site-sync] ${selectedMenuSafeName()} - ${new Date().toLocaleString('ko-KR')}`;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${REMOTE_DATA_PATH}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          content: utf8ToBase64(desiredJson),
          branch,
          ...(remoteState.sha ? { sha: remoteState.sha } : {})
        })
      });

      if (response.ok) {
        const json = await response.json();
        const commitSha = json?.commit?.sha || '';
        const commitUrl = json?.commit?.html_url || '';
        lastKnownRemoteSha = json?.content?.sha || remoteState.sha || null;
        lastLoadedRemoteText = desiredJson;
        const meta = updateLastSyncMeta(commitSha, commitUrl, message);
        updateGithubSyncStatus('GitHub 반영 완료');
        return { ok: true, skipped: false, meta };
      }

      const errorText = await response.text();
      if (response.status === 409 && attempt < 3) {
        remoteState = await fetchGithubFileState(owner, repo, branch, REMOTE_DATA_PATH);
        lastKnownRemoteSha = remoteState.sha;
        continue;
      }
      throw new Error(`GitHub 반영 실패: ${response.status} ${errorText}`);
    }

    throw new Error('GitHub 반영 실패: 알 수 없는 충돌 상태입니다.');
  } finally {
    setSyncUiBusy(false);
    if (queuedSyncReason) {
      const nextReason = queuedSyncReason;
      clearQueuedSync();
      setTimeout(() => {
        pushSiteDataToGithub(nextReason, { fromQueue: true }).catch(error => {
          console.error(error);
          updateGithubSyncStatus('대기 중 반영 실패');
        });
      }, 200);
    }
  }
}

async function persistAppData(reason = '저장', options = {}) {
  saveData();
  if (!githubSyncConfig.autoSync && !options.force) return { ok: false, skipped: true, localOnly: true };
  return pushSiteDataToGithub(reason, options);
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
function applyEditorCommand(cmd, value = null) {
  contentTextInput.focus({ preventScroll: true });

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
async function saveCurrentContent() {
  const selected = getSelectedMenu();
  if (!selected) return;

  selected.contentTitle = contentTitleInput.value.trim();
  selected.contentHtml = getEditorHtml();
  selected.contentText = contentTextInput.innerText.replace(/ /g, ' ').trim();
  selected.attachments = structuredClone(pendingAttachments);

  try {
    const result = await persistAppData('내용 저장');
    renderAll();
    if (githubSyncConfig.autoSync) {
      showSyncResultAlert('저장 및 GitHub 반영이 완료되었습니다.', result?.meta);
    } else {
      alert('로컬 저장이 완료되었습니다. GitHub까지 자동 반영하려면 아래 연동 정보를 먼저 저장하세요.');
    }
  } catch (error) {
    console.error(error);
    saveData();
    renderAll();
    alert(`로컬 저장은 완료됐지만 GitHub 반영은 실패했습니다.
${normalizeGithubErrorMessage(error)}`);
  }
}
async function clearCurrentContent() {
  const selected = getSelectedMenu();
  if (!selected) return;
  const ok = confirm('현재 메뉴의 내용을 모두 삭제할까요?');
  if (!ok) return;
  selected.contentTitle = '';
  selected.contentText = '';
  selected.contentHtml = '';
  selected.attachments = [];
  pendingAttachments = [];
  try {
    await persistAppData('내용 삭제');
  } catch (error) {
    console.error(error);
    saveData();
    alert(`로컬 저장은 완료됐지만 GitHub 반영은 실패했습니다.
${normalizeGithubErrorMessage(error)}`);
  }
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
  if (!event.target.closest('.inline-media-wrap')) clearSelectedInlineMedia();
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
  });
  btn.addEventListener('click', () => {
    applyEditorCommand(btn.getAttribute('data-cmd'));
    saveEditorSelection();
  });
});
textColorPicker.addEventListener('mousedown', event => {
  saveEditorSelection();
  event.preventDefault();
});
textColorPicker.addEventListener('input', () => {
  saveEditorSelection();
});
applyTextColorBtn?.addEventListener('mousedown', event => {
  saveEditorSelection();
  event.preventDefault();
});
applyTextColorBtn?.addEventListener('click', () => {
  applyEditorCommand('foreColor', textColorPicker.value);
  saveEditorSelection();
});

searchInput.addEventListener('input', renderMenus);
saveGithubConfigBtn?.addEventListener('click', () => {
  readGithubSyncForm();
  updateGithubSyncStatus(githubSyncConfig.autoSync ? '자동 반영 준비 완료' : '연동 정보 저장됨');
  alert('GitHub 연동 정보가 저장되었습니다.');
});
githubAutoSyncCheckbox?.addEventListener('change', () => {
  readGithubSyncForm();
});
syncNowBtn?.addEventListener('click', async () => {
  try {
    const result = await pushSiteDataToGithub('manual', { force: true });
    showSyncResultAlert('현재 내용이 GitHub에 반영되었습니다. Pages 반영까지는 수 초~수 분 걸릴 수 있습니다.', result?.meta);
  } catch (error) {
    console.error(error);
    alert(`GitHub 반영 실패\n${error.message}`);
  }
});
if (attachmentInput) {
  attachmentInput.addEventListener('change', async event => {
    await handleAttachmentFiles(Array.from(event.target.files || []), { insertInline: true });
  });
}

fillGithubSyncForm();
const lastSyncMeta = loadRemoteSyncMeta();
if (lastSyncMeta?.at && githubSyncConfig.owner && githubSyncConfig.repo) {
  updateGithubSyncStatus(`마지막 반영 ${new Date(lastSyncMeta.at).toLocaleString('ko-KR')}`);
}

(async function initApp() {
  await tryLoadRemoteData();
  renderAll();
})();
