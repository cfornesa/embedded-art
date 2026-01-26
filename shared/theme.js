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

  // Apply stored theme early to reduce flashes.
  setTheme(getTheme());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureToggle);
  } else {
    ensureToggle();
  }
})();
