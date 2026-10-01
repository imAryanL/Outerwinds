/**
 * Outerwinds colors. Named by meaning so we change them in one place.
 * Light and dark are both designed; dark is true black for OLED battery.
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
    primaryButton: '#047857', // fill for buttons that carry white text — dark in BOTH themes
    onPrimary: '#FFFFFF', // check marks sitting on a `primary` fill
    primarySoft: '#A7DFC7', // soft green — subtle rings/accents, sits between backgroundSelected and primary
    warning: '#A16207', // amber warning text/icon (expiring items, low stock — never red)
    warningFill: '#FACC15', // solid yellow for badge fills — always pair with DARK text, never white
    onWarningFill: '#0F172A', // the dark text that goes on warningFill, same in both themes
    warningBackground: '#FEF8DD', // amber warning card background (soft — calm, not alarming)
    warningDisc: '#FFFFFF', // circle behind the icon on an amber card
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
    textSecondary: '#A3A3A3', // neutral greys, no blue cast
    textTertiary: '#737373', // in dark mode "lighter" means dimmer, so it steps down not up
    background: '#000000', // true black — saves OLED battery during an outage
    backgroundElement: '#161616',
    backgroundSelected: '#10231B',
    primary: '#10B981', // same emerald as light, so the two modes read as one brand green
    primaryDeep: '#10B981', // same emerald as `primary` so icons, rings and text all match
    primaryButton: '#047857', // same as light: the deeper green that holds white button text
    onPrimary: '#FFFFFF', // white check on the emerald, same as light
    primarySoft: '#2A5546', // soft green for rings, dialed down to sit on a dark background
    warning: '#E2B65A', // a muted gold, not the bright yellow — calmer text and icons on the charcoal cards
    warningFill: '#FACC15', // same yellow in dark mode — the dark text on it stays readable
    onWarningFill: '#0F172A', // `text` turns white in dark, so the badge can't borrow it
    warningBackground: '#453B10', // dark gold-yellow card; the old charcoal was #1E1A10 if this is ever too loud
    warningDisc: '#5A4C16', // deeper gold circle behind the icon
    danger: '#F87171', // lighter red so it reads on a dark background
    dangerFill: '#DC2626', // same red in dark mode — the white text on it stays readable
    dangerBackground: '#2B1010', // deep red card background, matching the amber one's darkness
    offlineBanner: '#3A3A3A', // lighter grey so the neutral banner reads on black
    border: '#2A2A2A', // subtle hairline border around cards/sections
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
