/**
 * Echo design system — Material 3-inspired tokens.
 * All colors, typography, spacing, and border radius constants used throughout the app.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1F1F1F',
    background: '#F8F9FA',
    backgroundElement: '#EDF2FA',
    backgroundSelected: '#D3E3FD',
    textSecondary: '#5F6368',
    primary: '#0B57D0',
    primaryContainer: '#D3E3FD',
    outline: '#DADCE0',
    surface: '#FFFFFF',
    error: '#B3261E',
    errorContainer: '#FFDAD6',
    success: '#146C36',
    successContainer: '#C8F5D5',
    warning: '#B06000',
    warningContainer: '#FFEAC2',
    conflict: '#C0392B',
    conflictContainer: '#FADBD8',
    inputBackground: '#FFFFFF',
    border: '#E0E0E0',
  },
  dark: {
    text: '#E3E3E3',
    background: '#131314',
    backgroundElement: '#1E1F20',
    backgroundSelected: '#0842A0',
    textSecondary: '#C4C7C5',
    primary: '#A8C7FA',
    primaryContainer: '#0842A0',
    outline: '#444746',
    surface: '#1E1F20',
    error: '#F2B8B5',
    errorContainer: '#8C1D18',
    success: '#37BE5F',
    successContainer: '#0A3D20',
    warning: '#FFB85F',
    warningContainer: '#4B3000',
    conflict: '#F1948A',
    conflictContainer: '#641E16',
    inputBackground: '#1E1F20',
    border: '#3C4043',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

export const Fonts = {
  sans: {
    regular: Platform.select({ web: 'var(--font-display)', default: 'Inter-Regular' }),
    medium: Platform.select({ web: 'var(--font-display)', default: 'Inter-Medium' }),
    semibold: Platform.select({ web: 'var(--font-display)', default: 'Inter-SemiBold' }),
    bold: Platform.select({ web: 'var(--font-display)', default: 'Inter-Bold' }),
  },
  serif: {
    regular: Platform.select({ web: 'var(--font-display)', default: 'Inter-Regular' }),
    italic: Platform.select({ web: 'var(--font-display)', default: 'Inter-Regular' }),
  },
  mono: Platform.select({ web: 'var(--font-mono)', default: 'monospace' }),
};

/** 4pt grid spacing system */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Consistent border radius tokens */
export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 28,
  full: 9999,
} as const;

/** Typography scale (font sizes) */
export const FontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 24,
  display: 32,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
