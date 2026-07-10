/**
 * Popup Logic for Grablio
 * Image-only browser extension. Detects images on the current page and
 * downloads selected images as a ZIP file.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const imageCountEl = document.getElementById('image-count');
  const statusTextEl = document.getElementById('status-text');
  const downloadBtn = document.getElementById('download-btn');
  const downloadBtnLabel = document.getElementById('download-btn-label');
  const imageGrid = document.getElementById('image-grid');
  const loadingOverlay = document.getElementById('loading');
  const progressBar = document.getElementById('progress-bar');
  const loadingText = document.getElementById('loading-text');
  const selectedCountEl = document.getElementById('selected-count');
  const selectAllBtn = document.getElementById('select-all-btn');
  const unselectAllBtn = document.getElementById('unselect-all-btn');

  // Settings DOM Elements
  const settingsToggleBtn = document.getElementById('settings-toggle');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsCloseBtn = document.getElementById('settings-close');
  const themePresetButtons = document.querySelectorAll('.theme-preset-btn');
  const accentColorPicker = document.getElementById('accent-color-picker');
  const accentColorVal = document.getElementById('accent-color-val');
  const radiusSlider = document.getElementById('radius-slider');
  const radiusVal = document.getElementById('radius-val');
  const fontSelector = document.getElementById('font-selector');
  const fontDropdown = document.getElementById('font-dropdown');
  const fontMenu = document.getElementById('font-menu');
  const fontOptions = fontMenu ? Array.from(fontMenu.querySelectorAll('.dropdown-option')) : [];
  const settingsResetBtn = document.getElementById('settings-reset');

  // Session Mode DOM Elements
  const sessionModeToggle = document.getElementById('session-mode-toggle');
  const clearSessionBtn = document.getElementById('clear-session-btn');
  const sessionBadge = document.getElementById('session-badge');

  // 1. Get current tab early to prevent lifecycle crashes in event listeners
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    if (statusTextEl) {
      statusTextEl.textContent = 'Error: No active tab';
      statusTextEl.classList.add('error');
    }
    return;
  }

  // Send a message with a timeout. Prevents the popup from hanging forever
  // if the receiver (e.g. a stale content script on an already-open tab)
  // never calls sendResponse.
  function sendMessageWithTimeout(sendFn, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, timeoutMs);
      try {
        Promise.resolve(sendFn()).then(
          (resp) => { clearTimeout(timer); resolve(resp); },
          (err) => { clearTimeout(timer); reject(err); }
        );
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  let foundImages = [];
  let selectedImages = new Set();
  let imageElementsMap = new Map();
  let downloadingActive = false;

  // --- Dynamic Theme Customization System ---

  const THEME_PRESETS = {
    indigo: {
      '--primary': '#6366f1',
      '--primary-hover': '#4f46e5',
      '--bg': '#0d0d10',
      '--bg-1': '#15151a',
      '--card-bg': 'rgba(24, 24, 28, 0.66)',
      '--surface-raised': 'rgba(255, 255, 255, 0.05)',
      '--surface-sunken': 'rgba(0, 0, 0, 0.22)',
      '--text-main': '#f4f4f5',
      '--text-muted': '#8a8a93',
      '--text-faint': '#63636d',
      '--border': 'rgba(255, 255, 255, 0.07)',
      '--border-strong': 'rgba(255, 255, 255, 0.14)',
      '--glass-border': 'rgba(255, 255, 255, 0.14)'
    },
    dark: {
      '--primary': '#8b5cf6',
      '--primary-hover': '#7c3aed',
      '--bg': '#111114',
      '--bg-1': '#191920',
      '--card-bg': 'rgba(26, 26, 30, 0.66)',
      '--surface-raised': 'rgba(255, 255, 255, 0.05)',
      '--surface-sunken': 'rgba(0, 0, 0, 0.22)',
      '--text-main': '#f3f3f5',
      '--text-muted': '#8b8b94',
      '--text-faint': '#66666f',
      '--border': 'rgba(255, 255, 255, 0.07)',
      '--border-strong': 'rgba(255, 255, 255, 0.14)',
      '--glass-border': 'rgba(255, 255, 255, 0.14)'
    },
    cyber: {
      '--primary': '#0a0a0a',
      '--primary-hover': '#000000',
      '--bg': '#ffffff',
      '--bg-1': '#f7f7f8',
      '--card-bg': 'rgba(250, 250, 250, 0.85)',
      '--surface-raised': 'rgba(0, 0, 0, 0.035)',
      '--surface-sunken': 'rgba(0, 0, 0, 0.05)',
      '--text-main': '#0a0a0a',
      '--text-muted': '#737373',
      '--text-faint': '#a3a3a3',
      '--border': 'rgba(10, 10, 10, 0.10)',
      '--border-strong': 'rgba(10, 10, 10, 0.16)',
      '--glass-border': 'rgba(10, 10, 10, 0.10)'
    },
    forest: {
      '--primary': '#34d399',
      '--primary-hover': '#10b981',
      '--bg': '#0e100f',
      '--bg-1': '#161917',
      '--card-bg': 'rgba(23, 26, 25, 0.68)',
      '--surface-raised': 'rgba(255, 255, 255, 0.05)',
      '--surface-sunken': 'rgba(0, 0, 0, 0.22)',
      '--text-main': '#e8eae9',
      '--text-muted': '#899089',
      '--text-faint': '#636b65',
      '--border': 'rgba(255, 255, 255, 0.06)',
      '--border-strong': 'rgba(255, 255, 255, 0.13)',
      '--glass-border': 'rgba(255, 255, 255, 0.13)'
    },
    rose: {
      '--primary': '#f43f5e',
      '--primary-hover': '#e11d48',
      '--bg': '#fbf9f8',
      '--bg-1': '#f4f1f0',
      '--card-bg': 'rgba(255, 255, 255, 0.84)',
      '--surface-raised': 'rgba(28, 25, 23, 0.035)',
      '--surface-sunken': 'rgba(28, 25, 23, 0.05)',
      '--text-main': '#1c1917',
      '--text-muted': '#78716c',
      '--text-faint': '#a8a29e',
      '--border': 'rgba(28, 25, 23, 0.10)',
      '--border-strong': 'rgba(28, 25, 23, 0.16)',
      '--glass-border': 'rgba(28, 25, 23, 0.10)'
    },
    glass: {
      '--primary': '#38bdf8',
      '--primary-hover': '#0ea5e9',
      '--bg': '#0a1420',
      '--bg-1': 'rgba(255, 255, 255, 0.06)',
      '--card-bg': 'rgba(255, 255, 255, 0.10)',
      '--surface-raised': 'rgba(255, 255, 255, 0.10)',
      '--surface-sunken': 'rgba(255, 255, 255, 0.04)',
      '--text-main': '#f4f9ff',
      '--text-muted': '#aec4d8',
      '--text-faint': '#7c93a8',
      '--border': 'rgba(255, 255, 255, 0.16)',
      '--border-strong': 'rgba(255, 255, 255, 0.26)',
      '--glass-border': 'rgba(255, 255, 255, 0.30)'
    }
  };

  const FONT_OPTIONS = {
    inter: "'Plus Jakarta Sans', sans-serif",
    outfit: "'Outfit', sans-serif",
    playfair: "'Space Grotesk', sans-serif",
    mono: "'JetBrains Mono', monospace",
    system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  };

  const FONT_LABELS = {
    inter: 'Plus Jakarta Sans',
    outfit: 'Outfit',
    playfair: 'Space Grotesk',
    mono: 'JetBrains Mono',
    system: 'System Default'
  };

  const STORAGE_KEYS = {
    theme: 'grablio_theme',
    accent: 'grablio_accent',
    radius: 'grablio_radius',
    font: 'grablio_font',
    session: 'sessionModeActive',
    sessionImages: 'sessionSavedImages',
    scrollPrefix: 'scroll_pos_'
  };

  const DEFAULT_SETTINGS = {
    theme: 'indigo',
    accent: '#6366f1',
    radius: 18,
    font: 'inter'
  };

  function applyTheme(themeName) {
    const preset = THEME_PRESETS[themeName] || THEME_PRESETS.indigo;
    const root = document.documentElement;
    Object.entries(preset).forEach(([key, value]) => root.style.setProperty(key, value));
  }

  function applyAccent(hex) {
    document.documentElement.style.setProperty('--primary', hex);
  }

  function applyRadius(px) {
    // The slider drives the locked radius scale proportionally.
    // --radius-pill stays fixed at 999px (defined in CSS) so pills never warp.
    const clamped = Math.max(0, Math.min(24, parseInt(px, 10) || 0));
    const root = document.documentElement;
    root.style.setProperty('--radius-xs', `${Math.round(clamped * 0.5)}px`);
    root.style.setProperty('--radius-sm', `${Math.round(clamped * 0.7)}px`);
    root.style.setProperty('--radius-md', `${clamped}px`);
    root.style.setProperty('--radius-lg', `${Math.round(clamped * 1.22)}px`);
  }

  function applyFont(fontKey) {
    const family = FONT_OPTIONS[fontKey] || FONT_OPTIONS.inter;
    document.documentElement.style.setProperty('--font-family', family);
    document.documentElement.style.setProperty('--font-sans', family);
    document.body.style.fontFamily = family;
  }

  function setActiveThemeButton(themeName) {
    themePresetButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === themeName);
    });
  }

  function setActiveFontOption(fontKey) {
    fontOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.value === fontKey);
      opt.setAttribute('aria-selected', opt.dataset.value === fontKey ? 'true' : 'false');
    });
    const valueLabel = document.querySelector('#font-selector .dropdown-value');
    if (valueLabel) valueLabel.textContent = FONT_LABELS[fontKey] || FONT_LABELS.inter;
  }

  function loadSettings() {
    chrome.storage.local.get([STORAGE_KEYS.theme, STORAGE_KEYS.accent, STORAGE_KEYS.radius, STORAGE_KEYS.font], (result) => {
      const theme = result[STORAGE_KEYS.theme] || DEFAULT_SETTINGS.theme;
      const accent = result[STORAGE_KEYS.accent] || DEFAULT_SETTINGS.accent;
      const radius = result[STORAGE_KEYS.radius] != null ? result[STORAGE_KEYS.radius] : DEFAULT_SETTINGS.radius;
      const font = result[STORAGE_KEYS.font] || DEFAULT_SETTINGS.font;

      applyTheme(theme);
      applyAccent(accent);
      applyRadius(radius);
      applyFont(font);

      setActiveThemeButton(theme);
      setActiveFontOption(font);
      if (accentColorPicker) accentColorPicker.value = accent;
      if (accentColorVal) accentColorVal.textContent = accent;
      if (radiusSlider) radiusSlider.value = radius;
      if (radiusVal) radiusVal.textContent = `${radius}px`;
    });
  }

  themePresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      applyTheme(theme);
      setActiveThemeButton(theme);
      chrome.storage.local.set({ [STORAGE_KEYS.theme]: theme });
    });
  });

  if (accentColorPicker) {
    accentColorPicker.addEventListener('input', (e) => {
      const hex = e.target.value;
      applyAccent(hex);
      if (accentColorVal) accentColorVal.textContent = hex;
      chrome.storage.local.set({ [STORAGE_KEYS.accent]: hex });
    });
  }

  if (radiusSlider) {
    radiusSlider.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      applyRadius(v);
      if (radiusVal) radiusVal.textContent = `${v}px`;
      chrome.storage.local.set({ [STORAGE_KEYS.radius]: v });
    });
  }

  if (fontSelector) {
    fontSelector.addEventListener('click', (e) => {
      e.stopPropagation();
      const expanded = fontDropdown.classList.toggle('open');
      fontSelector.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  document.addEventListener('click', (e) => {
    if (fontDropdown && !fontDropdown.contains(e.target)) {
      fontDropdown.classList.remove('open');
      if (fontSelector) fontSelector.setAttribute('aria-expanded', 'false');
    }
  });

  fontOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      const fontKey = opt.dataset.value;
      applyFont(fontKey);
      setActiveFontOption(fontKey);
      if (fontDropdown) fontDropdown.classList.remove('open');
      if (fontSelector) fontSelector.setAttribute('aria-expanded', 'false');
      chrome.storage.local.set({ [STORAGE_KEYS.font]: fontKey });
    });
  });

  if (settingsResetBtn) {
    settingsResetBtn.addEventListener('click', () => {
      chrome.storage.local.remove([STORAGE_KEYS.theme, STORAGE_KEYS.accent, STORAGE_KEYS.radius, STORAGE_KEYS.font], () => {
        applyTheme(DEFAULT_SETTINGS.theme);
        applyAccent(DEFAULT_SETTINGS.accent);
        applyRadius(DEFAULT_SETTINGS.radius);
        applyFont(DEFAULT_SETTINGS.font);
        setActiveThemeButton(DEFAULT_SETTINGS.theme);
        setActiveFontOption(DEFAULT_SETTINGS.font);
        if (accentColorPicker) accentColorPicker.value = DEFAULT_SETTINGS.accent;
        if (accentColorVal) accentColorVal.textContent = DEFAULT_SETTINGS.accent;
        if (radiusSlider) radiusSlider.value = DEFAULT_SETTINGS.radius;
        if (radiusVal) radiusVal.textContent = `${DEFAULT_SETTINGS.radius}px`;
      });
    });
  }

  if (settingsToggleBtn) {
    settingsToggleBtn.addEventListener('click', () => {
      settingsPanel.classList.remove('hidden');
    });
  }
  if (settingsCloseBtn) {
    settingsCloseBtn.addEventListener('click', () => {
      settingsPanel.classList.add('hidden');
    });
  }
  if (settingsPanel) {
    settingsPanel.addEventListener('click', (e) => {
      if (e.target === settingsPanel) settingsPanel.classList.add('hidden');
    });
  }

  loadSettings();

  // --- Session Mode ---

  function setSessionBadge(active) {
    if (!sessionBadge) return;
    sessionBadge.classList.toggle('hidden', !active);
  }

  if (sessionModeToggle) {
    sessionModeToggle.addEventListener('change', () => {
      const active = sessionModeToggle.checked;
      chrome.storage.local.set({ [STORAGE_KEYS.session]: active }, () => {
        if (active) {
          setSessionBadge(true);
          if (clearSessionBtn) clearSessionBtn.classList.remove('hidden');
          statusTextEl.textContent = 'Multi-page session enabled!';
          statusTextEl.classList.add('success');
          setTimeout(() => {
            statusTextEl.textContent = 'Ready';
            statusTextEl.classList.remove('success');
          }, 1500);
        } else {
          setSessionBadge(false);
          if (clearSessionBtn) clearSessionBtn.classList.add('hidden');
          refreshFromTab();
          statusTextEl.textContent = 'Multi-page session disabled';
          setTimeout(() => { statusTextEl.textContent = 'Ready'; }, 1500);
        }
      });
    });
  }

  if (clearSessionBtn) {
    clearSessionBtn.addEventListener('click', () => {
      chrome.storage.local.set({ [STORAGE_KEYS.sessionImages]: [] }, () => {
        statusTextEl.textContent = 'Session cleared!';
        statusTextEl.classList.add('success');
        setTimeout(() => {
          statusTextEl.textContent = 'Ready';
          statusTextEl.classList.remove('success');
        }, 1500);
        refreshFromTab();
      });
    });
  }

  // Dynamic browser/version detection for the footer
  const footerTextEl = document.getElementById('footer-text');
  if (footerTextEl) {
    const manifest = chrome.runtime.getManifest();
    const version = manifest.version || '1.0';

    let browserName = 'Browser';
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Edg/')) browserName = 'Edge';
    else if (userAgent.includes('OPR/') || userAgent.includes('Opera')) browserName = 'Opera';
    else if (userAgent.includes('Firefox/')) browserName = 'Firefox';
    else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) browserName = 'Safari';
    else if (userAgent.includes('Chrome')) {
      // Chromium-based — check if it's actually Brave via the official API.
      if (navigator.brave && typeof navigator.brave.isBrave === 'function') {
        navigator.brave.isBrave().then(isBrave => {
          footerTextEl.textContent = `${isBrave ? 'Brave' : 'Chrome'} Extension • v${version}`;
        });
      } else {
        browserName = 'Chrome';
      }
    }

    footerTextEl.textContent = `${browserName} Extension • v${version}`;
  }

  // --- Initial image scan ---

  async function refreshFromTab() {
    if (!tab) return;
    statusTextEl.textContent = 'Scanning…';
    statusTextEl.classList.remove('error', 'success');
    try {
      const response = await sendMessageWithTimeout(
        () => chrome.tabs.sendMessage(tab.id, { action: 'GET_IMAGES' }),
        4000
      );
      if (response && response.images) {
        foundImages = response.images;
        updateUI();
      } else {
        statusTextEl.textContent = 'No response from page';
        foundImages = [];
        updateUI();
      }
    } catch (e) {
      statusTextEl.textContent = 'Scan timed out';
      statusTextEl.classList.add('error');
    }
  }

  async function initializeImages() {
    let result = {};
    try {
      result = await chrome.storage.local.get([STORAGE_KEYS.session, STORAGE_KEYS.sessionImages]);
    } catch (e) { /* storage unavailable; continue with defaults */ }

    try {
      const isSessionActive = !!result[STORAGE_KEYS.session];
      if (sessionModeToggle) sessionModeToggle.checked = isSessionActive;
      if (clearSessionBtn) clearSessionBtn.classList.toggle('hidden', !isSessionActive);
      setSessionBadge(isSessionActive);

      let currentImages = [];
      try {
        const response = await sendMessageWithTimeout(
          () => chrome.tabs.sendMessage(tab.id, { action: 'GET_IMAGES' })
        );
        if (response && response.images) currentImages = response.images;
      } catch (error) {
        // Content script might not be loaded yet — force re-inject and retry
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['scripts/content.js']
          });
          const response = await sendMessageWithTimeout(
            () => chrome.tabs.sendMessage(tab.id, { action: 'GET_IMAGES' })
          );
          if (response && response.images) currentImages = response.images;
        } catch (innerError) {
          console.error('Failed to get images:', innerError);
        }
      }

      if (isSessionActive) {
        const existing = result[STORAGE_KEYS.sessionImages] || [];
        const merged = Array.from(new Set([...existing, ...currentImages]));
        chrome.storage.local.set({ [STORAGE_KEYS.sessionImages]: merged });
        foundImages = merged;
      } else {
        foundImages = currentImages;
      }

      updateUI();
      restoreScrollPosition();
    } catch (err) {
      console.error('initializeImages failed:', err);
      try {
        statusTextEl.textContent = 'Error: Reload page';
        statusTextEl.classList.add('error');
        foundImages = [];
        updateUI();
      } catch (e) {}
    }
  }

  await initializeImages();

  // --- UI Update Logic ---

  function renderImageCard(url) {
    const container = document.createElement('div');
    container.className = 'img-container selected';
    container.dataset.url = url;

    const img = document.createElement('img');
    img.src = url;
    img.loading = 'lazy';
    img.alt = '';
    img.onerror = () => {
      container.style.opacity = '0.35';
      const badge = document.createElement('div');
      badge.className = 'img-error-flag';
      badge.textContent = '?';
      badge.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.2rem;color:var(--text-muted);pointer-events:none;';
      container.appendChild(badge);
    };
    container.appendChild(img);

    const checkbox = document.createElement('div');
    checkbox.className = 'checkbox-overlay';
    checkbox.setAttribute('aria-hidden', 'true');
    checkbox.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    container.appendChild(checkbox);

    imageGrid.appendChild(container);
    imageElementsMap.set(url, container);

    container.addEventListener('click', () => {
      if (downloadingActive) return;
      if (selectedImages.has(url)) {
        selectedImages.delete(url);
        container.classList.remove('selected');
      } else {
        selectedImages.add(url);
        container.classList.add('selected');
      }
      updateSelectedCount();
    });
  }

  function updateUI() {
    const total = foundImages.length;
    imageCountEl.textContent = total;
    statusTextEl.textContent = 'Ready';
    statusTextEl.classList.remove('error', 'success');

    selectedImages.clear();
    foundImages.forEach(url => selectedImages.add(url));

    updateSelectedCount();

    imageGrid.innerHTML = '';
    imageElementsMap.clear();

    if (total === 0) {
      imageGrid.innerHTML = `
        <div class="gallery-empty">
          <div class="gallery-empty-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
          </div>
          <p class="gallery-empty-title">No images found</p>
          <p class="gallery-empty-sub">Try scrolling the page or click Rescan to look again.</p>
          <button id="rescan-btn" class="text-link-btn gallery-empty-action">Rescan</button>
        </div>
      `;
      const rescan = document.getElementById('rescan-btn');
      if (rescan) rescan.addEventListener('click', () => refreshFromTab());
      return;
    }

    foundImages.forEach(url => renderImageCard(url));
  }

  function appendNewImages(newImages) {
    const toAppend = (newImages || []).filter(url => !foundImages.includes(url));
    if (toAppend.length === 0) return;

    const emptyMsg = imageGrid.querySelector('.gallery-empty');
    if (emptyMsg) imageGrid.innerHTML = '';

    foundImages.push(...toAppend);

    chrome.storage.local.get([STORAGE_KEYS.session, STORAGE_KEYS.sessionImages], (result) => {
      if (result && result[STORAGE_KEYS.session]) {
        const existing = result[STORAGE_KEYS.sessionImages] || [];
        const merged = Array.from(new Set([...existing, ...toAppend]));
        chrome.storage.local.set({ [STORAGE_KEYS.sessionImages]: merged });
      }
    });

    imageCountEl.textContent = foundImages.length;
    toAppend.forEach(url => {
      selectedImages.add(url);
      renderImageCard(url);
      const c = imageElementsMap.get(url);
      if (c) c.style.animation = 'scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both';
    });

    updateSelectedCount();

    statusTextEl.textContent = `Found ${toAppend.length} new image${toAppend.length > 1 ? 's' : ''}!`;
    statusTextEl.classList.add('success');
    setTimeout(() => {
      if (statusTextEl.textContent.startsWith('Found')) {
        statusTextEl.textContent = 'Ready';
        statusTextEl.classList.remove('success');
      }
    }, 2000);
  }

  function restoreScrollPosition() {
    if (!tab) return;
    const storageKey = STORAGE_KEYS.scrollPrefix + (tab.url || tab.id);
    chrome.storage.local.get([storageKey], (result) => {
      const saved = result[storageKey];
      if (saved !== undefined && saved > 0) {
        setTimeout(() => {
          const mainEl = document.querySelector('main');
          if (mainEl) mainEl.scrollTop = saved;
        }, 100);
      }
    });
  }

  function updateSelectedCount() {
    const count = selectedImages.size;
    selectedCountEl.textContent = `${count} of ${foundImages.length} selected`;
    downloadBtn.disabled = count === 0 || downloadingActive;

    if (!downloadingActive) {
      selectAllBtn.disabled = count === foundImages.length || foundImages.length === 0;
      unselectAllBtn.disabled = count === 0;
    }

    if (downloadBtnLabel) {
      downloadBtnLabel.textContent = count > 0
        ? `Download ${count} image${count > 1 ? 's' : ''} as ZIP`
        : 'Download as ZIP';
    }
  }

  selectAllBtn.addEventListener('click', () => {
    if (downloadingActive) return;
    foundImages.forEach(url => {
      selectedImages.add(url);
      const c = imageElementsMap.get(url);
      if (c) c.classList.add('selected');
    });
    updateSelectedCount();
  });

  unselectAllBtn.addEventListener('click', () => {
    if (downloadingActive) return;
    selectedImages.clear();
    foundImages.forEach(url => {
      const c = imageElementsMap.get(url);
      if (c) c.classList.remove('selected');
    });
    updateSelectedCount();
  });

  // --- Scroll bridge to the host webpage ---

  const mainEl = document.querySelector('main');
  const backToTopBtn = document.getElementById('back-to-top');
  let isScrollingWebpage = false;
  let scrollSaveTimeout;

  mainEl.addEventListener('scroll', () => {
    if (tab && !downloadingActive) {
      clearTimeout(scrollSaveTimeout);
      scrollSaveTimeout = setTimeout(() => {
        const storageKey = STORAGE_KEYS.scrollPrefix + (tab.url || tab.id);
        chrome.storage.local.set({ [storageKey]: mainEl.scrollTop });
      }, 150);
    }

    if (backToTopBtn) {
      if (mainEl.scrollTop > 220) {
        backToTopBtn.classList.remove('hidden');
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    }

    const threshold = 20;
    if (mainEl.scrollTop + mainEl.clientHeight >= mainEl.scrollHeight - threshold) {
      if (isScrollingWebpage || downloadingActive || foundImages.length === 0) return;
      isScrollingWebpage = true;
      statusTextEl.textContent = 'Loading more from website…';

      chrome.tabs.sendMessage(tab.id, { action: 'SCROLL_WEBPAGE' }, (response) => {
        isScrollingWebpage = false;
        if (chrome.runtime.lastError) {
          statusTextEl.textContent = 'Ready';
          return;
        }
        if (response && response.images && response.images.length > 0) {
          const prev = foundImages.length;
          appendNewImages(response.images);
          if (foundImages.length === prev) {
            statusTextEl.textContent = 'No new images found';
            setTimeout(() => {
              if (statusTextEl.textContent === 'No new images found') statusTextEl.textContent = 'Ready';
            }, 1800);
          }
        } else {
          statusTextEl.textContent = 'Ready';
        }
      });
    }
  });

  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' });
      backToTopBtn.classList.remove('visible');
    });
  }

  // Listen for automatic scroll updates from the content script
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'IMAGES_UPDATED' && request.images) {
      appendNewImages(request.images);
    }
  });

  // --- ZIP Download Logic ---

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'tiff'];

  downloadBtn.addEventListener('click', async () => {
    if (selectedImages.size === 0 || downloadingActive) return;

    downloadingActive = true;
    selectAllBtn.disabled = true;
    unselectAllBtn.disabled = true;
    downloadBtn.disabled = true;
    loadingOverlay.classList.remove('hidden');

    const targets = Array.from(selectedImages);

    function setStatus(text, kind) {
      statusTextEl.textContent = text;
      statusTextEl.classList.toggle('success', kind === 'success');
      statusTextEl.classList.toggle('error', kind === 'error');
      setTimeout(() => {
        if (statusTextEl.textContent === text) {
          statusTextEl.textContent = 'Ready';
          statusTextEl.classList.remove('success', 'error');
        }
      }, 4000);
    }

    const zip = new JSZip();
    const folder = zip.folder('images');
    let downloadedCount = 0;
    let failedCount = 0;
    let completedCount = 0;
    let targetIndex = 0;
    const CONCURRENCY_LIMIT = 5;
    progressBar.style.width = '0%';

    function makeName(url, i) {
      if (url.startsWith('data:')) {
        const mime = (url.match(/^data:image\/([a-zA-Z0-9.+-]+)/) || [])[1] || 'jpeg';
        const alias = { 'jpeg': 'jpg', 'svg+xml': 'svg' };
        let ext = alias[mime] || mime.replace(/^x-/, '');
        if (!imageExts.includes(ext)) ext = 'jpg';
        return `image_${i + 1}.${ext}`;
      }
      let filename = url.split('/').pop().split('?')[0] || '';
      try { filename = decodeURIComponent(filename); } catch (e) {}
      filename = filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
      const lastDot = filename.lastIndexOf('.');
      let ext = '';
      let base = filename;
      if (lastDot !== -1) {
        ext = filename.substring(lastDot + 1).toLowerCase();
        base = filename.substring(0, lastDot);
      }
      if (!ext || !imageExts.includes(ext) || ext.length > 5) {
        ext = 'jpg';
        base = filename || 'image';
      }
      base = base.trim() || 'image';
      if (base.length > 60) base = base.substring(0, 60);
      return `${base}_${i + 1}.${ext}`;
    }

    async function fetchBlob(url) {
      if (url.startsWith('data:') || /^blob:/i.test(url)) {
        return await (await fetch(url)).blob();
      }
      const resp = await fetch(url, { credentials: 'omit' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const blob = await resp.blob();
      if (!blob || blob.size === 0) throw new Error('Empty blob');
      return blob;
    }

    async function downloadWorker() {
      while (true) {
        const i = targetIndex++;
        if (i >= targets.length) break;
        const url = targets[i];
        try {
          const blob = await fetchBlob(url);
          folder.file(makeName(url, i), blob);
          downloadedCount++;
        } catch (err) {
          failedCount++;
          console.error(`Failed to download ${url}:`, err);
        }
        completedCount++;
        loadingText.textContent = `Downloading ${completedCount} of ${targets.length}…`;
        progressBar.style.width = `${(completedCount / targets.length) * 100}%`;
      }
    }

    const workers = [];
    const numWorkers = Math.min(CONCURRENCY_LIMIT, targets.length);
    for (let w = 0; w < numWorkers; w++) workers.push(downloadWorker());
    await Promise.all(workers);

    const total = targets.length;
    if (downloadedCount > 0) {
      loadingText.textContent = 'Generating ZIP file…';
      const content = await zip.generateAsync({ type: 'blob' });
      const blobUrl = URL.createObjectURL(content);
      chrome.downloads.download({
        url: blobUrl,
        filename: `grablio_images_${new Date().getTime()}.zip`,
        saveAs: true
      }, (downloadId) => {
        const err = chrome.runtime.lastError;
        if (err || downloadId === undefined) {
          const msg = (err && err.message) || '';
          if (/canceled|cancelled|user_canceled/i.test(msg)) {
            setStatus('Download canceled', null);
          } else {
            setStatus('Download failed', 'error');
          }
        } else if (failedCount > 0) {
          setStatus(`Saved ${downloadedCount}, ${failedCount} failed`, 'success');
        } else {
          setStatus('Downloaded!', 'success');
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
      });
    } else {
      const msg = total > 0 ? `All ${total} failed (blocked or CORS)` : 'No images to download';
      setStatus(msg, 'error');
    }

    loadingOverlay.classList.add('hidden');
    downloadingActive = false;
    updateSelectedCount();
  });

  // Expose a tiny debug surface
  window.__grablio = { refresh: refreshFromTab, get state() { return { foundImages, selectedImages: [...selectedImages] }; } };
});
