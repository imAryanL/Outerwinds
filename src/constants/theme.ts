/**
 * Outerwinds colors. Named by meaning so we change them in one place.
 * v1 is light-only; `dark` is kept so the scaffold doesn't break.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F172A', // main text (near-black slate)
    textSecondary: '#5B6B78', // muted text (subtext)
    textTertiary: '#94A3B8', // lightest text — small labels that shouldn't compete with content
    background: '#F2F5F7', // app background (light gray)
    backgroundElement: '#FFFFFF', // cards / surfaces (white)
    backgroundSelected: '#E3F2EC', // pressed / selected (soft green)
    primary: '#10B981', // brand GREEN (lighter) — buttons, active tab, etc.
    primaryDeep: '#047857', // deeper green — icons/marks that need more weight than primary
    primarySoft: '#A7DFC7', // soft green — subtle rings/accents, sits between backgroundSelected and primary
    warning: '#A16207', // amber warning text/icon (expiring items, low stock — never red)
    warningFill: '#FACC15', // solid yellow for badge fills — always pair with DARK text, never white
    warningBackground: '#FEF8DD', // amber warning card background (soft — calm, not alarming)
    // RED = real storm WARNINGS only (conditions expected). Banned everywhere else in the app.
    // Note the flip from amber: a saturated red is a DARK fill, so its badge takes WHITE text
    // (white on #DC2626 = 4.8:1, passes AA), the opposite of the light yellow badge above.
    danger: '#B91C1C', // red warning text/icon — readable red on the light card
    dangerFill: '#DC2626', // solid red for the warning badge — always pair with WHITE text
    dangerBackground: '#FBDCDC', // soft red warning card background — rosier than a whisper, still calm not siren-loud
    // Offline/cached = a NEUTRAL dark slate, deliberately NOT a severity color.
    // Connectivity is a separate axis from calm/watch/warning, so it must never borrow
    // amber or red (those belong to the alert states). Pair with light/white text.
    offlineBanner: '#334155', // slate — the offline banner bar and the "cached" pill
    border: '#CBD5E1', // border around cards/sections (a touch darker than a hairline)
  },
  dark: {
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    textTertiary: '#64748B', // in dark mode "lighter" means dimmer, so it steps down not up
    background: '#0B1220',
    backgroundElement: '#141C2B',
    backgroundSelected: '#1A2B24',
    primary: '#34D399',
    primaryDeep: '#6EE7B7', // in dark mode "deeper" means brighter, so it still stands out
    primarySoft: '#2A5546', // soft green for rings, dialed down to sit on a dark background
    warning: '#FBBF24',
    warningFill: '#FACC15', // same yellow in dark mode — the dark text on it stays readable
    warningBackground: '#3F2D12',
    danger: '#F87171', // lighter red so it reads on a dark background
    dangerFill: '#DC2626', // same red in dark mode — the white text on it stays readable
    dangerBackground: '#3F1D1D', // deep red card background, matching the amber one's darkness
    offlineBanner: '#475569', // lighter slate so the neutral banner reads on the dark background
    border: '#233043', // subtle hairline border around cards/sections
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
