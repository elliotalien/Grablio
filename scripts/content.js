/**
 * Content Script to detect images on the current webpage.
 *
 * The injection guard is VERSIONED so that reloading the extension causes
 * re-injection (a new flag value) on already-open tabs, replacing any stale
 * listener that lacks newer message handlers. Bump GRABLIO_CS_VERSION when
 * the message protocol changes.
 */
var GRABLIO_CS_VERSION = 11;

if (!window.__grablioCSVersion || window.__grablioCSVersion < GRABLIO_CS_VERSION) {
  window.__grablioCSVersion = GRABLIO_CS_VERSION;

  // Remove any listeners registered by a previous (stale) version of this
  // script so we never end up with duplicated handlers after an upgrade.
  if (window.__grablioHandlers) {
    try { window.removeEventListener('scroll', window.__grablioHandlers.scroll); } catch (e) {}
    try { chrome.runtime.onMessage.removeListener(window.__grablioHandlers.message); } catch (e) {}
  }

  function getAllImages() {
    const images = new Set();

    // 1. Standard <img> tags and lazy-loaded images
    document.querySelectorAll('img').forEach(img => {
      if (img.src) images.add(img.src);
      if (img.srcset) {
        img.srcset.split(',').forEach(s => {
          const url = s.trim().split(' ')[0];
          if (url) {
            try { images.add(new URL(url, document.baseURI).href); } catch (e) {}
          }
        });
      }
      const lazyAttributes = ['data-src', 'data-original', 'data-lazy', 'data-lazy-src', 'data-zoom', 'data-high-res', 'data-fallback'];
      lazyAttributes.forEach(attr => {
        const val = img.getAttribute(attr);
        if (val) {
          try { images.add(new URL(val.trim(), document.baseURI).href); } catch (e) {}
        }
      });
    });

    // 2. <source> tags in <picture>
    document.querySelectorAll('picture source').forEach(source => {
      if (source.srcset) {
        source.srcset.split(',').forEach(s => {
          const url = s.trim().split(' ')[0];
          if (url) {
            try { images.add(new URL(url, document.baseURI).href); } catch (e) {}
          }
        });
      }
    });

    // 3. CSS Background Images
    // Extract every url() and every image-set() source from a CSS value.
    function collectCssImageUrls(cssValue) {
      const urls = [];
      if (!cssValue || cssValue === 'none') return urls;
      const urlRe = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
      let m;
      while ((m = urlRe.exec(cssValue)) !== null) {
        if (m[1]) urls.push(m[1]);
      }
      const setRe = /image-set\(([^)]*)\)/gi;
      while ((m = setRe.exec(cssValue)) !== null) {
        const strRe = /['"]([^'"]+)['"]/g;
        let s;
        while ((s = strRe.exec(m[1])) !== null) {
          if (/\.(jpg|jpeg|png|webp|gif|svg|avif|bmp|ico|tiff)/i.test(s[1])) urls.push(s[1]);
        }
      }
      return urls;
    }

    // Running getComputedStyle on every element of a large page is extremely
    // expensive and can freeze the tab. Most backgrounds are applied via a
    // class/id/inline-style, so we skip classless, id-less, unstyled elements
    // and cap the number of elements we actually inspect.
    const bgSkipTags = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'BR', 'HR', 'SVG', 'PATH', 'IMG', 'VIDEO', 'CANVAS', 'SOURCE']);
    const allEls = document.querySelectorAll('body *');
    const bgCandidates = [];
    for (const el of allEls) {
      if (bgSkipTags.has(el.tagName)) continue;
      const cls = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
      if (!cls && !el.id && !el.getAttribute('style')) continue;
      bgCandidates.push(el);
    }
    const MAX_BG_SCAN = 2500;
    for (let i = 0; i < bgCandidates.length && i < MAX_BG_SCAN; i++) {
      const el = bgCandidates[i];
      let bg;
      try { bg = window.getComputedStyle(el).backgroundImage; } catch (e) { continue; }
      if (bg && bg !== 'none') {
        collectCssImageUrls(bg).forEach(u => {
          try { images.add(new URL(u, document.baseURI).href); } catch (e) {}
        });
      }
    }

    // 4. Links to images
    document.querySelectorAll('a').forEach(a => {
      const href = a.href;
      if (href && /\.(jpg|jpeg|png|webp|gif|svg|avif|bmp|ico|tiff)(?:[?#].*)?$/i.test(href)) {
        images.add(href);
      }
    });

    // 5. <link rel="image_src"> and OpenGraph image
    document.querySelectorAll('link[rel="image_src"], meta[property="og:image"], meta[property="og:image:url"], meta[property="og:image:secure_url"], meta[itemprop="image"]').forEach(el => {
      const c = el.getAttribute('href') || el.getAttribute('content');
      if (c) {
        try { images.add(new URL(c, document.baseURI).href); } catch (e) {}
      }
    });

    return Array.from(images).filter(url => {
      return url.startsWith('http') || url.startsWith('https') || url.startsWith('data:image/');
    });
  }

  // Throttled scroll listener for infinite scroll
  let scrollTimeout;
  function grablioScrollHandler() {
    if (scrollTimeout) return;
    scrollTimeout = setTimeout(() => {
      scrollTimeout = null;
      const threshold = 150;
      const totalHeight = document.documentElement.scrollHeight;
      const scrollPosition = window.innerHeight + window.scrollY;
      if (scrollPosition >= totalHeight - threshold) {
        try {
          const currentImages = getAllImages();
          chrome.storage.local.get(['sessionModeActive', 'sessionSavedImages'], (result) => {
            if (chrome.runtime.lastError) return;
            if (result && result.sessionModeActive) {
              const existing = result.sessionSavedImages || [];
              const merged = Array.from(new Set([...existing, ...currentImages]));
              chrome.storage.local.set({ sessionSavedImages: merged });
            }
          });
          chrome.runtime.sendMessage({ action: 'IMAGES_UPDATED', images: currentImages }).catch(() => {});
        } catch (e) {}
      }
    }, 400);
  }

  // Listen for messages from the popup
  function grablioMessageHandler(request, sender, sendResponse) {
    if (request.action === 'GET_IMAGES') {
      const imageList = getAllImages();
      sendResponse({ images: imageList });
      return true;
    } else if (request.action === 'SCROLL_WEBPAGE') {
      window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
      setTimeout(() => {
        try {
          const updatedImages = getAllImages();
          chrome.storage.local.get(['sessionModeActive', 'sessionSavedImages'], (result) => {
            if (chrome.runtime.lastError) return;
            if (result && result.sessionModeActive) {
              const existing = result.sessionSavedImages || [];
              const merged = Array.from(new Set([...existing, ...updatedImages]));
              chrome.storage.local.set({ sessionSavedImages: merged });
            }
          });
          sendResponse({ images: updatedImages });
        } catch (e) {
          sendResponse({ images: [] });
        }
      }, 700);
      return true;
    }
    return true;
  }

  // Session mode bootstrap on page load/navigation
  try {
    chrome.storage.local.get(['sessionModeActive', 'sessionSavedImages'], (result) => {
      if (chrome.runtime.lastError) return;
      if (result && result.sessionModeActive) {
        const pageImages = getAllImages();
        const existing = result.sessionSavedImages || [];
        const merged = Array.from(new Set([...existing, ...pageImages]));
        chrome.storage.local.set({ sessionSavedImages: merged });
      }
    });
  } catch (e) {}

  window.addEventListener('scroll', grablioScrollHandler);
  chrome.runtime.onMessage.addListener(grablioMessageHandler);
  window.__grablioHandlers = { scroll: grablioScrollHandler, message: grablioMessageHandler };
}
