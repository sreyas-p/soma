-- ============================================
-- Health Data Schema - Single Entry Per User
-- Run this in Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/rzgynrkidzsafmcfhnod/sql
-- ============================================
-- This stores ONE row per user with latest health data

-- Drop old table if it exists (remove this line if you want to keep old data)
DROP TABLE IF EXISTS health_data CASCADE;

-- Create health_data table with one row per user
CREATE TABLE health_data (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    
    -- Daily activity metrics (updated each sync)
    steps INTEGER DEFAULT 0,
    distance DECIMAL DEFAULT 0,
    calories DECIMAL DEFAULT 0,
    
    -- Vitals
    heart_rate DECIMAL,
    heart_rate_min DECIMAL,
    heart_rate_max DECIMAL,
    
    -- Body measurements
    weight DECIMAL,
    height DECIMAL,
    bmi DECIMAL,
    
    -- Sleep (in hours)
    sleep_hours DECIMAL,
    
    -- Workout summary
    workout_minutes INTEGER DEFAULT 0,
    workout_count INTEGER DEFAULT 0,
    
    -- Mindfulness
    mindfulness_minutes INTEGER DEFAULT 0,
    
    -- Metadata
    source TEXT DEFAULT 'Apple Health',
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    data_date DATE DEFAULT CURRENT_DATE,
    
    -- Store raw/detailed data as JSON if needed
    raw_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user_id (already unique, but for faster lookups)
CREATE INDEX IF NOT EXISTS idx_health_data_user_id ON health_data(user_id);
CREATE INDEX IF NOT EXISTS idx_health_data_date ON health_data(data_date);

-- Enable Row Level Security
ALTER TABLE health_data ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own health data" ON health_data;
DROP POLICY IF EXISTS "Users can insert own health data" ON health_data;
DROP POLICY IF EXISTS "Users can update own health data" ON health_data;
DROP POLICY IF EXISTS "Users can delete own health data" ON health_data;

-- Create RLS Policies
CREATE POLICY "Users can view own health data" ON health_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health data" ON health_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health data" ON health_data
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own health data" ON health_data
  FOR DELETE USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_health_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating timestamp
DROP TRIGGER IF EXISTS health_data_updated_at ON health_data;
CREATE TRIGGER health_data_updated_at
    BEFORE UPDATE ON health_data
    FOR EACH ROW
    EXECUTE FUNCTION update_health_data_updated_at();

-- ============================================
-- Done! Schema is ready for HealthKit sync
-- Each user will have ONE row that gets updated
-- ============================================
