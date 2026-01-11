-- Daily Plans Schema for Soma App
-- Workout Plans and Sleep Schedules with daily regeneration
-- Run this in your Supabase SQL Editor

-- ============================================
-- WORKOUT PLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS workout_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content JSONB NOT NULL, -- Stores the full workout plan structure
  day VARCHAR(20) NOT NULL, -- e.g., "Saturday", "Monday"
  plan_date DATE NOT NULL DEFAULT CURRENT_DATE, -- The date this plan is for
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one workout plan per user per day
  UNIQUE(user_id, plan_date)
);

-- Indexes for workout_plans
CREATE INDEX IF NOT EXISTS idx_workout_plans_user_id ON workout_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_plans_plan_date ON workout_plans(plan_date);
CREATE INDEX IF NOT EXISTS idx_workout_plans_user_date ON workout_plans(user_id, plan_date);

-- Enable RLS
ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workout_plans
CREATE POLICY "Users can view own workout plans" ON workout_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workout plans" ON workout_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workout plans" ON workout_plans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workout plans" ON workout_plans
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- SLEEP SCHEDULES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sleep_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content JSONB NOT NULL, -- Stores the full sleep schedule structure
  day VARCHAR(20) NOT NULL, -- e.g., "Saturday", "Monday"
  plan_date DATE NOT NULL DEFAULT CURRENT_DATE, -- The date this plan is for
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one sleep schedule per user per day
  UNIQUE(user_id, plan_date)
);

-- Indexes for sleep_schedules
CREATE INDEX IF NOT EXISTS idx_sleep_schedules_user_id ON sleep_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_sleep_schedules_plan_date ON sleep_schedules(plan_date);
CREATE INDEX IF NOT EXISTS idx_sleep_schedules_user_date ON sleep_schedules(user_id, plan_date);

-- Enable RLS
ALTER TABLE sleep_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sleep_schedules
CREATE POLICY "Users can view own sleep schedules" ON sleep_schedules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sleep schedules" ON sleep_schedules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sleep schedules" ON sleep_schedules
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sleep schedules" ON sleep_schedules
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- UPDATE MEAL_PLANS TABLE (add plan_date for consistency)
-- ============================================
-- Add plan_date column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meal_plans' AND column_name = 'plan_date'
  ) THEN
    ALTER TABLE meal_plans ADD COLUMN plan_date DATE DEFAULT CURRENT_DATE;
    
    -- Update existing rows to have plan_date based on created_at
    UPDATE meal_plans SET plan_date = DATE(created_at) WHERE plan_date IS NULL;
  END IF;
END $$;

-- Clean up duplicate meal plans (keep only the most recent one per user per day)
DELETE FROM meal_plans a
USING meal_plans b
WHERE a.user_id = b.user_id 
  AND a.plan_date = b.plan_date 
  AND a.updated_at < b.updated_at;

-- Add unique constraint for user + date (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_meal_plan_user_date'
  ) THEN
    ALTER TABLE meal_plans ADD CONSTRAINT unique_meal_plan_user_date UNIQUE (user_id, plan_date);
  END IF;
END $$;

-- Create index for meal_plans plan_date
CREATE INDEX IF NOT EXISTS idx_meal_plans_plan_date ON meal_plans(plan_date);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_date ON meal_plans(user_id, plan_date);

-- ============================================
-- UPDATED_AT TRIGGER (reusable)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to workout_plans
DROP TRIGGER IF EXISTS update_workout_plans_updated_at ON workout_plans;
CREATE TRIGGER update_workout_plans_updated_at
  BEFORE UPDATE ON workout_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to sleep_schedules
DROP TRIGGER IF EXISTS update_sleep_schedules_updated_at ON sleep_schedules;
CREATE TRIGGER update_sleep_schedules_updated_at
  BEFORE UPDATE ON sleep_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CLEANUP OLD PLANS (optional - run periodically)
-- ============================================
-- This function can be called to clean up plans older than 7 days
CREATE OR REPLACE FUNCTION cleanup_old_plans()
RETURNS void AS $$
BEGIN
  DELETE FROM meal_plans WHERE plan_date < CURRENT_DATE - INTERVAL '7 days';
  DELETE FROM workout_plans WHERE plan_date < CURRENT_DATE - INTERVAL '7 days';
  DELETE FROM sleep_schedules WHERE plan_date < CURRENT_DATE - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
