#!/usr/bin/env python3
"""
UCSB Dining Menu Query Functions for AI Agents

Provides functions that AI agents can call to query the Supabase database
for menu items, nutrition info, and dietary filtering.
"""

import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Cache for today's menu
_menu_cache: Dict[str, Any] = {}
_cache_timestamp: Optional[datetime] = None
CACHE_TTL_MINUTES = 60


def get_supabase() -> Client:
    """Get Supabase client instance."""
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def _get_today() -> str:
    """Get today's date as string."""
    return datetime.now().strftime("%Y-%m-%d")


def _should_refresh_cache() -> bool:
    """Check if cache should be refreshed."""
    if _cache_timestamp is None:
        return True
    return datetime.now() - _cache_timestamp > timedelta(minutes=CACHE_TTL_MINUTES)


def _normalize_dining_hall(hall: str) -> str:
    """Normalize dining hall name variations."""
    hall_lower = hall.lower().strip()
    
    mappings = {
        "carrillo": "Carrillo",
        "dlg": "De La Guerra",
        "de la guerra": "De La Guerra",
        "delageurra": "De La Guerra",
        "portola": "Portola",
        "ortega": "Ortega",
    }
    
    for key, value in mappings.items():
        if key in hall_lower:
            return value
    
    return hall.title()


def _format_item(item: dict) -> dict:
    """Format a menu item for AI consumption."""
    return {
        "name": item.get("name"),
        "category": item.get("category"),
        "serving_size": item.get("serving_size"),
        "dietary_tags": item.get("dietary_tags", []),
        "calories": item.get("calories"),
        "protein_g": item.get("protein_g"),
        "total_fat_g": item.get("total_fat_g"),
        "total_carbs_g": item.get("total_carbs_g"),
        "sodium_mg": item.get("sodium_mg"),
        "dietary_fiber_g": item.get("dietary_fiber_g"),
        "sugars_g": item.get("sugars_g"),
    }


# ============================================
# AI Agent Query Functions
# ============================================

def get_dining_halls() -> List[Dict[str, str]]:
    """
    Get list of all dining halls.
    
    Returns:
        List of dining hall objects with name and short_name
    """
    supabase = get_supabase()
    result = supabase.table("dining_halls").select("name, short_name").execute()
    return result.data


def get_meal_periods(
    date: Optional[str] = None,
    dining_hall: Optional[str] = None
) -> List[str]:
    """
    Get available meal periods for a date/dining hall.
    
    Args:
        date: Date string (YYYY-MM-DD), defaults to today
        dining_hall: Dining hall short name (optional)
    
    Returns:
        List of meal period strings
    """
    if date is None:
        date = _get_today()
    
    supabase = get_supabase()
    
    query = supabase.table("menus").select(
        "meal_period, dining_halls!inner(short_name)"
    ).eq("date", date)
    
    if dining_hall:
        hall = _normalize_dining_hall(dining_hall)
        query = query.eq("dining_halls.short_name", hall)
    
    result = query.execute()
    
    # Extract unique meal periods
    periods = list(set(row["meal_period"] for row in result.data))
    
    # Sort in logical order
    order = ["Breakfast", "Brunch", "Lunch", "Dinner", "Late Night"]
    return sorted(periods, key=lambda x: order.index(x) if x in order else 99)


def get_todays_menu(
    dining_hall: str,
    meal_period: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get today's menu for a specific dining hall.
    
    Args:
        dining_hall: Name of dining hall (e.g., "Carrillo", "DLG", "Portola")
        meal_period: Optional meal period filter ("Breakfast", "Lunch", "Dinner", "Brunch")
    
    Returns:
        Dictionary with menu items grouped by meal period and category
    """
    hall = _normalize_dining_hall(dining_hall)
    date = _get_today()
    
    supabase = get_supabase()
    
    query = supabase.table("menu_items").select(
        "*, menus!inner(date, meal_period, dining_halls!inner(short_name, name))"
    ).eq("menus.date", date).eq("menus.dining_halls.short_name", hall)
    
    if meal_period:
        query = query.eq("menus.meal_period", meal_period)
    
    result = query.execute()
    
    if not result.data:
        return {
            "dining_hall": hall,
            "date": date,
            "meal_period": meal_period,
            "status": "no_menu",
            "message": f"No menu found for {hall} on {date}" + (f" for {meal_period}" if meal_period else ""),
            "items": []
        }
    
    # Group by meal period and category
    grouped = {}
    for item in result.data:
        period = item["menus"]["meal_period"]
        category = item.get("category", "Uncategorized")
        
        if period not in grouped:
            grouped[period] = {}
        if category not in grouped[period]:
            grouped[period][category] = []
        
        grouped[period][category].append(_format_item(item))
    
    return {
        "dining_hall": hall,
        "date": date,
        "meal_period": meal_period,
        "status": "success",
        "menu": grouped,
        "total_items": len(result.data)
    }


def search_menu_items(
    date: Optional[str] = None,
    dining_hall: Optional[str] = None,
    meal_period: Optional[str] = None,
    dietary_tags: Optional[List[str]] = None,
    max_calories: Optional[int] = None,
    min_protein: Optional[int] = None,
    max_sodium: Optional[int] = None,
    search_term: Optional[str] = None,
    limit: int = 50
) -> Dict[str, Any]:
    """
    Search menu items with various filters.
    
    Args:
        date: Date string (YYYY-MM-DD), defaults to today
        dining_hall: Filter by dining hall
        meal_period: Filter by meal period
        dietary_tags: Filter by dietary tags (e.g., ["vegan", "vegetarian"])
        max_calories: Maximum calories
        min_protein: Minimum protein in grams
        max_sodium: Maximum sodium in mg
        search_term: Search in item name
        limit: Maximum results to return
    
    Returns:
        Dictionary with matching items and metadata
    """
    if date is None:
        date = _get_today()
    
    supabase = get_supabase()
    
    query = supabase.table("menu_items").select(
        "*, menus!inner(date, meal_period, dining_halls!inner(short_name))"
    ).eq("menus.date", date)
    
    if dining_hall:
        hall = _normalize_dining_hall(dining_hall)
        query = query.eq("menus.dining_halls.short_name", hall)
    
    if meal_period:
        query = query.eq("menus.meal_period", meal_period)
    
    if max_calories:
        query = query.lte("calories", max_calories)
    
    if min_protein:
        query = query.gte("protein_g", min_protein)
    
    if max_sodium:
        query = query.lte("sodium_mg", max_sodium)
    
    if dietary_tags:
        for tag in dietary_tags:
            query = query.contains("dietary_tags", [tag])
    
    if search_term:
        query = query.ilike("name", f"%{search_term}%")
    
    result = query.limit(limit).execute()
    
    items = []
    for item in result.data:
        formatted = _format_item(item)
        formatted["dining_hall"] = item["menus"]["dining_halls"]["short_name"]
        formatted["meal_period"] = item["menus"]["meal_period"]
        items.append(formatted)
    
    # Sort by calories if filtering by calories, otherwise by protein
    if max_calories:
        items.sort(key=lambda x: x.get("calories") or 9999)
    elif min_protein:
        items.sort(key=lambda x: -(x.get("protein_g") or 0))
    
    return {
        "date": date,
        "filters": {
            "dining_hall": dining_hall,
            "meal_period": meal_period,
            "dietary_tags": dietary_tags,
            "max_calories": max_calories,
            "min_protein": min_protein,
            "max_sodium": max_sodium,
            "search_term": search_term
        },
        "total_results": len(items),
        "items": items
    }


def get_nutrition_info(
    item_name: str,
    dining_hall: Optional[str] = None,
    date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get detailed nutrition information for a specific item.
    
    Args:
        item_name: Name of the food item
        dining_hall: Optional dining hall filter
        date: Date to search (defaults to today)
    
    Returns:
        Detailed nutrition facts for the item
    """
    if date is None:
        date = _get_today()
    
    supabase = get_supabase()
    
    query = supabase.table("menu_items").select(
        "*, menus!inner(date, meal_period, dining_halls!inner(short_name))"
    ).eq("menus.date", date).ilike("name", f"%{item_name}%")
    
    if dining_hall:
        hall = _normalize_dining_hall(dining_hall)
        query = query.eq("menus.dining_halls.short_name", hall)
    
    result = query.limit(5).execute()
    
    if not result.data:
        return {
            "status": "not_found",
            "message": f"Could not find '{item_name}' in the menu for {date}",
            "suggestions": "Try searching with a different name or check if the dining hall is open."
        }
    
    items = []
    for item in result.data:
        items.append({
            "name": item.get("name"),
            "dining_hall": item["menus"]["dining_halls"]["short_name"],
            "meal_period": item["menus"]["meal_period"],
            "category": item.get("category"),
            "serving_size": item.get("serving_size"),
            "dietary_tags": item.get("dietary_tags", []),
            "nutrition": {
                "calories": item.get("calories"),
                "calories_from_fat": item.get("calories_from_fat"),
                "total_fat": {
                    "grams": item.get("total_fat_g"),
                    "daily_value_percent": item.get("total_fat_dv")
                },
                "saturated_fat": {
                    "grams": item.get("saturated_fat_g"),
                    "daily_value_percent": item.get("saturated_fat_dv")
                },
                "trans_fat_g": item.get("trans_fat_g"),
                "cholesterol": {
                    "mg": item.get("cholesterol_mg"),
                    "daily_value_percent": item.get("cholesterol_dv")
                },
                "sodium": {
                    "mg": item.get("sodium_mg"),
                    "daily_value_percent": item.get("sodium_dv")
                },
                "total_carbohydrates": {
                    "grams": item.get("total_carbs_g"),
                    "daily_value_percent": item.get("total_carbs_dv")
                },
                "dietary_fiber": {
                    "grams": item.get("dietary_fiber_g"),
                    "daily_value_percent": item.get("dietary_fiber_dv")
                },
                "sugars_g": item.get("sugars_g"),
                "protein_g": item.get("protein_g"),
                "vitamins": {
                    "vitamin_a_dv": item.get("vitamin_a_dv"),
                    "vitamin_c_dv": item.get("vitamin_c_dv"),
                    "calcium_dv": item.get("calcium_dv"),
                    "iron_dv": item.get("iron_dv")
                }
            }
        })
    
    return {
        "status": "success",
        "query": item_name,
        "date": date,
        "results_count": len(items),
        "items": items
    }


def compare_items(
    item_names: List[str],
    date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Compare nutrition facts for multiple items side by side.
    
    Args:
        item_names: List of item names to compare
        date: Date to search (defaults to today)
    
    Returns:
        Side-by-side comparison of nutrition facts
    """
    if date is None:
        date = _get_today()
    
    comparison = []
    not_found = []
    
    for name in item_names:
        result = get_nutrition_info(name, date=date)
        if result["status"] == "success" and result["items"]:
            item = result["items"][0]
            comparison.append({
                "name": item["name"],
                "serving_size": item["serving_size"],
                "dining_hall": item["dining_hall"],
                "calories": item["nutrition"]["calories"],
                "protein_g": item["nutrition"]["protein_g"],
                "total_fat_g": item["nutrition"]["total_fat"]["grams"],
                "total_carbs_g": item["nutrition"]["total_carbohydrates"]["grams"],
                "sodium_mg": item["nutrition"]["sodium"]["mg"],
                "dietary_tags": item["dietary_tags"]
            })
        else:
            not_found.append(name)
    
    return {
        "date": date,
        "comparison": comparison,
        "not_found": not_found,
        "summary": {
            "lowest_calories": min(comparison, key=lambda x: x["calories"] or 9999)["name"] if comparison else None,
            "highest_protein": max(comparison, key=lambda x: x["protein_g"] or 0)["name"] if comparison else None,
            "lowest_sodium": min(comparison, key=lambda x: x["sodium_mg"] or 9999)["name"] if comparison else None,
        }
    }


def get_high_protein_items(
    min_protein: int = 20,
    date: Optional[str] = None,
    dining_hall: Optional[str] = None,
    meal_period: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get high protein menu items.
    
    Args:
        min_protein: Minimum protein threshold (default 20g)
        date: Date to search
        dining_hall: Optional dining hall filter
        meal_period: Optional meal period filter
    
    Returns:
        List of high protein items sorted by protein content
    """
    return search_menu_items(
        date=date,
        dining_hall=dining_hall,
        meal_period=meal_period,
        min_protein=min_protein
    )


def get_low_calorie_items(
    max_calories: int = 300,
    date: Optional[str] = None,
    dining_hall: Optional[str] = None,
    meal_period: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get low calorie menu items.
    
    Args:
        max_calories: Maximum calorie threshold (default 300)
        date: Date to search
        dining_hall: Optional dining hall filter
        meal_period: Optional meal period filter
    
    Returns:
        List of low calorie items sorted by calories
    """
    return search_menu_items(
        date=date,
        dining_hall=dining_hall,
        meal_period=meal_period,
        max_calories=max_calories
    )


def get_vegan_items(
    date: Optional[str] = None,
    dining_hall: Optional[str] = None,
    meal_period: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get all vegan menu items.
    
    Args:
        date: Date to search
        dining_hall: Optional dining hall filter
        meal_period: Optional meal period filter
    
    Returns:
        List of vegan items
    """
    return search_menu_items(
        date=date,
        dining_hall=dining_hall,
        meal_period=meal_period,
        dietary_tags=["vegan"]
    )


def get_vegetarian_items(
    date: Optional[str] = None,
    dining_hall: Optional[str] = None,
    meal_period: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get all vegetarian menu items.
    
    Args:
        date: Date to search
        dining_hall: Optional dining hall filter
        meal_period: Optional meal period filter
    
    Returns:
        List of vegetarian items (includes vegan items)
    """
    return search_menu_items(
        date=date,
        dining_hall=dining_hall,
        meal_period=meal_period,
        dietary_tags=["vegetarian"]
    )


# ============================================
# Utility Functions
# ============================================

def get_current_meal_period() -> str:
    """
    Determine the current or next meal period based on time.
    
    Returns:
        Current/upcoming meal period string
    """
    hour = datetime.now().hour
    
    if hour < 10:
        return "Breakfast"
    elif hour < 14:
        return "Lunch"
    elif hour < 17:
        return "Lunch"  # Between meals, show lunch
    else:
        return "Dinner"


def format_menu_for_display(menu_result: Dict[str, Any]) -> str:
    """
    Format menu result as a readable string.
    
    Args:
        menu_result: Result from get_todays_menu or search_menu_items
    
    Returns:
        Formatted string for display
    """
    if menu_result.get("status") == "no_menu":
        return menu_result.get("message", "No menu available")
    
    lines = []
    
    if "menu" in menu_result:
        # Full menu format
        for period, categories in menu_result["menu"].items():
            lines.append(f"\n🍽️ {period}")
            for category, items in categories.items():
                lines.append(f"\n  📍 {category}")
                for item in items:
                    tags = ""
                    if "vegan" in item.get("dietary_tags", []):
                        tags += " 🌱"
                    if "vegetarian" in item.get("dietary_tags", []):
                        tags += " 🥛"
                    lines.append(
                        f"    • {item['name']}{tags} - {item.get('calories', '?')} cal, "
                        f"{item.get('protein_g', '?')}g protein ({item.get('serving_size', '')})"
                    )
    
    elif "items" in menu_result:
        # Search results format
        for item in menu_result["items"]:
            tags = ""
            if "vegan" in item.get("dietary_tags", []):
                tags += " 🌱"
            if "vegetarian" in item.get("dietary_tags", []):
                tags += " 🥛"
            lines.append(
                f"• {item['name']}{tags} @ {item.get('dining_hall', '?')} ({item.get('meal_period', '?')})\n"
                f"  {item.get('calories', '?')} cal | {item.get('protein_g', '?')}g protein | "
                f"{item.get('serving_size', '')}"
            )
    
    return "\n".join(lines)


# ============================================
# Test Functions
# ============================================

if __name__ == "__main__":
    print("Testing UCSB Dining Query Functions\n")
    print("=" * 50)
    
    # Test 1: Get dining halls
    print("\n1. Dining Halls:")
    halls = get_dining_halls()
    for hall in halls:
        print(f"   - {hall['name']} ({hall['short_name']})")
    
    # Test 2: Get meal periods
    print("\n2. Today's Meal Periods:")
    periods = get_meal_periods()
    print(f"   {periods}")
    
    # Test 3: Get today's menu
    print("\n3. Carrillo Dinner Menu:")
    menu = get_todays_menu("Carrillo", "Dinner")
    print(f"   Status: {menu['status']}")
    print(f"   Total items: {menu.get('total_items', 0)}")
    
    # Test 4: Search vegan items
    print("\n4. Vegan Options:")
    vegan = get_vegan_items()
    print(f"   Found {vegan['total_results']} vegan items")
    for item in vegan["items"][:3]:
        print(f"   - {item['name']} ({item['calories']} cal)")
    
    # Test 5: High protein search
    print("\n5. High Protein Items (20g+):")
    protein = get_high_protein_items(20)
    print(f"   Found {protein['total_results']} items")
    for item in protein["items"][:3]:
        print(f"   - {item['name']} ({item['protein_g']}g protein)")
    
    # Test 6: Nutrition info
    print("\n6. Nutrition Info for 'Chicken':")
    info = get_nutrition_info("Chicken")
    if info["status"] == "success":
        for item in info["items"][:2]:
            print(f"   - {item['name']}: {item['nutrition']['calories']} cal")
    
    print("\n" + "=" * 50)
    print("All tests completed!")
