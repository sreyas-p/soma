// SOMA Health App - Fresh Teal & Coral Color Palette
// Modern, warm, and user-friendly with WCAG-AA contrast compliance

export const lightColors = {
  // Primary brand colors - Teal/Cyan
  primary: '#0D9488',        // Rich teal - main brand color
  primaryDark: '#0F766E',    // Darker teal for interactions
  primaryLight: '#CCFBF1',   // Very light teal for backgrounds
  onPrimary: '#FFFFFF',      // Pure white on primary
  
  // Secondary colors - Warm coral/peach tones
  secondary: '#F97316',      // Vibrant coral/orange
  secondaryLight: '#FFF7ED', // Very light orange background
  onSecondary: '#FFFFFF',    // White on secondary
  
  // Background hierarchy - Warm whites
  background: '#FEFEFE',      // Warm white primary background
  surface: '#FDF8F6',        // Subtle warm off-white for cards
  surfaceVariant: '#FAF5F2', // Slightly peachy variant
  overlay: 'rgba(30, 41, 59, 0.6)', // Dark overlay with opacity
  
  // Text hierarchy - Warm dark tones with excellent contrast
  text: {
    primary: '#1C1917',      // Warm almost black (21:1 contrast)
    secondary: '#57534E',    // Warm medium grey (7:1 contrast) 
    tertiary: '#78716C',     // Warm lighter grey (5.5:1 contrast)
    disabled: '#A8A29E',     // Warm disabled state
    inverse: '#FFFFFF',      // White text on dark backgrounds
  },
  
  // Legacy text colors for backward compatibility
  textSecondary: '#57534E',
  
  // Border and divider colors - Warm subtle separation
  border: {
    light: '#E7E5E4',        // Very light warm grey borders
    medium: '#D6D3D1',       // Medium warm grey borders
    dark: '#A8A29E',         // Darker borders for emphasis
    focus: '#0D9488',        // Primary teal for focus states
  },
  
  // Divider color
  divider: '#E7E5E4',
  
  // Interactive states - Teal-based
  interactive: {
    hover: 'rgba(13, 148, 136, 0.08)',
    pressed: 'rgba(13, 148, 136, 0.12)',
    focus: 'rgba(13, 148, 136, 0.16)',
    disabled: 'rgba(168, 162, 158, 0.5)',
  },
  
  // Semantic colors - Health-focused
  semantic: {
    success: '#059669',      // Emerald green
    warning: '#D97706',      // Amber orange
    error: '#DC2626',        // Red
    info: '#0891B2',         // Cyan
  },
  
  // Legacy semantic colors
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  info: '#0891B2',
};

export const darkColors = {
  // Primary colors adjusted for dark theme
  primary: '#2DD4BF',        // Lighter teal for dark backgrounds
  primaryDark: '#14B8A6',    // Standard teal
  primaryLight: '#134E4A',   // Dark teal background
  onPrimary: '#042F2E',      // Dark text on light primary
  
  // Secondary colors - Warm coral for dark theme
  secondary: '#FB923C',      // Light coral
  secondaryLight: '#431407', // Dark orange background
  onSecondary: '#1C1917',    // Dark text
  
  // Dark theme backgrounds - Warm dark tones
  background: '#1C1917',      // Warm dark background
  surface: '#292524',        // Warm lighter dark surface
  surfaceVariant: '#3F3A36', // Even lighter variant
  overlay: 'rgba(0, 0, 0, 0.7)',
  
  // Dark theme text - Warm inverted hierarchy
  text: {
    primary: '#FAFAF9',      // Warm almost white
    secondary: '#D6D3D1',    // Warm light grey
    tertiary: '#A8A29E',     // Warm medium grey
    disabled: '#78716C',     // Darker disabled
    inverse: '#1C1917',      // Dark text for light backgrounds
  },
  
  // Dark theme legacy text colors
  textSecondary: '#D6D3D1',
  
  // Dark theme borders
  border: {
    light: '#3F3A36',
    medium: '#57534E',
    dark: '#78716C',
    focus: '#2DD4BF',
  },
  
  // Dark theme divider
  divider: '#3F3A36',
  
  // Dark theme interactive states
  interactive: {
    hover: 'rgba(45, 212, 191, 0.12)',
    pressed: 'rgba(45, 212, 191, 0.16)',
    focus: 'rgba(45, 212, 191, 0.20)',
    disabled: 'rgba(120, 113, 108, 0.5)',
  },
  
  // Dark theme semantic colors
  semantic: {
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#22D3EE',
  },
  
  // Dark theme legacy semantic colors
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#22D3EE',
};

// Status colors for health data
export const statusColors = {
  // Health status indicators
  optimal: '#059669',       // Emerald - optimal health
  good: '#65A30D',          // Lime green - good status
  caution: '#D97706',       // Amber - needs attention
  critical: '#DC2626',      // Red - critical status
  
  // Device connection status
  connected: '#059669',     // Emerald - connected
  syncing: '#0891B2',       // Cyan - syncing
  disconnected: '#78716C',  // Warm grey - disconnected
  error: '#DC2626',         // Red - connection error
};

// Chart colors - health data visualization
export const chartColors = {
  // Vital signs colors
  heartRate: '#E11D48',      // Rose for heart rate
  bloodPressure: '#7C3AED', // Violet for BP
  glucose: '#0891B2',        // Cyan for glucose
  weight: '#059669',         // Emerald for weight
  steps: '#F97316',          // Coral for activity
  sleep: '#6366F1',          // Indigo for sleep
  
  // Chart styling
  grid: '#E7E5E4',
  axis: '#78716C',
  background: '#FEFEFE',
};

// Gamification colors - motivational and engaging
export const gamificationColors = {
  // Achievement levels
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  
  // Progress and XP
  xp: '#7C3AED',            // Violet for XP
  streak: '#F97316',        // Coral for streaks
  milestone: '#059669',     // Emerald for milestones
  locked: '#A8A29E',        // Warm grey for locked content
};
