// User and health data types
export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  goals: string;
  physicalTherapy: string;
  age: number;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  weight: number;
  height: number;
  healthScore: number;
  preferences: {
    units: 'metric' | 'imperial';
    notifications: boolean;
    dataSharing: boolean;
  };
}

export interface OnboardingData {
  name: string;
  goals: string;
  physicalTherapy: string;
  age: number;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  weight: number;
  height: number;
  // Extended comprehensive data stored as JSON
  comprehensiveData?: import('./onboarding').ComprehensiveOnboardingData;
}

// Re-export comprehensive onboarding types
export * from './onboarding';

export interface FhirData {
  observations: Observation[];
  medications: Medication[];
  conditions: Condition[];
  appointments: Appointment[];
}

export interface Observation {
  id: string;
  type: 'heart_rate' | 'blood_pressure' | 'weight' | 'glucose' | 'temperature';
  value: number | { systolic: number; diastolic: number };
  unit: string;
  timestamp: Date;
  source: 'manual' | 'device' | 'ehr';
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: Date;
  endDate?: Date;
  reminders: boolean;
}

export interface Condition {
  id: string;
  name: string;
  severity: 'mild' | 'moderate' | 'severe';
  diagnosedDate: Date;
  status: 'active' | 'resolved' | 'monitoring';
}

export interface Appointment {
  id: string;
  providerName: string;
  type: string;
  date: Date;
  location: string;
  notes?: string;
}

export interface WearableDevice {
  id: string;
  name: string;
  type: 'smartwatch' | 'fitness_tracker' | 'glucometer' | 'bp_monitor' | 'fitness-tracker' | 'continuous-glucose-monitor' | 'blood-pressure-monitor';
  brand: string;
  model: string;
  batteryLevel?: number;
  lastSync: Date;
  lastSyncDate?: Date; // Legacy property for backward compatibility
  status: 'connected' | 'disconnected' | 'syncing' | 'low-battery';
  isConnected?: boolean; // Legacy property for backward compatibility
}

export interface AIAgent {
  id: string;
  name: string;
  specialty: 'general' | 'nutrition' | 'fitness' | 'medication' | 'mental_health' | 'sleep' | 'mindfulness';
  avatar: string;
  description: string;
  isActive: boolean;
}

export interface ChatMessage {
  id: string;
  agentId: string;
  content: string;
  timestamp: string;
  isUser: boolean;
  type?: 'text' | 'image' | 'data' | 'suggestion';
  attachments?: ChatAttachment[];
}

export interface ChatAttachment {
  id: string;
  type: 'chart' | 'image' | 'document' | 'link';
  url: string;
  title: string;
  description?: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  category: 'medication' | 'exercise' | 'nutrition' | 'monitoring' | 'appointment' | 'sleep' | 'mindfulness';
  scheduledTime?: string;
  completed: boolean;
  completedAt?: string;
  streak?: number;
  // Weekly checklist support
  frequency?: 'daily' | 'weekly' | 'specific_days';
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, etc.
  weeklyProgress?: { [day: number]: boolean }; // Track completion per day for weekly items
}

export interface WeeklyChecklistItem {
  id: string;
  title: string;
  description?: string;
  category: 'medication' | 'exercise' | 'nutrition' | 'monitoring' | 'appointment' | 'sleep' | 'mindfulness' | 'goal';
  targetCount: number; // e.g., "Exercise 4 times this week"
  currentCount: number;
  unit?: string; // e.g., "times", "minutes", "servings"
  daysCompleted: number[]; // Array of day indices (0-6) when completed
}

export interface JourneyMilestone {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  unlockConditions: string[];
  isUnlocked: boolean;
  isCompleted: boolean;
  completedAt?: Date;
  category: 'health' | 'fitness' | 'nutrition' | 'mental' | 'social';
}

export interface UserProgress {
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  completedMilestones: number;
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  unlockedAt: Date;
}

export interface HealthInsight {
  id: string;
  title: string;
  description: string;
  type: 'trend' | 'anomaly' | 'recommendation' | 'achievement';
  severity: 'low' | 'medium' | 'high';
  dataPoints: any[];
  timestamp: Date;
}

// Theme types
export type ThemeMode = 'light' | 'dark' | 'system';

export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: 'none' | 'capitalize' | 'uppercase' | 'lowercase';
  color?: string;
}

export interface Theme {
  mode: 'light' | 'dark';
  colors: {
    // Primary brand colors
    primary: string;
    primaryDark: string;
    primaryLight: string;
    onPrimary: string;
    
    // Secondary colors
    secondary: string;
    secondaryLight: string;
    onSecondary: string;
    
    // Background hierarchy
    background: string;
    surface: string;
    surfaceVariant: string;
    overlay: string;
    
    // Text hierarchy
    text: {
      primary: string;
      secondary: string;
      tertiary: string;
      disabled: string;
      inverse: string;
    };
    
    // Legacy text colors for backward compatibility
    textSecondary: string;
    
    // Border and divider colors
    border: {
      light: string;
      medium: string;
      dark: string;
      focus: string;
    };
    
    // Divider color
    divider: string;
    
    // Interactive states
    interactive: {
      hover: string;
      pressed: string;
      focus: string;
      disabled: string;
    };
    
    // Semantic colors
    semantic: {
      success: string;
      warning: string;
      error: string;
      info: string;
    };
    
    // Legacy semantic colors for backward compatibility
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  typography: {
    h1: TextStyle;
    h2: TextStyle;
    h3: TextStyle;
    h4: TextStyle;
    body1: TextStyle;
    body2: TextStyle;
    body3: TextStyle;
    button: TextStyle;
    caption: TextStyle;
    label: TextStyle;
    cardTitle: TextStyle;
    cardSubtitle: TextStyle;
    dataLarge: TextStyle;
    dataMedium: TextStyle;
    dataSmall: TextStyle;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    '2xl': number;
    '3xl': number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
} 