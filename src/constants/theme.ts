/**
 * Theme tokens for the premium SportHub product design.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#FFFFFF',
    background: '#0B1110',
    backgroundElement: '#151D1B',
    backgroundSelected: '#202A26',
    textSecondary: '#ACB6AD',
  },
  dark: {
    text: '#FFFFFF',
    background: '#0B1110',
    backgroundElement: '#151D1B',
    backgroundSelected: '#202A26',
    textSecondary: '#ACB6AD',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
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

export const BottomTabInset = Platform.select({ ios: 38, android: 68 }) ?? 0;
export const MaxContentWidth = 820;

export const SportHubBrandColors = {
  background: '#0B1110',
  surface: '#151D1B',
  elevated: '#202A26',
  accent: '#D7F36A',
  text: '#FFFFFF',
  textSecondary: '#ACB6AD',
  border: '#2D3932',
  danger: '#FF6464',
  success: '#BFE95D',
} as const;
