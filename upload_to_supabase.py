#!/usr/bin/env python3
"""
Upload UCSB Dining Menu Data to Supabase

Reads the scraped nutrition.json file and uploads it to Supabase database.
Uses batch inserts for performance.
"""

import json
import os
import time
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY in environment variables")


def get_supabase_client() -> Client:
    """Create and return Supabase client."""
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_or_create_dining_hall(supabase: Client, name: str, short_name: str) -> str:
    """Get existing dining hall ID or create new one."""
    # Try to get existing
    result = supabase.table("dining_halls").select("id").eq("short_name", short_name).execute()
    
    if result.data:
        return result.data[0]["id"]
    
    # Create new
    result = supabase.table("dining_halls").insert({
        "name": name,
        "short_name": short_name
    }).execute()
    
    return result.data[0]["id"]


def get_or_create_menu(
    supabase: Client,
    dining_hall_id: str,
    date: str,
    meal_period: str
) -> str:
    """Get existing menu ID or create new one. Deletes old items if menu exists."""
    # Try to get existing menu
    result = supabase.table("menus").select("id").eq(
        "dining_hall_id", dining_hall_id
    ).eq("date", date).eq("meal_period", meal_period).execute()
    
    if result.data:
        menu_id = result.data[0]["id"]
        # Delete existing menu items to replace with new data
        supabase.table("menu_items").delete().eq("menu_id", menu_id).execute()
        # Update the updated_at timestamp
        supabase.table("menus").update({"updated_at": datetime.now().isoformat()}).eq("id", menu_id).execute()
        return menu_id
    
    # Create new menu
    result = supabase.table("menus").insert({
        "dining_hall_id": dining_hall_id,
        "date": date,
        "meal_period": meal_period
    }).execute()
    
    return result.data[0]["id"]


def prepare_menu_item(item: dict, menu_id: str) -> dict:
    """Prepare a menu item record for insertion."""
    nutrition = item.get("nutrition_facts", {})
    
    return {
        "menu_id": menu_id,
        "category": item.get("category", "Uncategorized"),
        "name": item.get("name", ""),
        "serving_size": item.get("serving_size", ""),
        "dietary_tags": item.get("dietary_tags", []),
        
        # Flattened nutrition facts
        "calories": nutrition.get("calories"),
        "calories_from_fat": nutrition.get("calories_from_fat"),
        "total_fat_g": nutrition.get("total_fat_g"),
        "total_fat_dv": nutrition.get("total_fat_dv"),
        "saturated_fat_g": nutrition.get("saturated_fat_g"),
        "saturated_fat_dv": nutrition.get("saturated_fat_dv"),
        "trans_fat_g": nutrition.get("trans_fat_g", 0),
        "cholesterol_mg": nutrition.get("cholesterol_mg"),
        "cholesterol_dv": nutrition.get("cholesterol_dv"),
        "sodium_mg": nutrition.get("sodium_mg"),
        "sodium_dv": nutrition.get("sodium_dv"),
        "total_carbs_g": nutrition.get("total_carbs_g"),
        "total_carbs_dv": nutrition.get("total_carbs_dv"),
        "dietary_fiber_g": nutrition.get("dietary_fiber_g"),
        "dietary_fiber_dv": nutrition.get("dietary_fiber_dv"),
        "sugars_g": nutrition.get("sugars_g"),
        "protein_g": nutrition.get("protein_g"),
        "vitamin_a_dv": nutrition.get("vitamin_a_dv"),
        "vitamin_c_dv": nutrition.get("vitamin_c_dv"),
        "calcium_dv": nutrition.get("calcium_dv"),
        "iron_dv": nutrition.get("iron_dv"),
        
        # Full nutrition as JSONB
        "nutrition_facts": nutrition
    }


def batch_insert_items(supabase: Client, items: list, batch_size: int = 50) -> int:
    """Insert items in batches for better performance."""
    total_inserted = 0
    
    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        try:
            result = supabase.table("menu_items").insert(batch).execute()
            total_inserted += len(result.data)
        except Exception as e:
            print(f"  Error inserting batch {i//batch_size + 1}: {e}")
            # Try inserting one by one to identify problematic items
            for item in batch:
                try:
                    supabase.table("menu_items").insert(item).execute()
                    total_inserted += 1
                except Exception as e2:
                    print(f"    Failed to insert item '{item.get('name')}': {e2}")
    
    return total_inserted


def upload_nutrition_data(
    nutrition_file: str = "nutrition.json",
    supabase: Optional[Client] = None
) -> dict:
    """
    Main function to upload nutrition data to Supabase.
    
    Returns:
        dict with upload statistics
    """
    start_time = time.time()
    
    if supabase is None:
        supabase = get_supabase_client()
    
    # Load nutrition data
    print(f"Loading data from {nutrition_file}...")
    with open(nutrition_file, "r") as f:
        data = json.load(f)
    
    menu_date = data.get("date")
    items = data.get("items", [])
    
    print(f"Found {len(items)} items for date {menu_date}")
    
    stats = {
        "menu_date": menu_date,
        "total_items": len(items),
        "items_uploaded": 0,
        "dining_halls": set(),
        "meals": set(),
        "errors": []
    }
    
    # Group items by dining hall and meal
    grouped = {}
    for item in items:
        hall = item.get("dining_hall")
        meal = item.get("meal")
        key = (hall, meal)
        
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(item)
    
    print(f"\nUploading to Supabase...")
    print(f"URL: {SUPABASE_URL}")
    
    # Process each dining hall + meal combination
    for (hall_short_name, meal_period), hall_items in grouped.items():
        print(f"\n  {hall_short_name} - {meal_period}: {len(hall_items)} items")
        
        try:
            # Map short name to full name
            hall_name_map = {
                "Carrillo": "Carrillo Dining Commons",
                "De La Guerra": "De La Guerra Dining Commons",
                "Portola": "Portola Dining Commons",
                "Ortega": "Takeout at Ortega Commons"
            }
            hall_name = hall_name_map.get(hall_short_name, f"{hall_short_name} Dining Commons")
            
            # Get or create dining hall
            dining_hall_id = get_or_create_dining_hall(supabase, hall_name, hall_short_name)
            stats["dining_halls"].add(hall_short_name)
            
            # Get or create menu
            menu_id = get_or_create_menu(supabase, dining_hall_id, menu_date, meal_period)
            stats["meals"].add(meal_period)
            
            # Prepare items for insertion
            prepared_items = [prepare_menu_item(item, menu_id) for item in hall_items]
            
            # Batch insert items
            inserted = batch_insert_items(supabase, prepared_items)
            stats["items_uploaded"] += inserted
            print(f"    Uploaded {inserted} items")
            
        except Exception as e:
            error_msg = f"{hall_short_name} - {meal_period}: {str(e)}"
            stats["errors"].append(error_msg)
            print(f"    Error: {e}")
    
    # Record scrape metadata
    duration = time.time() - start_time
    try:
        supabase.table("scrape_metadata").insert({
            "menu_date": menu_date,
            "source": "netnutrition",
            "status": "success" if not stats["errors"] else "partial",
            "items_count": stats["items_uploaded"],
            "dining_halls_count": len(stats["dining_halls"]),
            "errors": stats["errors"],
            "duration_seconds": round(duration, 2)
        }).execute()
    except Exception as e:
        print(f"\nWarning: Could not save scrape metadata: {e}")
    
    stats["duration_seconds"] = round(duration, 2)
    stats["dining_halls"] = list(stats["dining_halls"])
    stats["meals"] = list(stats["meals"])
    
    return stats


def query_menu(
    date: str = None,
    dining_hall: str = None,
    meal_period: str = None,
    supabase: Optional[Client] = None
) -> list:
    """
    Query menu items from Supabase.
    
    Args:
        date: Menu date (YYYY-MM-DD), defaults to today
        dining_hall: Short name like "Carrillo"
        meal_period: "Breakfast", "Lunch", "Dinner", "Brunch"
    
    Returns:
        List of menu items
    """
    if supabase is None:
        supabase = get_supabase_client()
    
    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")
    
    # Build query
    query = supabase.table("menu_items").select(
        "*, menus!inner(date, meal_period, dining_halls!inner(short_name))"
    ).eq("menus.date", date)
    
    if dining_hall:
        query = query.eq("menus.dining_halls.short_name", dining_hall)
    
    if meal_period:
        query = query.eq("menus.meal_period", meal_period)
    
    result = query.execute()
    return result.data


def search_items_by_nutrition(
    max_calories: int = None,
    min_protein: int = None,
    dietary_tag: str = None,
    date: str = None,
    supabase: Optional[Client] = None
) -> list:
    """
    Search menu items by nutrition criteria.
    
    Args:
        max_calories: Maximum calories
        min_protein: Minimum protein in grams
        dietary_tag: Tag like "vegan", "vegetarian"
        date: Menu date, defaults to today
    
    Returns:
        List of matching items
    """
    if supabase is None:
        supabase = get_supabase_client()
    
    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")
    
    query = supabase.table("menu_items").select(
        "name, serving_size, calories, protein_g, dietary_tags, "
        "menus!inner(date, meal_period, dining_halls!inner(short_name))"
    ).eq("menus.date", date)
    
    if max_calories:
        query = query.lte("calories", max_calories)
    
    if min_protein:
        query = query.gte("protein_g", min_protein)
    
    if dietary_tag:
        query = query.contains("dietary_tags", [dietary_tag])
    
    result = query.order("calories").execute()
    return result.data


def main():
    print("=" * 60)
    print("UCSB Dining Menu - Supabase Upload")
    print("=" * 60)
    
    stats = upload_nutrition_data()
    
    print("\n" + "=" * 60)
    print("Upload Complete!")
    print("=" * 60)
    print(f"  Menu Date: {stats['menu_date']}")
    print(f"  Total Items: {stats['total_items']}")
    print(f"  Items Uploaded: {stats['items_uploaded']}")
    print(f"  Dining Halls: {', '.join(stats['dining_halls'])}")
    print(f"  Meals: {', '.join(stats['meals'])}")
    print(f"  Duration: {stats['duration_seconds']}s")
    
    if stats["errors"]:
        print(f"\nErrors ({len(stats['errors'])}):")
        for error in stats["errors"]:
            print(f"  - {error}")
    
    # Test query
    print("\n" + "-" * 60)
    print("Testing Query: High protein items (20g+) for today")
    print("-" * 60)
    
    try:
        items = search_items_by_nutrition(min_protein=20, date=stats['menu_date'])
        for item in items[:5]:
            name = item.get("name")
            protein = item.get("protein_g")
            calories = item.get("calories")
            print(f"  {name}: {protein}g protein, {calories} cal")
        if len(items) > 5:
            print(f"  ... and {len(items) - 5} more items")
    except Exception as e:
        print(f"  Query failed: {e}")


if __name__ == "__main__":
    main()
