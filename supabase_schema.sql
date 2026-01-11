-- UCSB Dining Menu Database Schema for Supabase
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE 1: Dining Halls
-- ============================================
CREATE TABLE IF NOT EXISTS dining_halls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  short_name TEXT NOT NULL UNIQUE,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by short name
CREATE INDEX IF NOT EXISTS idx_dining_halls_short_name ON dining_halls(short_name);

-- Insert the 4 main dining halls
INSERT INTO dining_halls (name, short_name) VALUES
  ('Carrillo Dining Commons', 'Carrillo'),
  ('De La Guerra Dining Commons', 'De La Guerra'),
  ('Portola Dining Commons', 'Portola'),
  ('Takeout at Ortega Commons', 'Ortega')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- TABLE 2: Menus (per dining hall, date, meal)
-- ============================================
CREATE TABLE IF NOT EXISTS menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dining_hall_id UUID NOT NULL REFERENCES dining_halls(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_period TEXT NOT NULL CHECK (meal_period IN ('Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Late Night')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate menus
  UNIQUE(dining_hall_id, date, meal_period)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_menus_date ON menus(date);
CREATE INDEX IF NOT EXISTS idx_menus_meal_period ON menus(meal_period);
CREATE INDEX IF NOT EXISTS idx_menus_dining_hall_date ON menus(dining_hall_id, date);
CREATE INDEX IF NOT EXISTS idx_menus_composite ON menus(dining_hall_id, date, meal_period);

-- ============================================
-- TABLE 3: Menu Items with Nutrition Facts
-- ============================================
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  category TEXT DEFAULT 'Uncategorized',
  name TEXT NOT NULL,
  serving_size TEXT,
  dietary_tags TEXT[] DEFAULT '{}',
  
  -- Nutrition facts (flattened for easy querying)
  calories INTEGER,
  calories_from_fat INTEGER,
  total_fat_g DECIMAL(6,1),
  total_fat_dv INTEGER,
  saturated_fat_g DECIMAL(6,1),
  saturated_fat_dv INTEGER,
  trans_fat_g DECIMAL(6,1) DEFAULT 0,
  cholesterol_mg INTEGER,
  cholesterol_dv INTEGER,
  sodium_mg INTEGER,
  sodium_dv INTEGER,
  total_carbs_g INTEGER,
  total_carbs_dv INTEGER,
  dietary_fiber_g DECIMAL(6,1),
  dietary_fiber_dv INTEGER,
  sugars_g INTEGER,
  protein_g INTEGER,
  vitamin_a_dv INTEGER,
  vitamin_c_dv INTEGER,
  calcium_dv INTEGER,
  iron_dv INTEGER,
  
  -- Store full nutrition as JSONB for flexibility
  nutrition_facts JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for menu items
CREATE INDEX IF NOT EXISTS idx_menu_items_menu_id ON menu_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_name ON menu_items(name);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_items_calories ON menu_items(calories);
CREATE INDEX IF NOT EXISTS idx_menu_items_protein ON menu_items(protein_g);

-- GIN index for dietary tags array search
CREATE INDEX IF NOT EXISTS idx_menu_items_dietary_tags ON menu_items USING GIN(dietary_tags);

-- GIN index for JSONB nutrition facts
CREATE INDEX IF NOT EXISTS idx_menu_items_nutrition ON menu_items USING GIN(nutrition_facts);

-- Full-text search on item names
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(category, ''))) STORED;
CREATE INDEX IF NOT EXISTS idx_menu_items_search ON menu_items USING GIN(search_vector);

-- ============================================
-- TABLE 4: Scrape Metadata (tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS scrape_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scrape_date TIMESTAMPTZ DEFAULT NOW(),
  menu_date DATE NOT NULL,
  source TEXT DEFAULT 'netnutrition',
  status TEXT DEFAULT 'success',
  items_count INTEGER DEFAULT 0,
  dining_halls_count INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  duration_seconds DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrape_metadata_menu_date ON scrape_metadata(menu_date);

-- ============================================
-- VIEWS for AI Agent Queries
-- ============================================

-- View: Today's full menu
CREATE OR REPLACE VIEW todays_menu AS
SELECT 
  dh.short_name as dining_hall,
  m.meal_period,
  mi.category,
  mi.name as item_name,
  mi.serving_size,
  mi.dietary_tags,
  mi.calories,
  mi.protein_g,
  mi.total_fat_g,
  mi.total_carbs_g,
  mi.sodium_mg
FROM menu_items mi
JOIN menus m ON mi.menu_id = m.id
JOIN dining_halls dh ON m.dining_hall_id = dh.id
WHERE m.date = CURRENT_DATE
ORDER BY dh.short_name, m.meal_period, mi.category, mi.name;

-- View: High protein items (20g+)
CREATE OR REPLACE VIEW high_protein_items AS
SELECT 
  dh.short_name as dining_hall,
  m.date,
  m.meal_period,
  mi.name,
  mi.serving_size,
  mi.protein_g,
  mi.calories,
  mi.dietary_tags
FROM menu_items mi
JOIN menus m ON mi.menu_id = m.id
JOIN dining_halls dh ON m.dining_hall_id = dh.id
WHERE mi.protein_g >= 20
ORDER BY mi.protein_g DESC;

-- View: Vegan items
CREATE OR REPLACE VIEW vegan_items AS
SELECT 
  dh.short_name as dining_hall,
  m.date,
  m.meal_period,
  mi.name,
  mi.serving_size,
  mi.calories,
  mi.protein_g
FROM menu_items mi
JOIN menus m ON mi.menu_id = m.id
JOIN dining_halls dh ON m.dining_hall_id = dh.id
WHERE 'vegan' = ANY(mi.dietary_tags)
ORDER BY m.date DESC, dh.short_name;

-- View: Low calorie items (under 300 cal)
CREATE OR REPLACE VIEW low_calorie_items AS
SELECT 
  dh.short_name as dining_hall,
  m.date,
  m.meal_period,
  mi.name,
  mi.serving_size,
  mi.calories,
  mi.protein_g,
  mi.dietary_tags
FROM menu_items mi
JOIN menus m ON mi.menu_id = m.id
JOIN dining_halls dh ON m.dining_hall_id = dh.id
WHERE mi.calories < 300 AND mi.calories > 0
ORDER BY mi.calories ASC;

-- ============================================
-- FUNCTIONS for AI Agent Queries
-- ============================================

-- Function: Get menu by date, hall, and meal
CREATE OR REPLACE FUNCTION get_menu(
  p_date DATE,
  p_dining_hall TEXT DEFAULT NULL,
  p_meal_period TEXT DEFAULT NULL
)
RETURNS TABLE (
  dining_hall TEXT,
  meal_period TEXT,
  category TEXT,
  item_name TEXT,
  serving_size TEXT,
  dietary_tags TEXT[],
  calories INTEGER,
  protein_g INTEGER,
  total_fat_g DECIMAL,
  total_carbs_g INTEGER,
  sodium_mg INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dh.short_name,
    m.meal_period,
    mi.category,
    mi.name,
    mi.serving_size,
    mi.dietary_tags,
    mi.calories,
    mi.protein_g,
    mi.total_fat_g,
    mi.total_carbs_g,
    mi.sodium_mg
  FROM menu_items mi
  JOIN menus m ON mi.menu_id = m.id
  JOIN dining_halls dh ON m.dining_hall_id = dh.id
  WHERE m.date = p_date
    AND (p_dining_hall IS NULL OR dh.short_name ILIKE p_dining_hall)
    AND (p_meal_period IS NULL OR m.meal_period ILIKE p_meal_period)
  ORDER BY dh.short_name, m.meal_period, mi.category, mi.name;
END;
$$ LANGUAGE plpgsql;

-- Function: Search items by nutrition criteria
CREATE OR REPLACE FUNCTION search_by_nutrition(
  p_date DATE DEFAULT CURRENT_DATE,
  p_max_calories INTEGER DEFAULT NULL,
  p_min_protein INTEGER DEFAULT NULL,
  p_max_sodium INTEGER DEFAULT NULL,
  p_dietary_tag TEXT DEFAULT NULL
)
RETURNS TABLE (
  dining_hall TEXT,
  meal_period TEXT,
  item_name TEXT,
  serving_size TEXT,
  dietary_tags TEXT[],
  calories INTEGER,
  protein_g INTEGER,
  sodium_mg INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dh.short_name,
    m.meal_period,
    mi.name,
    mi.serving_size,
    mi.dietary_tags,
    mi.calories,
    mi.protein_g,
    mi.sodium_mg
  FROM menu_items mi
  JOIN menus m ON mi.menu_id = m.id
  JOIN dining_halls dh ON m.dining_hall_id = dh.id
  WHERE m.date = p_date
    AND (p_max_calories IS NULL OR mi.calories <= p_max_calories)
    AND (p_min_protein IS NULL OR mi.protein_g >= p_min_protein)
    AND (p_max_sodium IS NULL OR mi.sodium_mg <= p_max_sodium)
    AND (p_dietary_tag IS NULL OR p_dietary_tag = ANY(mi.dietary_tags))
  ORDER BY mi.calories ASC;
END;
$$ LANGUAGE plpgsql;

-- Function: Full-text search on item names
CREATE OR REPLACE FUNCTION search_items(
  p_query TEXT,
  p_date DATE DEFAULT NULL
)
RETURNS TABLE (
  dining_hall TEXT,
  date DATE,
  meal_period TEXT,
  item_name TEXT,
  serving_size TEXT,
  calories INTEGER,
  protein_g INTEGER,
  dietary_tags TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dh.short_name,
    m.date,
    m.meal_period,
    mi.name,
    mi.serving_size,
    mi.calories,
    mi.protein_g,
    mi.dietary_tags
  FROM menu_items mi
  JOIN menus m ON mi.menu_id = m.id
  JOIN dining_halls dh ON m.dining_hall_id = dh.id
  WHERE mi.search_vector @@ plainto_tsquery('english', p_query)
    AND (p_date IS NULL OR m.date = p_date)
  ORDER BY ts_rank(mi.search_vector, plainto_tsquery('english', p_query)) DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE dining_halls ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_metadata ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for AI agents)
CREATE POLICY "Allow public read access to dining_halls" ON dining_halls
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to menus" ON menus
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to menu_items" ON menu_items
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to scrape_metadata" ON scrape_metadata
  FOR SELECT USING (true);

-- Allow service role full access (for upload script)
CREATE POLICY "Allow service role full access to dining_halls" ON dining_halls
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to menus" ON menus
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to menu_items" ON menu_items
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to scrape_metadata" ON scrape_metadata
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- TRIGGERS for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_menus_updated_at
  BEFORE UPDATE ON menus
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_menu_items_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant usage to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
