import { Platform } from 'react-native';

// Typography scales and font families
export const fontFamilies = {
  // Primary font family - Inter for Android, SF Pro for iOS
  primary: Platform.select({
    ios: 'SF Pro Display',
    android: 'Inter',
    default: 'Inter',
  }),
  
  // Secondary font for body text
  body: Platform.select({
    ios: 'SF Pro Text', 
    android: 'Inter',
    default: 'Inter',
  }),
  
  // Monospace for data/numbers
  mono: Platform.select({
    ios: 'SF Mono',
    android: 'JetBrains Mono',
    default: 'monospace',
  }),
};

// Font sizes following your specification
export const fontSizes = {
  // Headers (28pt as specified)
  h1: 28,      // Main page headers
  h2: 24,      // Section headers  
  h3: 20,      // Sub-section headers
  h4: 18,      // Card headers
  
  // Body text (16-20pt range as specified)
  body: 18,     // Main body text (18pt - middle of your range)
  bodyLarge: 20, // Emphasized body text (20pt - top of range)
  bodySmall: 16, // Secondary body text (16pt - bottom of range)
  
  // UI elements
  button: 16,   // Button text
  caption: 14,  // Captions and labels
  label: 12,    // Small labels
  micro: 10,    // Tiny text (sparingly used)
};

// Font weights - refined hierarchy
export const fontWeights = {
  light: '300',    // Light emphasis
  regular: '400',  // Normal text
  medium: '500',   // Subtle emphasis
  semibold: '600', // Strong emphasis
  bold: '700',     // Headers and important text
  heavy: '800',    // Very strong emphasis (rare)
} as const;

// Line heights for optimal readability
export const lineHeights = {
  tight: 1.2,    // Headers and compact text
  normal: 1.4,   // Most UI text
  relaxed: 1.6,  // Body text for reading
  loose: 1.8,    // Very readable body text
};

// Letter spacing for refined typography
export const letterSpacing = {
  tight: -0.5,   // Headers (slight compression)
  normal: 0,     // Default spacing
  wide: 0.5,     // Buttons and labels
  wider: 1,      // All caps text
};

// Complete typography styles
export const typography = {
  // Headers - 28pt as specified, optimized for health app
  h1: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes.h1,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.h1 * lineHeights.tight,
    letterSpacing: letterSpacing.tight,
  },
  
  h2: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes.h2,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.h2 * lineHeights.tight,
    letterSpacing: letterSpacing.tight,
  },
  
  h3: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes.h3,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.h3 * lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  },
  
  h4: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes.h4,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.h4 * lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  },
  
  // Body text - 16-20pt range as specified
  body1: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyLarge,     // 20pt - top of your range
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.bodyLarge * lineHeights.relaxed,
    letterSpacing: letterSpacing.normal,
  },
  
  body2: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.body,          // 18pt - middle of your range  
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.body * lineHeights.relaxed,
    letterSpacing: letterSpacing.normal,
  },
  
  body3: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySmall,     // 16pt - bottom of your range
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.bodySmall * lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  },
  
  // UI elements
  button: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes.button,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.button * lineHeights.normal,
    letterSpacing: letterSpacing.wide,
  },
  
  caption: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.caption * lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  },
  
  label: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.label,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.label * lineHeights.normal,
    letterSpacing: letterSpacing.wide,
    textTransform: 'uppercase' as const,
  },
  
  // Special purpose styles
  cardTitle: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes.h4,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.h4 * lineHeights.tight,
    letterSpacing: letterSpacing.normal,
  },
  
  cardSubtitle: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySmall,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.bodySmall * lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  },
  
  // Health data numbers - monospace for precise alignment
  dataLarge: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.h2,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.h2 * lineHeights.tight,
    letterSpacing: letterSpacing.normal,
  },
  
  dataMedium: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.h3,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.h3 * lineHeights.tight,
    letterSpacing: letterSpacing.normal,
  },
  
  dataSmall: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.body * lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  },
}; 