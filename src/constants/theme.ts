/**
 * Theme tokens for the premium SportHub product design.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#F4F7F4',
    background: '#080B09',
    backgroundElement: '#141915',
    backgroundSelected: '#1B231D',
    textSecondary: '#A1ADA4',
  },
  dark: {
    text: '#F4F7F4',
    background: '#080B09',
    backgroundElement: '#141915',
    backgroundSelected: '#1B231D',
    textSecondary: '#A1ADA4',
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
  background: '#080B09',
  surface: '#141915',
  elevated: '#1B231D',
  accent: '#B8FF4D',
  text: '#F4F7F4',
  textSecondary: '#A1ADA4',
  border: '#29332B',
  danger: '#FF6464',
  success: '#70E69A',
} as const;
