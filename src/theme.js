// Design System Tokens
export const Colors = {
  // Primary brand — monochrome dark
  primary: '#FFFFFF',
  primaryLight: '#F3F4F6',
  primaryDark: '#D1D5DB',

  // Accent — vivid emerald (used for success and main accents)
  accent: '#00C878',
  accentDark: '#009958',
  accentLight: 'rgba(0,200,120,0.12)',

  // Surface
  background: '#121212',
  surface: '#1E1E1E',
  surfaceElevated: '#2A2A2A',
  surfaceBorder: 'rgba(255,255,255,0.08)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  textMuted: 'rgba(255,255,255,0.4)',

  // Semantic
  success: '#00C878',
  danger: '#FF4D6D',
  warning: '#FFB700',

  // Gradients (used as array)
  gradientCard: ['#1E1E1E', '#161616'],
  gradientAccent: ['#00C878', '#007A4A'],
};

export const Typography = {
  // font families (system weights, as we load Inter via expo-font)
  fontFamily: 'System',

  // sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 32,
  hero: 42,

  // weights
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
};
