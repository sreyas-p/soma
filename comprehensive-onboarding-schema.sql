-- ============================================
-- Comprehensive Onboarding Schema for Aware Health App
-- Complete SQL file - handles fresh installs AND existing tables
-- Run this entire file in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: Helper functions
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create user record
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 2: Create users table
-- ============================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STEP 3: Create/Update onboarding_data table
-- ============================================

CREATE TABLE IF NOT EXISTS public.onboarding_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  goals TEXT,
  physical_therapy TEXT,
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  weight DECIMAL(5,2),
  height DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comprehensive_data column (works for both new and existing tables)
ALTER TABLE public.onboarding_data 
ADD COLUMN IF NOT EXISTS comprehensive_data JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_onboarding_data_user_id ON public.onboarding_data(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_comprehensive_data ON public.onboarding_data USING GIN (comprehensive_data);

ALTER TABLE public.onboarding_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own onboarding data" ON public.onboarding_data;
CREATE POLICY "Users can view own onboarding data" ON public.onboarding_data
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own onboarding data" ON public.onboarding_data;
CREATE POLICY "Users can insert own onboarding data" ON public.onboarding_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own onboarding data" ON public.onboarding_data;
CREATE POLICY "Users can update own onboarding data" ON public.onboarding_data
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own onboarding data" ON public.onboarding_data;
CREATE POLICY "Users can delete own onboarding data" ON public.onboarding_data
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_onboarding_data_updated_at ON public.onboarding_data;
CREATE TRIGGER update_onboarding_data_updated_at
  BEFORE UPDATE ON public.onboarding_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STEP 4: Create user_profiles table
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  health_score INTEGER DEFAULT 85,
  preferences JSONB DEFAULT '{"units": "imperial", "notifications": true, "data_sharing": false}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own user profile" ON public.user_profiles;
CREATE POLICY "Users can view own user profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own user profile" ON public.user_profiles;
CREATE POLICY "Users can insert own user profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own user profile" ON public.user_profiles;
CREATE POLICY "Users can update own user profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own user profile" ON public.user_profiles;
CREATE POLICY "Users can delete own user profile" ON public.user_profiles
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STEP 5: Create user_medical_conditions table
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_medical_conditions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  condition_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'cardiovascular', 'respiratory', 'endocrine', 'neurological', 'musculoskeletal',
    'gastrointestinal', 'mental_health', 'autoimmune', 'cancer', 'infectious',
    'skin', 'kidney', 'liver', 'reproductive', 'other'
  )),
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe')),
  status TEXT CHECK (status IN ('active', 'managed', 'resolved', 'monitoring')),
  diagnosis_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_medical_conditions_user_id ON public.user_medical_conditions(user_id);

ALTER TABLE public.user_medical_conditions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own medical conditions" ON public.user_medical_conditions;
CREATE POLICY "Users can view own medical conditions" ON public.user_medical_conditions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own medical conditions" ON public.user_medical_conditions;
CREATE POLICY "Users can insert own medical conditions" ON public.user_medical_conditions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own medical conditions" ON public.user_medical_conditions;
CREATE POLICY "Users can update own medical conditions" ON public.user_medical_conditions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own medical conditions" ON public.user_medical_conditions;
CREATE POLICY "Users can delete own medical conditions" ON public.user_medical_conditions
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_medical_conditions_updated_at ON public.user_medical_conditions;
CREATE TRIGGER update_user_medical_conditions_updated_at
  BEFORE UPDATE ON public.user_medical_conditions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STEP 6: Create user_medications table
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_medications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  generic_name TEXT,
  dosage TEXT,
  dosage_unit TEXT CHECK (dosage_unit IN ('mg', 'g', 'mcg', 'ml', 'units', 'other')),
  frequency TEXT CHECK (frequency IN (
    'once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily',
    'every_other_day', 'weekly', 'as_needed', 'other'
  )),
  time_of_day TEXT[],
  purpose TEXT,
  prescribed_by TEXT,
  start_date DATE,
  is_active BOOLEAN DEFAULT true,
  side_effects TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_medications_user_id ON public.user_medications(user_id);

ALTER TABLE public.user_medications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own medications" ON public.user_medications;
CREATE POLICY "Users can view own medications" ON public.user_medications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own medications" ON public.user_medications;
CREATE POLICY "Users can insert own medications" ON public.user_medications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own medications" ON public.user_medications;
CREATE POLICY "Users can update own medications" ON public.user_medications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own medications" ON public.user_medications;
CREATE POLICY "Users can delete own medications" ON public.user_medications
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_medications_updated_at ON public.user_medications;
CREATE TRIGGER update_user_medications_updated_at
  BEFORE UPDATE ON public.user_medications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STEP 7: Create user_allergies table
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_allergies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  allergen TEXT NOT NULL,
  type TEXT CHECK (type IN ('medication', 'food', 'environmental', 'insect', 'latex', 'other')),
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe', 'life_threatening')),
  reaction TEXT,
  diagnosed BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_allergies_user_id ON public.user_allergies(user_id);

ALTER TABLE public.user_allergies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own allergies" ON public.user_allergies;
CREATE POLICY "Users can view own allergies" ON public.user_allergies
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own allergies" ON public.user_allergies;
CREATE POLICY "Users can insert own allergies" ON public.user_allergies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own allergies" ON public.user_allergies;
CREATE POLICY "Users can update own allergies" ON public.user_allergies
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own allergies" ON public.user_allergies;
CREATE POLICY "Users can delete own allergies" ON public.user_allergies
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_allergies_updated_at ON public.user_allergies;
CREATE TRIGGER update_user_allergies_updated_at
  BEFORE UPDATE ON public.user_allergies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STEP 8: Create user_surgeries table
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_surgeries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN (
    'orthopedic', 'cardiac', 'abdominal', 'neurological', 'cosmetic',
    'eye', 'dental', 'cancer', 'transplant', 'other'
  )),
  surgery_date DATE,
  hospital TEXT,
  complications TEXT,
  current_status TEXT CHECK (current_status IN ('fully_recovered', 'recovering', 'ongoing_issues')),
  related_condition TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_surgeries_user_id ON public.user_surgeries(user_id);

ALTER TABLE public.user_surgeries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own surgeries" ON public.user_surgeries;
CREATE POLICY "Users can view own surgeries" ON public.user_surgeries
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own surgeries" ON public.user_surgeries;
CREATE POLICY "Users can insert own surgeries" ON public.user_surgeries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own surgeries" ON public.user_surgeries;
CREATE POLICY "Users can update own surgeries" ON public.user_surgeries
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own surgeries" ON public.user_surgeries;
CREATE POLICY "Users can delete own surgeries" ON public.user_surgeries
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_surgeries_updated_at ON public.user_surgeries;
CREATE TRIGGER update_user_surgeries_updated_at
  BEFORE UPDATE ON public.user_surgeries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STEP 9: Create user_health_goals table
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_health_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category TEXT CHECK (category IN (
    'weight', 'fitness', 'nutrition', 'sleep', 'mental_health',
    'chronic_disease', 'recovery', 'preventive', 'habit', 'other'
  )),
  title TEXT NOT NULL,
  description TEXT,
  target_value DECIMAL,
  target_unit TEXT,
  current_value DECIMAL,
  target_date DATE,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  is_active BOOLEAN DEFAULT true,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_health_goals_user_id ON public.user_health_goals(user_id);

ALTER TABLE public.user_health_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own health goals" ON public.user_health_goals;
CREATE POLICY "Users can view own health goals" ON public.user_health_goals
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own health goals" ON public.user_health_goals;
CREATE POLICY "Users can insert own health goals" ON public.user_health_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own health goals" ON public.user_health_goals;
CREATE POLICY "Users can update own health goals" ON public.user_health_goals
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own health goals" ON public.user_health_goals;
CREATE POLICY "Users can delete own health goals" ON public.user_health_goals
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_health_goals_updated_at ON public.user_health_goals;
CREATE TRIGGER update_user_health_goals_updated_at
  BEFORE UPDATE ON public.user_health_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STEP 10: Create user_lifestyle table
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_lifestyle (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  activity_level TEXT CHECK (activity_level IN (
    'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active'
  )),
  occupation_type TEXT CHECK (occupation_type IN (
    'desk_job', 'light_physical', 'moderate_physical', 'heavy_physical', 'variable'
  )),
  exercise_types TEXT[],
  exercise_frequency INTEGER,
  exercise_duration INTEGER,
  average_sleep_hours DECIMAL,
  sleep_quality TEXT CHECK (sleep_quality IN ('poor', 'fair', 'good', 'excellent')),
  sleep_issues TEXT[],
  diet_type TEXT CHECK (diet_type IN (
    'omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo', 'mediterranean', 'other'
  )),
  meals_per_day INTEGER,
  water_intake_oz INTEGER,
  alcohol_frequency TEXT CHECK (alcohol_frequency IN ('never', 'rarely', 'occasionally', 'weekly', 'daily')),
  alcohol_units_per_week INTEGER,
  caffeine_per_day INTEGER,
  smoking_status TEXT CHECK (smoking_status IN ('never', 'former', 'current', 'vaping')),
  smoking_packs_per_day DECIMAL,
  smoking_years INTEGER,
  stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 10),
  stress_sources TEXT[],
  coping_mechanisms TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_lifestyle_user_id ON public.user_lifestyle(user_id);

ALTER TABLE public.user_lifestyle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own lifestyle" ON public.user_lifestyle;
CREATE POLICY "Users can view own lifestyle" ON public.user_lifestyle
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own lifestyle" ON public.user_lifestyle;
CREATE POLICY "Users can insert own lifestyle" ON public.user_lifestyle
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own lifestyle" ON public.user_lifestyle;
CREATE POLICY "Users can update own lifestyle" ON public.user_lifestyle
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own lifestyle" ON public.user_lifestyle;
CREATE POLICY "Users can delete own lifestyle" ON public.user_lifestyle
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_lifestyle_updated_at ON public.user_lifestyle;
CREATE TRIGGER update_user_lifestyle_updated_at
  BEFORE UPDATE ON public.user_lifestyle
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STEP 11: Create user_family_history table
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_family_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  relationship TEXT CHECK (relationship IN ('mother', 'father', 'sibling', 'grandparent', 'aunt_uncle')),
  conditions TEXT[] NOT NULL,
  age_of_onset INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_family_history_user_id ON public.user_family_history(user_id);

ALTER TABLE public.user_family_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own family history" ON public.user_family_history;
CREATE POLICY "Users can view own family history" ON public.user_family_history
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own family history" ON public.user_family_history;
CREATE POLICY "Users can insert own family history" ON public.user_family_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own family history" ON public.user_family_history;
CREATE POLICY "Users can update own family history" ON public.user_family_history
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own family history" ON public.user_family_history;
CREATE POLICY "Users can delete own family history" ON public.user_family_history
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_family_history_updated_at ON public.user_family_history;
CREATE TRIGGER update_user_family_history_updated_at
  BEFORE UPDATE ON public.user_family_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- DONE! All tables created/updated successfully.
-- ============================================

-- Table comments
COMMENT ON TABLE public.users IS 'Core user table linked to Supabase auth';
COMMENT ON TABLE public.onboarding_data IS 'Stores onboarding responses including comprehensive health profile JSON';
COMMENT ON TABLE public.user_profiles IS 'User profile with preferences and health score';
COMMENT ON TABLE public.user_medical_conditions IS 'User medical conditions with severity and status';
COMMENT ON TABLE public.user_medications IS 'User medications with dosage and frequency';
COMMENT ON TABLE public.user_allergies IS 'User allergies with severity information';
COMMENT ON TABLE public.user_surgeries IS 'User surgical history';
COMMENT ON TABLE public.user_health_goals IS 'User health goals with numerical targets';
COMMENT ON TABLE public.user_lifestyle IS 'User lifestyle factors (exercise, sleep, diet, etc.)';
COMMENT ON TABLE public.user_family_history IS 'Family medical history by relationship';
COMMENT ON COLUMN public.onboarding_data.comprehensive_data IS 'Full comprehensive onboarding data as JSONB';
