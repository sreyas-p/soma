-- ============================================
-- Updated Schema for Soma Health App
-- Adds historical_data and recent_data columns
-- Run this in Supabase SQL Editor
-- ============================================

-- Add new columns to onboarding_data table for structured data storage
ALTER TABLE public.onboarding_data 
ADD COLUMN IF NOT EXISTS historical_data JSONB DEFAULT NULL;

ALTER TABLE public.onboarding_data 
ADD COLUMN IF NOT EXISTS recent_data JSONB DEFAULT NULL;

ALTER TABLE public.onboarding_data 
ADD COLUMN IF NOT EXISTS user_goals JSONB DEFAULT NULL;

ALTER TABLE public.onboarding_data 
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'manual' CHECK (data_source IN ('manual', 'ehr_upload'));

-- Add indexes for the new JSONB columns
CREATE INDEX IF NOT EXISTS idx_onboarding_historical_data ON public.onboarding_data USING GIN (historical_data);
CREATE INDEX IF NOT EXISTS idx_onboarding_recent_data ON public.onboarding_data USING GIN (recent_data);
CREATE INDEX IF NOT EXISTS idx_onboarding_user_goals ON public.onboarding_data USING GIN (user_goals);

-- Add comments for documentation
COMMENT ON COLUMN public.onboarding_data.historical_data IS 'Long-term health data: genetic conditions, chronic diseases, family history, allergies, past surgeries';
COMMENT ON COLUMN public.onboarding_data.recent_data IS 'Current/temporary health data: current weight, height, active prescriptions, recent vitals';
COMMENT ON COLUMN public.onboarding_data.user_goals IS 'User health goals and objectives';
COMMENT ON COLUMN public.onboarding_data.data_source IS 'Source of onboarding data: manual entry or EHR upload';

-- ============================================
-- HISTORICAL DATA STRUCTURE (stored in historical_data column):
-- {
--   "genetic_conditions": [
--     { "name": "...", "inherited_from": "mother|father|both", "notes": "..." }
--   ],
--   "chronic_diseases": [
--     { "name": "...", "diagnosed_date": "...", "status": "active|managed|resolved" }
--   ],
--   "family_history": [
--     { "relationship": "...", "conditions": [...] }
--   ],
--   "allergies": [
--     { "allergen": "...", "type": "...", "severity": "...", "reaction": "..." }
--   ],
--   "past_surgeries": [
--     { "name": "...", "date": "...", "hospital": "...", "outcome": "..." }
--   ],
--   "blood_type": "A+|A-|B+|B-|AB+|AB-|O+|O-|unknown"
-- }
-- ============================================

-- ============================================
-- RECENT DATA STRUCTURE (stored in recent_data column):
-- {
--   "measurements": {
--     "height": { "value": 68, "unit": "inches", "recorded_at": "..." },
--     "weight": { "value": 150, "unit": "lbs", "recorded_at": "..." },
--     "bmi": { "value": 22.8, "recorded_at": "..." }
--   },
--   "vitals": {
--     "blood_pressure": { "systolic": 120, "diastolic": 80, "recorded_at": "..." },
--     "heart_rate": { "value": 72, "unit": "bpm", "recorded_at": "..." }
--   },
--   "current_medications": [
--     { "name": "...", "dosage": "...", "frequency": "...", "temporary": true, "start_date": "...", "end_date": "..." }
--   ],
--   "lifestyle": {
--     "activity_level": "...",
--     "sleep_hours": 7,
--     "sleep_quality": "...",
--     "stress_level": 5,
--     "smoking_status": "...",
--     "alcohol_frequency": "..."
--   }
-- }
-- ============================================

-- ============================================
-- USER GOALS STRUCTURE (stored in user_goals column):
-- {
--   "primary_focus": "weight|fitness|nutrition|sleep|mental_health|chronic_disease|recovery|preventive",
--   "goals": [
--     {
--       "id": "...",
--       "title": "...",
--       "description": "...",
--       "category": "...",
--       "target_value": 10000,
--       "target_unit": "steps",
--       "target_date": "...",
--       "priority": "low|medium|high"
--     }
--   ],
--   "motivations": ["..."],
--   "challenges": ["..."],
--   "free_form_goals": "User's custom goals in their own words"
-- }
-- ============================================

-- Done! Schema updated successfully.
