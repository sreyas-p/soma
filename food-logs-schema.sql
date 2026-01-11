-- Food Logs Schema for Soma App
-- Stores scanned food entries from the Food Scanner feature
-- Run this in your Supabase SQL Editor

-- ============================================
-- FOOD LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS food_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Meal info
  meal_period VARCHAR(20) NOT NULL, -- 'breakfast', 'lunch', 'dinner', 'snacks'
  meal_description TEXT,
  day_name VARCHAR(20), -- e.g., "Saturday", "Monday"
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Food items (JSONB array)
  food_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Each item: { name, portion_size, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, confidence }
  
  -- Totals
  total_calories NUMERIC(8, 2) DEFAULT 0,
  total_protein NUMERIC(8, 2) DEFAULT 0,
  total_carbs NUMERIC(8, 2) DEFAULT 0,
  total_fat NUMERIC(8, 2) DEFAULT 0,
  
  -- Health notes from AI analysis
  health_notes JSONB DEFAULT '[]'::jsonb,
  
  -- Source info
  source VARCHAR(50) DEFAULT 'food_scanner', -- 'food_scanner', 'manual', 'nutri_agent'
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for food_logs
CREATE INDEX IF NOT EXISTS idx_food_logs_user_id ON food_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_food_logs_log_date ON food_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_food_logs_meal_period ON food_logs(meal_period);
CREATE INDEX IF NOT EXISTS idx_food_logs_user_date ON food_logs(user_id, log_date);

-- Enable RLS
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for food_logs
CREATE POLICY "Users can view own food logs" ON food_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own food logs" ON food_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own food logs" ON food_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own food logs" ON food_logs
  FOR DELETE USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_food_logs_updated_at
  BEFORE UPDATE ON food_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER VIEW: Daily nutrition summary
-- ============================================
CREATE OR REPLACE VIEW daily_nutrition_summary AS
SELECT 
  user_id,
  log_date,
  COUNT(*) as meal_count,
  SUM(total_calories) as daily_calories,
  SUM(total_protein) as daily_protein,
  SUM(total_carbs) as daily_carbs,
  SUM(total_fat) as daily_fat,
  array_agg(DISTINCT meal_period) as meals_logged
FROM food_logs
GROUP BY user_id, log_date;

-- Grant access to the view
GRANT SELECT ON daily_nutrition_summary TO authenticated;
