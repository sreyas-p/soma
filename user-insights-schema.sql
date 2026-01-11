-- User Insights Schema for Soma Health App
-- This schema stores dynamic insights learned from chat conversations
-- and historical health data for trend analysis
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/rzgynrkidzsafmcfhnod/sql

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USER INSIGHTS TABLE
-- Stores insights learned from conversations
-- ============================================
CREATE TABLE IF NOT EXISTS user_insights (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- The insight content
  insight TEXT NOT NULL,
  
  -- Category of the insight
  category TEXT NOT NULL CHECK (category IN (
    'habit',
    'health',
    'preference',
    'allergy',
    'restriction',
    'exercise',
    'sleep',
    'nutrition',
    'mental_health',
    'medical_advice',
    'goal',
    'lifestyle',
    'other'
  )),
  
  -- Which agent learned this
  source_agent TEXT,
  
  -- Confidence score (0-1)
  confidence DECIMAL DEFAULT 0.7,
  
  -- Whether this insight is still relevant
  is_active BOOLEAN DEFAULT true,
  
  -- When this was learned
  learned_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- When this was last validated/used
  last_used_at TIMESTAMPTZ,
  
  -- Optional: the original message that contained this info
  source_message TEXT,
  
  -- Metadata (e.g., specific values, units)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- HEALTH DATA HISTORY TABLE
-- Stores daily snapshots for trend analysis
-- ============================================
CREATE TABLE IF NOT EXISTS health_data_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- The date this data is for
  data_date DATE NOT NULL,
  
  -- Health metrics
  steps INTEGER,
  distance DECIMAL, -- in meters
  calories DECIMAL,
  heart_rate INTEGER, -- BPM
  heart_rate_min INTEGER,
  heart_rate_max INTEGER,
  weight DECIMAL, -- in user's preferred unit
  sleep_hours DECIMAL,
  sleep_quality TEXT CHECK (sleep_quality IN ('poor', 'fair', 'good', 'excellent')),
  workout_minutes INTEGER,
  workout_count INTEGER,
  mindfulness_minutes INTEGER,
  
  -- Additional vitals
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  blood_glucose DECIMAL,
  
  -- Source of the data
  source TEXT DEFAULT 'Apple Health',
  
  -- Raw data for detailed analysis
  raw_data JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one record per user per day
  CONSTRAINT unique_user_date UNIQUE (user_id, data_date)
);

-- ============================================
-- AGENT CONTEXT CACHE TABLE
-- Cache compiled context for faster responses
-- ============================================
CREATE TABLE IF NOT EXISTS agent_context_cache (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  -- Compiled context string
  compiled_context TEXT NOT NULL,
  
  -- Citations for data sources
  citations JSONB DEFAULT '[]'::jsonb,
  
  -- When this context was last compiled
  compiled_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Version tracking
  version INTEGER DEFAULT 1,
  
  -- Hash of source data for invalidation
  data_hash TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_insights_user_id ON user_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_user_insights_category ON user_insights(category);
CREATE INDEX IF NOT EXISTS idx_user_insights_active ON user_insights(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_insights_learned_at ON user_insights(learned_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_history_user_id ON health_data_history(user_id);
CREATE INDEX IF NOT EXISTS idx_health_history_date ON health_data_history(data_date DESC);
CREATE INDEX IF NOT EXISTS idx_health_history_user_date ON health_data_history(user_id, data_date DESC);

CREATE INDEX IF NOT EXISTS idx_context_cache_user_id ON agent_context_cache(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE user_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_data_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_context_cache ENABLE ROW LEVEL SECURITY;

-- User insights policies
CREATE POLICY "Users can view own insights" ON user_insights
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insights" ON user_insights
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insights" ON user_insights
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own insights" ON user_insights
  FOR DELETE USING (auth.uid() = user_id);

-- Health history policies
CREATE POLICY "Users can view own health history" ON health_data_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health history" ON health_data_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health history" ON health_data_history
  FOR UPDATE USING (auth.uid() = user_id);

-- Context cache policies
CREATE POLICY "Users can view own context cache" ON agent_context_cache
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own context cache" ON agent_context_cache
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_insights_updated_at
  BEFORE UPDATE ON user_insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_context_cache_updated_at
  BEFORE UPDATE ON agent_context_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to archive old daily health data
-- Call this periodically to maintain data history
CREATE OR REPLACE FUNCTION archive_daily_health_data()
RETURNS void AS $$
BEGIN
  -- Insert today's health data into history (if not exists)
  INSERT INTO health_data_history (
    user_id, data_date, steps, distance, calories, heart_rate,
    weight, sleep_hours, workout_minutes, workout_count,
    mindfulness_minutes, source
  )
  SELECT 
    user_id,
    CURRENT_DATE,
    steps,
    distance,
    calories,
    heart_rate,
    weight,
    sleep_hours,
    workout_minutes,
    workout_count,
    mindfulness_minutes,
    source
  FROM health_data
  WHERE data_date = CURRENT_DATE
  ON CONFLICT (user_id, data_date) 
  DO UPDATE SET
    steps = EXCLUDED.steps,
    distance = EXCLUDED.distance,
    calories = EXCLUDED.calories,
    heart_rate = EXCLUDED.heart_rate,
    weight = EXCLUDED.weight,
    sleep_hours = EXCLUDED.sleep_hours,
    workout_minutes = EXCLUDED.workout_minutes,
    workout_count = EXCLUDED.workout_count,
    mindfulness_minutes = EXCLUDED.mindfulness_minutes;
END;
$$ LANGUAGE plpgsql;

-- Function to invalidate context cache when data changes
CREATE OR REPLACE FUNCTION invalidate_context_cache()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE agent_context_cache
  SET updated_at = NOW(), version = version + 1
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to invalidate cache on data changes
CREATE TRIGGER invalidate_cache_on_onboarding_change
  AFTER INSERT OR UPDATE ON onboarding_data
  FOR EACH ROW EXECUTE FUNCTION invalidate_context_cache();

CREATE TRIGGER invalidate_cache_on_health_change
  AFTER INSERT OR UPDATE ON health_data
  FOR EACH ROW EXECUTE FUNCTION invalidate_context_cache();

CREATE TRIGGER invalidate_cache_on_insight_change
  AFTER INSERT OR UPDATE ON user_insights
  FOR EACH ROW EXECUTE FUNCTION invalidate_context_cache();

-- ============================================
-- SAMPLE DATA CLEANUP (Optional)
-- ============================================

-- View to get user's complete context
CREATE OR REPLACE VIEW user_complete_context AS
SELECT 
  u.id as user_id,
  u.email,
  od.name,
  od.goals,
  od.comprehensive_data,
  hd.steps,
  hd.calories,
  hd.heart_rate,
  hd.sleep_hours,
  hd.weight,
  hd.last_synced_at,
  (
    SELECT json_agg(t)
    FROM (
      SELECT ui.category, ui.insight, ui.learned_at
      FROM user_insights ui
      WHERE ui.user_id = u.id AND ui.is_active = true
      ORDER BY ui.learned_at DESC
      LIMIT 10
    ) t
  ) as recent_insights
FROM auth.users u
LEFT JOIN onboarding_data od ON od.user_id = u.id
LEFT JOIN health_data hd ON hd.user_id = u.id;

-- Comment: Run this schema in Supabase SQL Editor to enable:
-- 1. Dynamic insight storage from conversations
-- 2. Historical health data tracking
-- 3. Context caching for faster agent responses
-- 4. Automatic cache invalidation on data changes
