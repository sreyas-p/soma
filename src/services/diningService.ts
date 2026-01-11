/**
 * UCSB Dining Menu Service
 * Query dining menu data from Supabase
 */

import { supabase } from '../lib/supabase';

// Types
export interface MenuItem {
  id: string;
  name: string;
  category: string;
  serving_size: string;
  dietary_tags: string[];
  calories: number;
  protein_g: number;
  total_fat_g: number;
  total_carbs_g: number;
  sodium_mg: number;
  dietary_fiber_g: number;
  sugars_g: number;
}

export interface MenuWithDetails extends MenuItem {
  dining_hall: string;
  meal_period: string;
  date: string;
}

export interface DiningHall {
  id: string;
  name: string;
  short_name: string;
}

// Get all dining halls
export async function getDiningHalls(): Promise<DiningHall[]> {
  const { data, error } = await supabase
    .from('dining_halls')
    .select('id, name, short_name');
  
  if (error) throw error;
  return data || [];
}

// Get today's menu for a dining hall
export async function getTodaysMenu(
  diningHall: string,
  mealPeriod?: string
): Promise<MenuWithDetails[]> {
  const today = new Date().toISOString().split('T')[0];
  
  let query = supabase
    .from('menu_items')
    .select(`
      *,
      menus!inner (
        date,
        meal_period,
        dining_halls!inner (
          short_name
        )
      )
    `)
    .eq('menus.date', today)
    .ilike('menus.dining_halls.short_name', `%${diningHall}%`);
  
  if (mealPeriod) {
    query = query.eq('menus.meal_period', mealPeriod);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  
  return (data || []).map(item => ({
    ...item,
    dining_hall: item.menus.dining_halls.short_name,
    meal_period: item.menus.meal_period,
    date: item.menus.date,
  }));
}

// Search menu items with filters
export async function searchMenuItems(options: {
  date?: string;
  diningHall?: string;
  mealPeriod?: string;
  dietaryTags?: string[];
  maxCalories?: number;
  minProtein?: number;
  searchTerm?: string;
}): Promise<MenuWithDetails[]> {
  const today = new Date().toISOString().split('T')[0];
  const date = options.date || today;
  
  let query = supabase
    .from('menu_items')
    .select(`
      *,
      menus!inner (
        date,
        meal_period,
        dining_halls!inner (
          short_name
        )
      )
    `)
    .eq('menus.date', date);
  
  if (options.diningHall) {
    query = query.ilike('menus.dining_halls.short_name', `%${options.diningHall}%`);
  }
  
  if (options.mealPeriod) {
    query = query.eq('menus.meal_period', options.mealPeriod);
  }
  
  if (options.maxCalories) {
    query = query.lte('calories', options.maxCalories);
  }
  
  if (options.minProtein) {
    query = query.gte('protein_g', options.minProtein);
  }
  
  if (options.searchTerm) {
    query = query.ilike('name', `%${options.searchTerm}%`);
  }
  
  if (options.dietaryTags && options.dietaryTags.length > 0) {
    query = query.contains('dietary_tags', options.dietaryTags);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  
  return (data || []).map(item => ({
    ...item,
    dining_hall: item.menus.dining_halls.short_name,
    meal_period: item.menus.meal_period,
    date: item.menus.date,
  }));
}

// Get vegan items
export async function getVeganItems(
  diningHall?: string,
  mealPeriod?: string
): Promise<MenuWithDetails[]> {
  return searchMenuItems({
    diningHall,
    mealPeriod,
    dietaryTags: ['vegan'],
  });
}

// Get high protein items (20g+)
export async function getHighProteinItems(
  minProtein: number = 20,
  diningHall?: string,
  mealPeriod?: string
): Promise<MenuWithDetails[]> {
  return searchMenuItems({
    diningHall,
    mealPeriod,
    minProtein,
  });
}

// Get low calorie items
export async function getLowCalorieItems(
  maxCalories: number = 300,
  diningHall?: string,
  mealPeriod?: string
): Promise<MenuWithDetails[]> {
  return searchMenuItems({
    diningHall,
    mealPeriod,
    maxCalories,
  });
}

// Get nutrition info for a specific item
export async function getNutritionInfo(itemName: string): Promise<MenuItem | null> {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('menu_items')
    .select(`
      *,
      menus!inner (
        date
      )
    `)
    .eq('menus.date', today)
    .ilike('name', `%${itemName}%`)
    .limit(1)
    .single();
  
  if (error) return null;
  return data;
}

// Helper: Format dietary tags as emojis
export function formatDietaryTags(tags: string[]): string {
  const emojiMap: Record<string, string> = {
    vegan: '🌱',
    vegetarian: '🥛',
    contains_nuts: '🥜',
    gluten_free: '🌾',
  };
  
  return tags.map(tag => emojiMap[tag] || tag).join(' ');
}

// Helper: Get current meal period based on time
export function getCurrentMealPeriod(): string {
  const hour = new Date().getHours();
  
  if (hour < 10) return 'Breakfast';
  if (hour < 14) return 'Lunch';
  if (hour < 17) return 'Lunch';
  return 'Dinner';
}
