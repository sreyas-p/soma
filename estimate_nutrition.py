#!/usr/bin/env python3
"""
UCSB Dining Menu Nutrition Estimator

Generates estimated FDA-style nutrition facts for dining hall food items
based on food type, serving size, preparation method, and dietary tags.
"""

import json
import re
from datetime import datetime

# Daily Values (based on 2000 calorie diet)
DAILY_VALUES = {
    "total_fat": 65,  # g
    "saturated_fat": 20,  # g
    "cholesterol": 300,  # mg
    "sodium": 2400,  # mg
    "total_carbs": 300,  # g
    "dietary_fiber": 25,  # g
    "vitamin_a": 5000,  # IU
    "vitamin_c": 60,  # mg
    "calcium": 1000,  # mg
    "iron": 18,  # mg
}


def parse_serving_size(serving_str: str) -> tuple[float, str]:
    """
    Parse serving size string into numeric value and unit.
    Returns (amount, unit)
    """
    serving_str = serving_str.lower().strip()
    
    # Handle fractions
    fraction_map = {
        "1/2": 0.5, "1/3": 0.333, "1/4": 0.25, "2/3": 0.667, "3/4": 0.75
    }
    
    for frac, val in fraction_map.items():
        if frac in serving_str:
            serving_str = serving_str.replace(frac, str(val))
    
    # Extract numeric value
    match = re.search(r'([\d.]+)', serving_str)
    amount = float(match.group(1)) if match else 1.0
    
    # Determine unit
    if "cup" in serving_str:
        unit = "cup"
    elif "oz" in serving_str:
        unit = "oz"
    elif "ladle" in serving_str:
        unit = "oz"  # ladle is typically oz
    elif "slice" in serving_str:
        unit = "slice"
    elif "piece" in serving_str:
        unit = "piece"
    elif "potato" in serving_str:
        unit = "potato"
    elif "tortilla" in serving_str:
        unit = "tortilla"
    elif "burrito" in serving_str:
        unit = "burrito"
    elif "taco" in serving_str:
        unit = "taco"
    elif "quarter" in serving_str:
        unit = "quarter"
    elif "round" in serving_str:
        unit = "round"
    elif "ounce" in serving_str:
        unit = "oz"
    else:
        unit = "serving"
    
    return amount, unit


def calc_dv_percent(value: float, dv: float) -> int:
    """Calculate percent daily value."""
    return round((value / dv) * 100)


def create_base_nutrition() -> dict:
    """Create base nutrition facts template."""
    return {
        "calories": 0,
        "calories_from_fat": 0,
        "total_fat_g": 0,
        "total_fat_dv": 0,
        "saturated_fat_g": 0,
        "saturated_fat_dv": 0,
        "trans_fat_g": 0,
        "cholesterol_mg": 0,
        "cholesterol_dv": 0,
        "sodium_mg": 0,
        "sodium_dv": 0,
        "total_carbs_g": 0,
        "total_carbs_dv": 0,
        "dietary_fiber_g": 0,
        "dietary_fiber_dv": 0,
        "sugars_g": 0,
        "protein_g": 0,
        "vitamin_a_dv": 0,
        "vitamin_c_dv": 0,
        "calcium_dv": 0,
        "iron_dv": 0,
    }


def estimate_protein_nutrition(name: str, serving_size: str, tags: list) -> dict:
    """Estimate nutrition for protein items (chicken, salmon, pork, etc.)"""
    nutr = create_base_nutrition()
    amount, unit = parse_serving_size(serving_size)
    
    name_lower = name.lower()
    
    if "chicken" in name_lower:
        # Chicken quarter or piece
        if unit == "quarter" or "quarter" in name_lower:
            nutr["calories"] = 280
            nutr["total_fat_g"] = 14
            nutr["saturated_fat_g"] = 4
            nutr["cholesterol_mg"] = 95
            nutr["sodium_mg"] = 520
            nutr["protein_g"] = 32
            nutr["total_carbs_g"] = 2
        else:
            # Per oz of chicken
            base_cal = 50 * amount
            nutr["calories"] = int(base_cal)
            nutr["total_fat_g"] = round(2.5 * amount, 1)
            nutr["saturated_fat_g"] = round(0.7 * amount, 1)
            nutr["cholesterol_mg"] = int(25 * amount)
            nutr["sodium_mg"] = int(150 * amount)
            nutr["protein_g"] = round(7 * amount)
            
    elif "salmon" in name_lower:
        # 4 oz salmon
        oz = amount if unit == "oz" else 4
        nutr["calories"] = int(58 * oz)
        nutr["total_fat_g"] = round(3.5 * oz / 4, 1)
        nutr["saturated_fat_g"] = round(0.8 * oz / 4, 1)
        nutr["cholesterol_mg"] = int(18 * oz)
        nutr["sodium_mg"] = int(150 * oz)
        nutr["protein_g"] = round(6.5 * oz)
        nutr["vitamin_a_dv"] = 2
        nutr["iron_dv"] = 4
        
    elif "pork" in name_lower:
        # 3 oz pork loin
        oz = amount if unit == "oz" else 3
        nutr["calories"] = int(55 * oz)
        nutr["total_fat_g"] = round(3 * oz / 3, 1)
        nutr["saturated_fat_g"] = round(1 * oz / 3, 1)
        nutr["cholesterol_mg"] = int(22 * oz)
        nutr["sodium_mg"] = int(180 * oz)
        nutr["protein_g"] = round(7 * oz)
        nutr["iron_dv"] = 4
        
    elif "calamari" in name_lower:
        # Sushi roll pieces
        pieces = amount if "piece" in unit else 3
        nutr["calories"] = int(45 * pieces)
        nutr["total_fat_g"] = round(1.5 * pieces, 1)
        nutr["cholesterol_mg"] = int(30 * pieces)
        nutr["sodium_mg"] = int(120 * pieces)
        nutr["protein_g"] = round(4 * pieces)
        nutr["total_carbs_g"] = int(5 * pieces)
        
    elif "pepperoni" in name_lower:
        nutr["calories"] = 320
        nutr["total_fat_g"] = 15
        nutr["saturated_fat_g"] = 6
        nutr["cholesterol_mg"] = 35
        nutr["sodium_mg"] = 750
        nutr["protein_g"] = 14
        nutr["total_carbs_g"] = 32
        
    elif "meat sauce" in name_lower:
        oz = amount if unit == "oz" else 3
        nutr["calories"] = int(35 * oz)
        nutr["total_fat_g"] = round(2 * oz / 3, 1)
        nutr["saturated_fat_g"] = round(0.8 * oz / 3, 1)
        nutr["cholesterol_mg"] = int(8 * oz)
        nutr["sodium_mg"] = int(180 * oz)
        nutr["protein_g"] = round(2.5 * oz)
        nutr["total_carbs_g"] = int(3 * oz)
    
    # Adjust for cooking method
    if "baked" in name_lower or "roast" in name_lower:
        nutr["total_fat_g"] = round(nutr["total_fat_g"] * 0.9, 1)
    elif "fried" in name_lower or "grilled" in name_lower:
        nutr["total_fat_g"] = round(nutr["total_fat_g"] * 1.1, 1)
        nutr["calories"] = int(nutr["calories"] * 1.05)
    
    return nutr


def estimate_starch_nutrition(name: str, serving_size: str, tags: list) -> dict:
    """Estimate nutrition for starches (rice, pasta, potatoes, etc.)"""
    nutr = create_base_nutrition()
    amount, unit = parse_serving_size(serving_size)
    is_vegan = "vegan" in tags
    
    name_lower = name.lower()
    
    if "rice" in name_lower:
        # 1/2 cup cooked rice
        cups = amount if unit == "cup" else 0.5
        if "brown" in name_lower:
            nutr["calories"] = int(110 * cups * 2)
            nutr["total_carbs_g"] = int(23 * cups * 2)
            nutr["dietary_fiber_g"] = round(2 * cups * 2, 1)
            nutr["protein_g"] = round(2.5 * cups * 2)
        elif "fried" in name_lower:
            nutr["calories"] = int(130 * cups * 2)
            nutr["total_fat_g"] = round(4 * cups * 2, 1)
            nutr["total_carbs_g"] = int(20 * cups * 2)
            nutr["sodium_mg"] = int(400 * cups * 2)
            nutr["protein_g"] = round(3 * cups * 2)
        else:  # white/jasmine/sticky/pilaf
            nutr["calories"] = int(105 * cups * 2)
            nutr["total_carbs_g"] = int(22 * cups * 2)
            nutr["protein_g"] = round(2 * cups * 2)
        
        if "pilaf" in name_lower or "spanish" in name_lower:
            nutr["total_fat_g"] = round(nutr.get("total_fat_g", 0) + 2, 1)
            nutr["sodium_mg"] = int(nutr.get("sodium_mg", 0) + 350)
            nutr["calories"] += 25
            
    elif "pasta" in name_lower or "spaghetti" in name_lower or "spirals" in name_lower or "farfalle" in name_lower:
        cups = amount if unit == "cup" else 0.33
        nutr["calories"] = int(100 * cups * 3)
        nutr["total_carbs_g"] = int(20 * cups * 3)
        nutr["protein_g"] = round(3.5 * cups * 3)
        nutr["dietary_fiber_g"] = round(1 * cups * 3, 1)
        
        if "whole wheat" in name_lower:
            nutr["dietary_fiber_g"] = round(2.5 * cups * 3, 1)
            
        if "carbonara" in name_lower:
            nutr["calories"] = 350
            nutr["total_fat_g"] = 18
            nutr["saturated_fat_g"] = 8
            nutr["cholesterol_mg"] = 65
            nutr["sodium_mg"] = 580
            nutr["protein_g"] = 14
            
        if "primavera" in name_lower:
            nutr["calories"] = int(nutr["calories"] * 1.1)
            nutr["vitamin_a_dv"] = 15
            nutr["vitamin_c_dv"] = 10
            nutr["sodium_mg"] = 380
            
        if "olive oil" in name_lower or "garlic" in name_lower:
            nutr["total_fat_g"] = round(nutr.get("total_fat_g", 0) + 5, 1)
            nutr["calories"] += 45
            
    elif "potato" in name_lower:
        if "baked" in name_lower or unit == "potato":
            nutr["calories"] = 160
            nutr["total_carbs_g"] = 37
            nutr["dietary_fiber_g"] = 4
            nutr["protein_g"] = 4
            nutr["vitamin_c_dv"] = 28
            nutr["potassium_mg"] = 926
            nutr["sodium_mg"] = 17
            
        if "sweet" in name_lower:
            nutr["calories"] = 180
            nutr["total_carbs_g"] = 41
            nutr["sugars_g"] = 13
            nutr["dietary_fiber_g"] = 6
            nutr["vitamin_a_dv"] = 380
            
        if "mashed" in name_lower:
            oz = amount if unit == "oz" else 5
            nutr["calories"] = int(30 * oz)
            nutr["total_fat_g"] = round(2 * oz / 5, 1)
            nutr["total_carbs_g"] = int(5 * oz)
            nutr["sodium_mg"] = int(100 * oz)
            if "vegetarian" in tags:
                nutr["total_fat_g"] = round(nutr["total_fat_g"] * 1.2, 1)
                nutr["calories"] += 15
                
    elif "quinoa" in name_lower:
        cups = amount if unit == "cup" else 0.5
        nutr["calories"] = int(110 * cups * 2)
        nutr["total_fat_g"] = round(1.8 * cups * 2, 1)
        nutr["total_carbs_g"] = int(20 * cups * 2)
        nutr["dietary_fiber_g"] = round(2.5 * cups * 2, 1)
        nutr["protein_g"] = round(4 * cups * 2)
        nutr["iron_dv"] = int(8 * cups * 2)
        
    elif "tortilla" in name_lower:
        if "flour" in name_lower:
            nutr["calories"] = 140
            nutr["total_fat_g"] = 3.5
            nutr["total_carbs_g"] = 24
            nutr["sodium_mg"] = 340
            nutr["protein_g"] = 4
        elif "corn" in name_lower:
            nutr["calories"] = 60
            nutr["total_fat_g"] = 1
            nutr["total_carbs_g"] = 12
            nutr["dietary_fiber_g"] = 1.5
            nutr["sodium_mg"] = 10
            nutr["protein_g"] = 1.5
        elif "wheat" in name_lower:
            nutr["calories"] = 120
            nutr["total_fat_g"] = 2.5
            nutr["total_carbs_g"] = 20
            nutr["dietary_fiber_g"] = 3
            nutr["sodium_mg"] = 300
            nutr["protein_g"] = 4
            
    return nutr


def estimate_vegetable_nutrition(name: str, serving_size: str, tags: list) -> dict:
    """Estimate nutrition for vegetables."""
    nutr = create_base_nutrition()
    amount, unit = parse_serving_size(serving_size)
    is_vegan = "vegan" in tags
    
    name_lower = name.lower()
    cups = amount if unit == "cup" else 0.5
    
    if "broccoli" in name_lower:
        nutr["calories"] = int(27 * cups * 2)
        nutr["total_carbs_g"] = int(5 * cups * 2)
        nutr["dietary_fiber_g"] = round(2.5 * cups * 2, 1)
        nutr["protein_g"] = round(2.5 * cups * 2)
        nutr["vitamin_c_dv"] = int(90 * cups * 2)
        nutr["vitamin_a_dv"] = int(10 * cups * 2)
        nutr["calcium_dv"] = int(4 * cups * 2)
        
    elif "cauliflower" in name_lower:
        nutr["calories"] = int(25 * cups * 2)
        nutr["total_carbs_g"] = int(5 * cups * 2)
        nutr["dietary_fiber_g"] = round(2 * cups * 2, 1)
        nutr["protein_g"] = round(2 * cups * 2)
        nutr["vitamin_c_dv"] = int(50 * cups * 2)
        
    elif "carrot" in name_lower:
        nutr["calories"] = int(25 * cups * 2)
        nutr["total_carbs_g"] = int(6 * cups * 2)
        nutr["sugars_g"] = int(3 * cups * 2)
        nutr["dietary_fiber_g"] = round(1.5 * cups * 2, 1)
        nutr["vitamin_a_dv"] = int(200 * cups * 2)
        
    elif "green bean" in name_lower:
        nutr["calories"] = int(22 * cups * 2)
        nutr["total_carbs_g"] = int(5 * cups * 2)
        nutr["dietary_fiber_g"] = round(2 * cups * 2, 1)
        nutr["protein_g"] = round(1 * cups * 2)
        nutr["vitamin_c_dv"] = int(15 * cups * 2)
        nutr["vitamin_a_dv"] = int(8 * cups * 2)
        
    elif "spinach" in name_lower:
        nutr["calories"] = int(7 * cups * 2)
        nutr["total_carbs_g"] = int(1 * cups * 2)
        nutr["dietary_fiber_g"] = round(0.7 * cups * 2, 1)
        nutr["protein_g"] = round(1 * cups * 2)
        nutr["vitamin_a_dv"] = int(56 * cups * 2)
        nutr["vitamin_c_dv"] = int(14 * cups * 2)
        nutr["iron_dv"] = int(5 * cups * 2)
        
    elif "cabbage" in name_lower:
        nutr["calories"] = int(17 * cups * 2)
        nutr["total_carbs_g"] = int(4 * cups * 2)
        nutr["dietary_fiber_g"] = round(1 * cups * 2, 1)
        nutr["vitamin_c_dv"] = int(30 * cups * 2)
        
    else:  # Generic vegetable
        nutr["calories"] = int(25 * cups * 2)
        nutr["total_carbs_g"] = int(5 * cups * 2)
        nutr["dietary_fiber_g"] = round(2 * cups * 2, 1)
        nutr["vitamin_a_dv"] = 10
        nutr["vitamin_c_dv"] = 10
        
    # Add fat if not vegan (likely cooked with butter)
    if not is_vegan:
        nutr["total_fat_g"] = round(nutr.get("total_fat_g", 0) + 2, 1)
        nutr["calories"] += 18
        nutr["cholesterol_mg"] = 5
        
    # Add sodium for institutional cooking
    nutr["sodium_mg"] = nutr.get("sodium_mg", 0) + 150
    
    return nutr


def estimate_soup_nutrition(name: str, serving_size: str, tags: list) -> dict:
    """Estimate nutrition for soups."""
    nutr = create_base_nutrition()
    amount, unit = parse_serving_size(serving_size)
    oz = amount if unit == "oz" else 6
    
    name_lower = name.lower()
    
    if "tomato" in name_lower or "cream" in name_lower:
        nutr["calories"] = int(25 * oz)
        nutr["total_fat_g"] = round(1.5 * oz / 6, 1)
        if "cream" in name_lower:
            nutr["total_fat_g"] = round(3 * oz / 6, 1)
            nutr["saturated_fat_g"] = round(1.5 * oz / 6, 1)
        nutr["total_carbs_g"] = int(3 * oz)
        nutr["sugars_g"] = int(2 * oz / 6)
        nutr["sodium_mg"] = int(120 * oz)
        nutr["protein_g"] = round(1 * oz / 6)
        nutr["vitamin_a_dv"] = 10
        nutr["vitamin_c_dv"] = 15
        
    elif "potato" in name_lower or "leek" in name_lower:
        nutr["calories"] = int(22 * oz)
        nutr["total_fat_g"] = round(1 * oz / 6, 1)
        nutr["total_carbs_g"] = int(3 * oz)
        nutr["sodium_mg"] = int(110 * oz)
        nutr["protein_g"] = round(0.8 * oz / 6)
        
    elif "chili" in name_lower:
        nutr["calories"] = int(35 * oz)
        nutr["total_fat_g"] = round(2 * oz / 6, 1)
        nutr["total_carbs_g"] = int(3 * oz)
        nutr["dietary_fiber_g"] = round(1.5 * oz / 6, 1)
        nutr["sodium_mg"] = int(150 * oz)
        nutr["protein_g"] = round(3 * oz / 6)
        nutr["iron_dv"] = 8
        
    else:  # Generic soup
        nutr["calories"] = int(20 * oz)
        nutr["total_carbs_g"] = int(3 * oz)
        nutr["sodium_mg"] = int(130 * oz)
        
    return nutr


def estimate_pizza_nutrition(name: str, serving_size: str, tags: list) -> dict:
    """Estimate nutrition for pizza."""
    nutr = create_base_nutrition()
    is_vegetarian = "vegetarian" in tags
    
    name_lower = name.lower()
    
    # Base cheese pizza
    nutr["calories"] = 280
    nutr["total_fat_g"] = 11
    nutr["saturated_fat_g"] = 5
    nutr["cholesterol_mg"] = 25
    nutr["sodium_mg"] = 620
    nutr["total_carbs_g"] = 32
    nutr["sugars_g"] = 3
    nutr["protein_g"] = 12
    nutr["calcium_dv"] = 20
    
    if "pepperoni" in name_lower:
        nutr["calories"] = 320
        nutr["total_fat_g"] = 15
        nutr["saturated_fat_g"] = 6
        nutr["cholesterol_mg"] = 35
        nutr["sodium_mg"] = 750
        nutr["protein_g"] = 14
        
    elif "chicken" in name_lower:
        nutr["calories"] = 300
        nutr["total_fat_g"] = 12
        nutr["protein_g"] = 16
        nutr["sodium_mg"] = 680
        
    elif "mushroom" in name_lower or "veggie" in name_lower or "vegetable" in name_lower:
        nutr["calories"] = 260
        nutr["total_fat_g"] = 10
        nutr["vitamin_a_dv"] = 8
        
    if "wheat" in name_lower:
        nutr["dietary_fiber_g"] = 3
        nutr["total_carbs_g"] = 30
        
    return nutr


def estimate_mexican_nutrition(name: str, serving_size: str, tags: list) -> dict:
    """Estimate nutrition for Mexican food items."""
    nutr = create_base_nutrition()
    is_vegan = "vegan" in tags
    
    name_lower = name.lower()
    
    if "burrito" in name_lower:
        nutr["calories"] = 450
        nutr["total_fat_g"] = 14
        nutr["saturated_fat_g"] = 5
        nutr["total_carbs_g"] = 55
        nutr["dietary_fiber_g"] = 6
        nutr["sodium_mg"] = 980
        nutr["protein_g"] = 22
        
        if "bean" in name_lower:
            nutr["dietary_fiber_g"] = 9
            nutr["protein_g"] = 18
            
        if is_vegan or "vegetable" in name_lower:
            nutr["calories"] = 380
            nutr["total_fat_g"] = 10
            nutr["cholesterol_mg"] = 0
            nutr["protein_g"] = 12
            
    elif "taco" in name_lower:
        nutr["calories"] = 180
        nutr["total_fat_g"] = 9
        nutr["saturated_fat_g"] = 3
        nutr["total_carbs_g"] = 15
        nutr["sodium_mg"] = 350
        nutr["protein_g"] = 10
        
        if is_vegan or "vegetable" in name_lower:
            nutr["calories"] = 140
            nutr["total_fat_g"] = 6
            nutr["cholesterol_mg"] = 0
            nutr["protein_g"] = 4
            
    elif "salsa" in name_lower:
        oz = 1  # typically 1 oz ladle
        nutr["calories"] = 10
        nutr["total_carbs_g"] = 2
        nutr["sodium_mg"] = 150
        nutr["vitamin_c_dv"] = 8
        
    return nutr


def estimate_beans_nutrition(name: str, serving_size: str, tags: list) -> dict:
    """Estimate nutrition for beans."""
    nutr = create_base_nutrition()
    amount, unit = parse_serving_size(serving_size)
    cups = amount if unit == "cup" else 0.5
    
    name_lower = name.lower()
    
    if "black" in name_lower:
        nutr["calories"] = int(115 * cups * 2)
        nutr["total_fat_g"] = round(0.5 * cups * 2, 1)
        nutr["total_carbs_g"] = int(20 * cups * 2)
        nutr["dietary_fiber_g"] = round(7.5 * cups * 2, 1)
        nutr["protein_g"] = round(7.5 * cups * 2)
        nutr["iron_dv"] = int(10 * cups * 2)
        nutr["sodium_mg"] = int(200 * cups * 2)
        
    elif "refried" in name_lower:
        nutr["calories"] = int(120 * cups * 2)
        nutr["total_fat_g"] = round(2 * cups * 2, 1)
        nutr["total_carbs_g"] = int(18 * cups * 2)
        nutr["dietary_fiber_g"] = round(6 * cups * 2, 1)
        nutr["protein_g"] = round(7 * cups * 2)
        nutr["sodium_mg"] = int(450 * cups * 2)
        
    else:  # Generic beans
        nutr["calories"] = int(110 * cups * 2)
        nutr["total_carbs_g"] = int(19 * cups * 2)
        nutr["dietary_fiber_g"] = round(6 * cups * 2, 1)
        nutr["protein_g"] = round(7 * cups * 2)
        nutr["sodium_mg"] = int(250 * cups * 2)
        
    return nutr


def estimate_salad_nutrition(name: str, serving_size: str, tags: list) -> dict:
    """Estimate nutrition for salads."""
    nutr = create_base_nutrition()
    amount, unit = parse_serving_size(serving_size)
    is_vegetarian = "vegetarian" in tags
    has_nuts = "contains_nuts" in tags
    
    name_lower = name.lower()
    cups = amount if unit == "cup" else 0.5
    
    if "caesar" in name_lower:
        nutr["calories"] = int(90 * cups * 2)
        nutr["total_fat_g"] = round(7 * cups * 2, 1)
        nutr["saturated_fat_g"] = round(1.5 * cups * 2, 1)
        nutr["total_carbs_g"] = int(4 * cups * 2)
        nutr["sodium_mg"] = int(200 * cups * 2)
        nutr["protein_g"] = round(3 * cups * 2)
        nutr["vitamin_a_dv"] = 35
        nutr["cholesterol_mg"] = 10
        
    elif "spinach" in name_lower:
        nutr["calories"] = int(80 * cups * 2)
        nutr["total_fat_g"] = round(5 * cups * 2, 1)
        nutr["total_carbs_g"] = int(6 * cups * 2)
        nutr["dietary_fiber_g"] = round(2 * cups * 2, 1)
        nutr["sodium_mg"] = int(180 * cups * 2)
        nutr["vitamin_a_dv"] = 60
        nutr["iron_dv"] = 8
        
        if "bacon" in name_lower:
            nutr["calories"] += 50
            nutr["total_fat_g"] += 4
            nutr["sodium_mg"] += 180
            nutr["cholesterol_mg"] = 15
            
    else:  # Generic salad
        nutr["calories"] = int(50 * cups * 2)
        nutr["total_fat_g"] = round(3 * cups * 2, 1)
        nutr["total_carbs_g"] = int(5 * cups * 2)
        nutr["vitamin_a_dv"] = 30
        nutr["vitamin_c_dv"] = 15
        
    if has_nuts:
        nutr["calories"] += 80
        nutr["total_fat_g"] += 7
        nutr["protein_g"] += 2
        
    return nutr


def estimate_bread_nutrition(name: str, serving_size: str, tags: list) -> dict:
    """Estimate nutrition for bread/bakery items."""
    nutr = create_base_nutrition()
    is_vegan = "vegan" in tags
    
    name_lower = name.lower()
    
    if "breadstick" in name_lower:
        nutr["calories"] = 140
        nutr["total_fat_g"] = 4
        nutr["total_carbs_g"] = 22
        nutr["sodium_mg"] = 280
        nutr["protein_g"] = 4
        
    elif "pizza bread" in name_lower:
        nutr["calories"] = 180
        nutr["total_fat_g"] = 6
        nutr["saturated_fat_g"] = 2
        nutr["total_carbs_g"] = 26
        nutr["sodium_mg"] = 380
        nutr["protein_g"] = 6
        nutr["calcium_dv"] = 10
        
    elif "pesto bread" in name_lower:
        nutr["calories"] = 160
        nutr["total_fat_g"] = 7
        nutr["total_carbs_g"] = 20
        nutr["sodium_mg"] = 320
        nutr["protein_g"] = 5
        
    else:  # Generic bread
        nutr["calories"] = 150
        nutr["total_fat_g"] = 3
        nutr["total_carbs_g"] = 26
        nutr["sodium_mg"] = 280
        nutr["protein_g"] = 5
        
    return nutr


def estimate_dessert_nutrition(name: str, serving_size: str, tags: list) -> dict:
    """Estimate nutrition for desserts."""
    nutr = create_base_nutrition()
    is_vegan = "vegan" in tags
    
    name_lower = name.lower()
    
    if "cake" in name_lower:
        nutr["calories"] = 350
        nutr["total_fat_g"] = 16
        nutr["saturated_fat_g"] = 4
        nutr["total_carbs_g"] = 48
        nutr["sugars_g"] = 32
        nutr["sodium_mg"] = 350
        nutr["protein_g"] = 4
        
        if "chocolate" in name_lower:
            nutr["calories"] = 380
            nutr["total_fat_g"] = 18
            nutr["sugars_g"] = 36
            
    elif "pie" in name_lower:
        nutr["calories"] = 320
        nutr["total_fat_g"] = 14
        nutr["saturated_fat_g"] = 4
        nutr["total_carbs_g"] = 45
        nutr["sugars_g"] = 24
        nutr["sodium_mg"] = 280
        nutr["protein_g"] = 3
        
        if is_vegan:
            nutr["cholesterol_mg"] = 0
            nutr["total_fat_g"] = 12
            
    elif "crisp" in name_lower:
        nutr["calories"] = 280
        nutr["total_fat_g"] = 10
        nutr["total_carbs_g"] = 45
        nutr["sugars_g"] = 28
        nutr["dietary_fiber_g"] = 3
        nutr["sodium_mg"] = 150
        
        if is_vegan:
            nutr["cholesterol_mg"] = 0
            
    elif "quiche" in name_lower:
        nutr["calories"] = 350
        nutr["total_fat_g"] = 24
        nutr["saturated_fat_g"] = 10
        nutr["cholesterol_mg"] = 165
        nutr["total_carbs_g"] = 18
        nutr["sodium_mg"] = 480
        nutr["protein_g"] = 14
        nutr["vitamin_a_dv"] = 15
        nutr["calcium_dv"] = 15
        
    else:  # Generic dessert
        nutr["calories"] = 300
        nutr["total_fat_g"] = 12
        nutr["total_carbs_g"] = 42
        nutr["sugars_g"] = 25
        nutr["sodium_mg"] = 200
        
    return nutr


def estimate_sauce_nutrition(name: str, serving_size: str, tags: list) -> dict:
    """Estimate nutrition for sauces."""
    nutr = create_base_nutrition()
    amount, unit = parse_serving_size(serving_size)
    oz = amount if unit == "oz" else 3
    
    name_lower = name.lower()
    
    if "marinara" in name_lower or "tomato" in name_lower:
        nutr["calories"] = int(15 * oz)
        nutr["total_carbs_g"] = int(3 * oz / 3)
        nutr["sugars_g"] = int(2 * oz / 3)
        nutr["sodium_mg"] = int(150 * oz)
        nutr["vitamin_a_dv"] = 5
        nutr["vitamin_c_dv"] = 8
        
    else:  # Generic sauce
        nutr["calories"] = int(20 * oz)
        nutr["total_carbs_g"] = int(3 * oz / 3)
        nutr["sodium_mg"] = int(180 * oz)
        
    return nutr


def estimate_sushi_nutrition(name: str, serving_size: str, tags: list) -> dict:
    """Estimate nutrition for sushi rolls."""
    nutr = create_base_nutrition()
    amount, unit = parse_serving_size(serving_size)
    pieces = amount if "piece" in unit else 3
    is_vegan = "vegan" in tags
    
    nutr["calories"] = int(40 * pieces)
    nutr["total_fat_g"] = round(1 * pieces, 1)
    nutr["total_carbs_g"] = int(7 * pieces)
    nutr["sodium_mg"] = int(100 * pieces)
    nutr["protein_g"] = round(2 * pieces)
    
    if not is_vegan:
        nutr["protein_g"] = round(3 * pieces)
        nutr["cholesterol_mg"] = int(10 * pieces)
        
    return nutr


def estimate_pad_thai_nutrition(name: str, serving_size: str, tags: list) -> dict:
    """Estimate nutrition for Pad Thai."""
    nutr = create_base_nutrition()
    amount, unit = parse_serving_size(serving_size)
    is_vegan = "vegan" in tags
    has_nuts = "contains_nuts" in tags
    
    # Base pad thai per 10 oz serving
    if unit == "oz":
        multiplier = amount / 10
    elif unit == "cup":
        multiplier = amount  # 1 cup ≈ 1 serving
    else:
        multiplier = 1.0
    
    # Base vegetable pad thai
    nutr["calories"] = int(380 * multiplier)
    nutr["total_fat_g"] = round(12 * multiplier, 1)
    nutr["saturated_fat_g"] = round(2 * multiplier, 1)
    nutr["total_carbs_g"] = int(55 * multiplier)
    nutr["sugars_g"] = int(8 * multiplier)
    nutr["dietary_fiber_g"] = round(3 * multiplier, 1)
    nutr["sodium_mg"] = int(800 * multiplier)
    nutr["protein_g"] = round(10 * multiplier)
    nutr["vitamin_a_dv"] = int(6 * multiplier)
    nutr["vitamin_c_dv"] = int(10 * multiplier)
    nutr["iron_dv"] = int(10 * multiplier)
    
    if "chicken" in name.lower():
        nutr["protein_g"] = round(22 * multiplier)
        nutr["calories"] = int(450 * multiplier)
        nutr["cholesterol_mg"] = int(65 * multiplier)
        nutr["total_fat_g"] = round(14 * multiplier, 1)
        
    if is_vegan:
        nutr["cholesterol_mg"] = 0
        
    if has_nuts:
        nutr["calories"] += int(50 * multiplier)
        nutr["total_fat_g"] = round(nutr["total_fat_g"] + 4 * multiplier, 1)
        nutr["protein_g"] += round(2 * multiplier)
        
    return nutr


def categorize_food(name: str, tags: list) -> str:
    """Categorize food item for estimation."""
    name_lower = name.lower()
    
    # Pad Thai (check first before proteins)
    if "pad thai" in name_lower:
        return "pad_thai"
    
    # Proteins
    if any(x in name_lower for x in ["chicken", "salmon", "pork", "beef", "fish", "meat", "calamari", "pepperoni"]):
        return "protein"
        
    # Starches
    if any(x in name_lower for x in ["rice", "pasta", "spaghetti", "potato", "quinoa", "tortilla", "spirals", "farfalle"]):
        return "starch"
        
    # Vegetables
    if any(x in name_lower for x in ["broccoli", "cauliflower", "carrot", "green bean", "spinach", "cabbage", "vegetable", "bean sprout"]):
        return "vegetable"
        
    # Soups
    if any(x in name_lower for x in ["soup", "chili"]):
        return "soup"
        
    # Pizza
    if "pizza" in name_lower:
        return "pizza"
        
    # Mexican
    if any(x in name_lower for x in ["burrito", "taco", "salsa"]):
        return "mexican"
        
    # Beans
    if "bean" in name_lower and "green" not in name_lower:
        return "beans"
        
    # Salads
    if "salad" in name_lower:
        return "salad"
        
    # Bread
    if any(x in name_lower for x in ["bread", "breadstick"]):
        return "bread"
        
    # Desserts
    if any(x in name_lower for x in ["cake", "pie", "cookie", "crisp", "quiche"]):
        return "dessert"
        
    # Sauces
    if any(x in name_lower for x in ["sauce", "marinara"]):
        return "sauce"
        
    # Sushi
    if "roll" in name_lower:
        return "sushi"
        
    # Pad Thai
    if "pad thai" in name_lower:
        return "pad_thai"
        
    return "generic"


def estimate_nutrition(name: str, serving_size: str, tags: list, category: str = None) -> dict:
    """
    Main function to estimate nutrition for a food item.
    """
    food_category = categorize_food(name, tags)
    
    estimators = {
        "protein": estimate_protein_nutrition,
        "starch": estimate_starch_nutrition,
        "vegetable": estimate_vegetable_nutrition,
        "soup": estimate_soup_nutrition,
        "pizza": estimate_pizza_nutrition,
        "mexican": estimate_mexican_nutrition,
        "beans": estimate_beans_nutrition,
        "salad": estimate_salad_nutrition,
        "bread": estimate_bread_nutrition,
        "dessert": estimate_dessert_nutrition,
        "sauce": estimate_sauce_nutrition,
        "sushi": estimate_sushi_nutrition,
        "pad_thai": estimate_pad_thai_nutrition,
    }
    
    estimator = estimators.get(food_category, estimate_vegetable_nutrition)
    nutr = estimator(name, serving_size, tags)
    
    # Calculate daily value percentages
    nutr["total_fat_dv"] = calc_dv_percent(nutr["total_fat_g"], DAILY_VALUES["total_fat"])
    nutr["saturated_fat_dv"] = calc_dv_percent(nutr["saturated_fat_g"], DAILY_VALUES["saturated_fat"])
    nutr["cholesterol_dv"] = calc_dv_percent(nutr["cholesterol_mg"], DAILY_VALUES["cholesterol"])
    nutr["sodium_dv"] = calc_dv_percent(nutr["sodium_mg"], DAILY_VALUES["sodium"])
    nutr["total_carbs_dv"] = calc_dv_percent(nutr["total_carbs_g"], DAILY_VALUES["total_carbs"])
    nutr["dietary_fiber_dv"] = calc_dv_percent(nutr["dietary_fiber_g"], DAILY_VALUES["dietary_fiber"])
    
    # Calculate calories from fat
    nutr["calories_from_fat"] = int(nutr["total_fat_g"] * 9)
    
    # Ensure integer values where appropriate
    for key in ["calories", "calories_from_fat", "cholesterol_mg", "sodium_mg", 
                "total_carbs_g", "sugars_g", "protein_g"]:
        nutr[key] = int(nutr.get(key, 0))
        
    # Round decimal values
    for key in ["total_fat_g", "saturated_fat_g", "trans_fat_g", "dietary_fiber_g"]:
        nutr[key] = round(nutr.get(key, 0), 1)
        
    return nutr


def process_menu_data(menu_data: dict) -> dict:
    """
    Process scraped menu data and add nutrition estimates.
    """
    result = {
        "date": menu_data.get("date"),
        "generated_at": datetime.now().isoformat(),
        "source": "Estimated based on typical institutional food preparation",
        "disclaimer": "These are estimates only. Actual nutrition values may vary based on preparation methods, portion sizes, and ingredient variations.",
        "daily_values_basis": "2000 calorie diet",
        "items": []
    }
    
    for hall_name, hall_data in menu_data.get("dining_halls", {}).items():
        for meal_name, meal_data in hall_data.get("meals", {}).items():
            for category, items in meal_data.get("categories", {}).items():
                for item in items:
                    nutrition = estimate_nutrition(
                        item["name"],
                        item["serving_size"],
                        item.get("dietary_tags", []),
                        category
                    )
                    
                    result["items"].append({
                        "dining_hall": hall_name,
                        "meal": meal_name,
                        "category": category,
                        "name": item["name"],
                        "serving_size": item["serving_size"],
                        "dietary_tags": item.get("dietary_tags", []),
                        "nutrition_facts": nutrition
                    })
    
    return result


def main():
    print("=" * 60)
    print("UCSB Dining Menu Nutrition Estimator")
    print("=" * 60)
    
    # Load scraped menu data
    try:
        with open("netnutrition_menu.json", "r") as f:
            menu_data = json.load(f)
        print(f"Loaded menu data from {menu_data.get('date')}")
    except FileNotFoundError:
        print("Error: netnutrition_menu.json not found")
        return
    
    # Process and estimate nutrition
    nutrition_data = process_menu_data(menu_data)
    
    # Save to JSON
    with open("nutrition.json", "w") as f:
        json.dump(nutrition_data, f, indent=2)
    
    print(f"\nProcessed {len(nutrition_data['items'])} items")
    print("Saved to nutrition.json")
    
    # Print sample
    print("\n--- Sample Nutrition Facts ---")
    for item in nutrition_data["items"][:3]:
        print(f"\n{item['name']} ({item['serving_size']})")
        print(f"  Calories: {item['nutrition_facts']['calories']}")
        print(f"  Total Fat: {item['nutrition_facts']['total_fat_g']}g ({item['nutrition_facts']['total_fat_dv']}% DV)")
        print(f"  Sodium: {item['nutrition_facts']['sodium_mg']}mg ({item['nutrition_facts']['sodium_dv']}% DV)")
        print(f"  Carbs: {item['nutrition_facts']['total_carbs_g']}g ({item['nutrition_facts']['total_carbs_dv']}% DV)")
        print(f"  Protein: {item['nutrition_facts']['protein_g']}g")


if __name__ == "__main__":
    main()
