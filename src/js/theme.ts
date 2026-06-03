// --- THEME MANAGEMENT FOR STORAGE CALCULATOR ---
// Supports Light mode, Dark mode, and Auto (System preference)

export type Theme = 'light' | 'dark' | 'auto';

/**
 * Initializes theme on DOM startup. Looks up existing settings in localStorage
 * or defaults to system config mapping.
 */
export function initTheme(): Theme {
  const savedTheme = localStorage.getItem('theme') as Theme || 'auto';
  applyTheme(savedTheme);
  return savedTheme;
}

/**
 * Applies selected theme globally by adjusting root element classes and color schemes.
 */
export function applyTheme(theme: Theme) {
  const html = document.documentElement;
  
  // Strip active styling classes
  html.classList.remove('light', 'dark');
  
  if (theme === 'dark') {
    html.classList.add('dark');
    html.style.colorScheme = 'dark';
  } else if (theme === 'light') {
    html.classList.add('light');
    html.style.colorScheme = 'light';
  } else {
    // Falls back to system query
    const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (systemIsDark) {
      html.classList.add('dark');
      html.style.colorScheme = 'dark';
    } else {
      html.classList.add('light');
      html.style.colorScheme = 'light';
    }
  }
  
  // Persist preference
  localStorage.setItem('theme', theme);
  
  // Dispatch custom event to notify listeners
  window.dispatchEvent(new CustomEvent('themechanged', { detail: { theme } }));
}

/**
 * Listens to active OS/system scheme adjustments and triggers screen redraws
 * if the user has chosen the "Auto" state option.
 */
export function listenToSystemThemeChanges(onThemeRefresh: () => void) {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  mediaQuery.addEventListener('change', () => {
    const active = localStorage.getItem('theme') as Theme || 'auto';
    if (active === 'auto') {
      applyTheme('auto');
      onThemeRefresh();
    }
  });
}
