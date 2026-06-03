// --- MAIN APP ENTRY POINT BOOTSTRAPPER ---
// Combines theme initializers, tab router, and state handlers

import './index.css';
import { 
  initTheme, 
  applyTheme, 
  Theme, 
  listenToSystemThemeChanges 
} from './js/theme';
import { 
  renderActiveTab, 
  bindGlobalTabSwitches 
} from './js/dom';

// Updates the visual active state of the theme buttons in the header
function updateThemeButtonsUI(activeTheme: Theme) {
  const lightBtn = document.getElementById('themeBtnLight')!;
  const darkBtn = document.getElementById('themeBtnDark')!;
  const autoBtn = document.getElementById('themeBtnAuto')!;

  // Reset inactive look of all buttons
  const baseClass = "p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-all cursor-pointer";
  lightBtn.className = baseClass;
  darkBtn.className = baseClass;
  autoBtn.className = baseClass;

  // Add highlighted borders and backgrounds to selected mode
  if (activeTheme === 'light') {
    lightBtn.className = "p-2 rounded-lg bg-blue-100 border border-blue-200/60 text-blue-600 dark:bg-blue-950/40 dark:border-blue-500/30 dark:text-blue-400 font-bold transition-all cursor-pointer";
  } else if (activeTheme === 'dark') {
    darkBtn.className = "p-2 rounded-lg bg-blue-100 border border-blue-200/60 text-blue-600 dark:bg-blue-950/40 dark:border-blue-500/30 dark:text-blue-400 font-bold transition-all cursor-pointer";
  } else if (activeTheme === 'auto') {
    autoBtn.className = "p-2 rounded-lg bg-emerald-100/60 border border-emerald-200/60 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-500/30 dark:text-emerald-400 font-bold transition-all cursor-pointer";
  }
}

// Binds custom actions to theme buttons on DOM load
function bindThemeToggles() {
  const lightBtn = document.getElementById('themeBtnLight')!;
  const darkBtn = document.getElementById('themeBtnDark')!;
  const autoBtn = document.getElementById('themeBtnAuto')!;

  lightBtn.addEventListener('click', () => {
    applyTheme('light');
    updateThemeButtonsUI('light');
    // Refresh tab visual styles which might hook to state colors
    renderActiveTab();
  });

  darkBtn.addEventListener('click', () => {
    applyTheme('dark');
    updateThemeButtonsUI('dark');
    renderActiveTab();
  });

  autoBtn.addEventListener('click', () => {
    applyTheme('auto');
    updateThemeButtonsUI('auto');
    renderActiveTab();
  });
}

// Event hook triggered when DOM parsing reaches safe execution standard
document.addEventListener('DOMContentLoaded', () => {
  // 1. Setup Theme Manager and find existing preferences
  const currentTheme = initTheme();
  updateThemeButtonsUI(currentTheme);
  bindThemeToggles();

  // Load OS system watcher - if system triggers colors shift and auto is selected, screen redraws
  listenToSystemThemeChanges(() => {
    renderActiveTab();
  });

  // 2. Setup storage pool active tabs and sliders
  bindGlobalTabSwitches();
  renderActiveTab();
});
