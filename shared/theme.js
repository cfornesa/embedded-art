(() => {
  const STORAGE_KEY = 'eap-theme';
  const root = document.documentElement;

  const readStoredTheme = () => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }
  };

  const getTheme = () => (readStoredTheme() === 'light' ? 'light' : 'dark');

  const setTheme = (theme) => {
    const next = theme === 'light' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (err) {
      // Ignore storage errors (e.g. private mode).
    }
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
      toggle.textContent = next === 'dark' ? 'Light theme' : 'Dark theme';
      toggle.setAttribute('aria-pressed', String(next === 'light'));
    }
  };

  const ensureToggle = () => {
    let toggle = document.getElementById('themeToggle');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.id = 'themeToggle';
      toggle.className = 'theme-toggle';
      toggle.setAttribute('aria-label', 'Toggle light and dark theme');
      document.body.appendChild(toggle);
    }

    toggle.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      setTheme(current === 'dark' ? 'light' : 'dark');
    });

    setTheme(getTheme());
  };

  const setLayoutMetrics = () => {
    const header = document.querySelector('.site-header');
    const footer = document.querySelector('.site-footer');
    const headerHeight = header ? header.offsetHeight : 0;
    const footerHeight = footer ? footer.offsetHeight : 0;
    root.style.setProperty('--header-height', `${headerHeight}px`);
    root.style.setProperty('--footer-height', `${footerHeight}px`);
    window.dispatchEvent(new Event('eap:layout'));
  };

  const setActiveNavLink = () => {
    const links = document.querySelectorAll('.site-nav a');
    if (!links.length) return;
    const path = window.location.pathname;

    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;
      let hrefPath = '';
      try {
        hrefPath = new URL(href, window.location.origin).pathname;
      } catch (err) {
        hrefPath = href;
      }
      const basePath = hrefPath.replace(/builder\.html$/, '');
      const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
      const isActive = path === hrefPath || path.startsWith(basePath) || path === normalizedBase;

      if (isActive) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('is-active');
        link.removeAttribute('aria-current');
      }
    });
  };

  const setCurrentYear = () => {
    const year = String(new Date().getFullYear());
    document.querySelectorAll('.js-current-year').forEach((el) => {
      el.textContent = year;
    });
  };

  // Apply stored theme early to reduce flashes.
  setTheme(getTheme());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureToggle();
      setLayoutMetrics();
      setActiveNavLink();
      setCurrentYear();
      window.addEventListener('resize', setLayoutMetrics);
    });
  } else {
    ensureToggle();
    setLayoutMetrics();
    setActiveNavLink();
    setCurrentYear();
    window.addEventListener('resize', setLayoutMetrics);
  }

  window.addEventListener('load', setLayoutMetrics);

  if (document.fonts && typeof document.fonts.ready?.then === 'function') {
    document.fonts.ready.then(setLayoutMetrics).catch(() => {});
  }
})();
