-- Health Data Schema for Aware Health App
-- Run this in your Supabase SQL Editor

-- Create health_data table
CREATE TABLE IF NOT EXISTS public.health_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  data_type TEXT NOT NULL CHECK (data_type IN (
    'steps', 'distance', 'calories', 'heartRate', 'bloodPressure',
    'sleep', 'weight', 'height', 'bmi', 'workout', 'mindfulness', 'nutrition'
  )),
  value DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  source TEXT NOT NULL DEFAULT 'Apple Health',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_health_data_user_id ON public.health_data(user_id);
CREATE INDEX IF NOT EXISTS idx_health_data_type ON public.health_data(data_type);
CREATE INDEX IF NOT EXISTS idx_health_data_date_range ON public.health_data(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_health_data_user_type ON public.health_data(user_id, data_type);

-- Enable Row Level Security
ALTER TABLE public.health_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for health_data table
DROP POLICY IF EXISTS "Users can view own health data" ON public.health_data;
CREATE POLICY "Users can view own health data" ON public.health_data
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own health data" ON public.health_data;
CREATE POLICY "Users can insert own health data" ON public.health_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own health data" ON public.health_data;
CREATE POLICY "Users can update own health data" ON public.health_data
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own health data" ON public.health_data;
CREATE POLICY "Users can delete own health data" ON public.health_data
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_health_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_health_data_updated_at ON public.health_data;
CREATE TRIGGER update_health_data_updated_at
  BEFORE UPDATE ON public.health_data
  FOR EACH ROW EXECUTE FUNCTION public.update_health_data_updated_at();

-- Create view for aggregated health data
CREATE OR REPLACE VIEW public.health_data_summary AS
SELECT
  user_id,
  data_type,
  COUNT(*) as record_count,
  AVG(value) as average_value,
  MIN(value) as min_value,
  MAX(value) as max_value,
  MIN(start_date) as first_record,
  MAX(end_date) as last_record
FROM public.health_data
GROUP BY user_id, data_type;

-- Grant access to the view
GRANT SELECT ON public.health_data_summary TO authenticated;
