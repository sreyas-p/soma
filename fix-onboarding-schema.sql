-- Quick fix: Add missing columns to onboarding_data table
-- Run this in Supabase SQL Editor

-- Add data_source column
ALTER TABLE public.onboarding_data 
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'manual';

-- Add other potentially missing columns used by the app
ALTER TABLE public.onboarding_data 
ADD COLUMN IF NOT EXISTS comprehensive_data JSONB DEFAULT NULL;

ALTER TABLE public.onboarding_data 
ADD COLUMN IF NOT EXISTS historical_data JSONB DEFAULT NULL;

ALTER TABLE public.onboarding_data 
ADD COLUMN IF NOT EXISTS recent_data JSONB DEFAULT NULL;

ALTER TABLE public.onboarding_data 
ADD COLUMN IF NOT EXISTS user_goals JSONB DEFAULT NULL;

-- Done!
SELECT 'Columns added successfully!' as result;
