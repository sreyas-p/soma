import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase configuration - Logan's project
const supabaseUrl = 'https://rzgynrkidzsafmcfhnod.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6Z3lucmtpZHpzYWZtY2Zobm9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3Mjk0MzIsImV4cCI6MjA4MzMwNTQzMn0.mc_L3r5qPGDSJIZ1STvHcJCwiLtyntwU_U41XbzdrQw';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database table names
export const TABLES = {
  USERS: 'users',
  ONBOARDING_DATA: 'onboarding_data',
  USER_PROFILES: 'user_profiles',
  HEALTH_DATA: 'health_data',
  MEAL_PLANS: 'meal_plans',
  WORKOUT_PLANS: 'workout_plans',
  SLEEP_SCHEDULES: 'sleep_schedules',
  USER_INSIGHTS: 'user_insights',
  HEALTH_DATA_HISTORY: 'health_data_history',
  AGENT_CONTEXT_CACHE: 'agent_context_cache',
} as const;

// Database types
export interface DatabaseUser {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseOnboardingData {
  id: string;
  user_id: string;
  name: string;
  goals: string;
  physical_therapy: string;
  age: number;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  weight: number;
  height: number;
  // Comprehensive health profile data (stored as JSONB)
  comprehensive_data?: {
    basicInfo?: any;
    contactInfo?: any;
    physicalMeasurements?: any;
    hasMedicalConditions?: boolean;
    medicalConditions?: any[];
    takesMedications?: boolean;
    medications?: any[];
    hasAllergies?: boolean;
    allergies?: any[];
    hasSurgicalHistory?: boolean;
    surgeries?: any[];
    isReceivingTreatment?: boolean;
    currentTreatment?: any;
    healthGoals?: any[];
    primaryHealthFocus?: string;
    lifestyle?: any;
    hasFamilyHistory?: boolean;
    familyHistory?: any[];
    hasExistingProviders?: boolean;
    careTeam?: any[];
    preferences?: any;
    version?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface DatabaseUserProfile {
  id: string;
  user_id: string;
  name: string;
  username: string;
  health_score: number;
  preferences: {
    units: 'metric' | 'imperial';
    notifications: boolean;
    data_sharing: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface DatabaseMealPlan {
  id: string;
  user_id: string;
  content: string;
  day: string;
  plan_date: string;
  generated_at: string;
  updated_at: string;
  created_at: string;
}

export interface DatabaseWorkoutPlan {
  id: string;
  user_id: string;
  content: Record<string, any>; // JSONB storing workout structure
  day: string;
  plan_date: string;
  generated_at: string;
  updated_at: string;
  created_at: string;
}

export interface DatabaseSleepSchedule {
  id: string;
  user_id: string;
  content: Record<string, any>; // JSONB storing sleep schedule structure
  day: string;
  plan_date: string;
  generated_at: string;
  updated_at: string;
  created_at: string;
}

export interface DatabaseUserInsight {
  id: string;
  user_id: string;
  insight: string;
  category: 'habit' | 'health' | 'preference' | 'allergy' | 'restriction' | 'exercise' | 'sleep' | 'nutrition' | 'mental_health' | 'medical_advice' | 'goal' | 'lifestyle' | 'other';
  source_agent?: string;
  confidence: number;
  is_active: boolean;
  learned_at: string;
  last_used_at?: string;
  source_message?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DatabaseHealthDataHistory {
  id: string;
  user_id: string;
  data_date: string;
  steps?: number;
  distance?: number;
  calories?: number;
  heart_rate?: number;
  heart_rate_min?: number;
  heart_rate_max?: number;
  weight?: number;
  sleep_hours?: number;
  sleep_quality?: 'poor' | 'fair' | 'good' | 'excellent';
  workout_minutes?: number;
  workout_count?: number;
  mindfulness_minutes?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  blood_glucose?: number;
  source?: string;
  raw_data?: Record<string, any>;
  created_at: string;
}

// Helper type for citation references
export interface DataCitation {
  type: string;
  field?: string;
  value?: any;
  date?: string;
  source?: string;
  index?: number;
}

// API response type with citations
export interface AgentResponseWithCitations {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
  metadata?: {
    citations: string[];
    citationDetails: Record<string, string>;
    dataPointsUsed: number;
  };
}
