// Light / dark / follow-the-phone appearance (web build).
// Dark mode is done with one CSS filter on the whole app (invert + hue-rotate keeps the brand hues),
// and images are flipped back so photos, icons and the logo look normal. The choice is per device.
import { Platform } from 'react-native';

export type Appearance = 'system' | 'light' | 'dark';
const KEY = 'thrive.appearance';
const listeners = new Set<(a: Appearance) => void>();
const isWeb = Platform.OS === 'web' && typeof document !== 'undefined';

export function getAppearance(): Appearance {
  if (!isWeb) return 'light';
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function prefersDark() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function apply(a: Appearance) {
  if (!isWeb) return;
  const dark = a === 'dark' || (a === 'system' && prefersDark());
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0B1F16' : '#0C5B3C');
}

export function setAppearance(a: Appearance) {
  try {
    window.localStorage.setItem(KEY, a);
  } catch {
    /* private mode: still apply for this visit */
  }
  apply(a);
  listeners.forEach((l) => l(a));
}

export function onAppearanceChange(l: (a: Appearance) => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const appearanceSupported = isWeb;

if (isWeb) {
  const style = document.createElement('style');
  style.textContent = `
    html[data-theme="dark"], html[data-theme="dark"] body { background: #0B1210; }
    html[data-theme="dark"] #root { filter: invert(0.93) hue-rotate(180deg); background: #FEFAEE; }
    html[data-theme="dark"] #root img,
    html[data-theme="dark"] #root [style*="background-image"] { filter: invert(1) hue-rotate(180deg); }
  `;
  document.head.appendChild(style);
  apply(getAppearance());
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getAppearance() === 'system') apply('system');
    });
  } catch {
    /* old browsers: no live follow */
  }
}
