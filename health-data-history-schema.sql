-- Health Data History Table for tracking historical Apple Health data
-- Creates a new entry every 5 minutes for historical tracking

-- Create the health_data_history table
CREATE TABLE IF NOT EXISTS health_data_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_date DATE NOT NULL,
    
    -- Activity metrics
    steps INTEGER,
    distance DECIMAL(10, 2),
    calories DECIMAL(10, 2),
    
    -- Vitals
    heart_rate INTEGER,
    heart_rate_min INTEGER,
    heart_rate_max INTEGER,
    
    -- Body measurements
    weight DECIMAL(6, 2),
    height DECIMAL(5, 2),
    bmi DECIMAL(4, 2),
    
    -- Sleep
    sleep_hours DECIMAL(4, 2),
    sleep_quality VARCHAR(20),
    
    -- Exercise
    workout_minutes INTEGER,
    workout_count INTEGER,
    mindfulness_minutes INTEGER,
    
    -- Blood pressure and glucose (optional)
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,
    blood_glucose DECIMAL(6, 2),
    
    -- Metadata
    source VARCHAR(50) DEFAULT 'Apple Health',
    raw_data JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_health_history_user_id ON health_data_history(user_id);
CREATE INDEX IF NOT EXISTS idx_health_history_recorded_at ON health_data_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_history_user_recorded ON health_data_history(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_history_data_date ON health_data_history(data_date);

-- Enable Row Level Security
ALTER TABLE health_data_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own data
CREATE POLICY "Users can view own health history" ON health_data_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health history" ON health_data_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health history" ON health_data_history
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own health history" ON health_data_history
    FOR DELETE USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE health_data_history IS 'Historical health data from Apple Health, recorded every 5 minutes';
COMMENT ON COLUMN health_data_history.recorded_at IS 'Timestamp when this snapshot was recorded';
COMMENT ON COLUMN health_data_history.data_date IS 'The date this health data represents';

-- Optional: Function to clean up old data (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_health_history()
RETURNS void AS $$
BEGIN
    DELETE FROM health_data_history
    WHERE recorded_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Schedule cleanup (run this manually or via pg_cron if available)
-- SELECT cron.schedule('cleanup-health-history', '0 3 * * *', 'SELECT cleanup_old_health_history()');
