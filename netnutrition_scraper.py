#!/usr/bin/env python3
"""
UCSB NetNutrition Menu Scraper

Scrapes dining menu data from https://nutrition.info.dining.ucsb.edu/NetNutrition/1
using Playwright for JavaScript-heavy page navigation.

Exports to JSON and CSV formats.
"""

import csv
import json
import re
import time
from datetime import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

# Configuration
BASE_URL = "https://nutrition.info.dining.ucsb.edu/NetNutrition/1"

# Dining halls to scrape
DINING_HALLS = [
    "Carrillo Dining Commons",
    "De La Guerra Dining Commons",
    "Portola Dining Commons",
    "Takeout at Ortega Commons",
]

TARGET_MEAL = "Dinner"  # Options: Breakfast, Brunch, Lunch, Dinner
HEADLESS = False  # Set to True for production
DELAY_BETWEEN_HALLS = 1  # seconds


def parse_dietary_tags(item_name: str) -> tuple[str, list[str]]:
    """
    Extract dietary tags from item name.
    Returns (clean_name, [tags])
    """
    tags = []
    clean_name = item_name

    tag_patterns = [
        (r"\s*\(vgn\)\s*", "vegan"),
        (r"\s*\(v\)\s*", "vegetarian"),
        (r"\s*\(w/nuts?\)\s*", "contains_nuts"),
        (r"\s*\(w/nut\)\s*", "contains_nuts"),
    ]

    for pattern, tag in tag_patterns:
        if re.search(pattern, item_name, re.IGNORECASE):
            if tag not in tags:  # Avoid duplicates
                tags.append(tag)
            clean_name = re.sub(pattern, " ", clean_name, flags=re.IGNORECASE)

    return clean_name.strip(), tags


def scrape_menu_page(page) -> dict:
    """
    Scrape all menu items from the current menu page.
    Returns dict of {category: [items]}
    """
    categories = {}

    try:
        # Wait for the table to load
        page.wait_for_selector("table", timeout=10000)
        time.sleep(0.5)

        # Use JavaScript to parse the table structure
        menu_data = page.evaluate("""
            () => {
                const result = [];
                const tbody = document.querySelector('table tbody');
                if (!tbody) return result;

                let currentCategory = 'Uncategorized';

                // Get all children of tbody
                const children = tbody.children;

                for (const child of children) {
                    // Check if this is a category header (treegrid with button)
                    const btn = child.querySelector('button');
                    if (btn && (child.getAttribute('role') === 'treegrid' || 
                                child.querySelector('[role="gridcell"]'))) {
                        currentCategory = btn.innerText.trim();
                        continue;
                    }

                    // Check if this is an item row (has multiple td cells)
                    const cells = child.querySelectorAll('td');
                    if (cells.length >= 3) {
                        const nameCell = cells[1];
                        const servingCell = cells[2];

                        if (nameCell) {
                            const link = nameCell.querySelector('a');
                            const name = link ? link.innerText.trim() : nameCell.innerText.trim();
                            const serving = servingCell ? servingCell.innerText.trim() : '';

                            if (name) {
                                result.push({
                                    category: currentCategory,
                                    name: name,
                                    serving_size: serving
                                });
                            }
                        }
                    }
                }

                return result;
            }
        """)

        # Process the results
        for item in menu_data:
            cat = item["category"]
            if cat not in categories:
                categories[cat] = []

            clean_name, dietary_tags = parse_dietary_tags(item["name"])
            categories[cat].append({
                "name": clean_name,
                "serving_size": item["serving_size"],
                "dietary_tags": dietary_tags,
            })

    except PlaywrightTimeout:
        print("    Timeout waiting for menu table")
    except Exception as e:
        print(f"    Error parsing menu: {e}")

    return categories


def go_to_home(page):
    """Navigate to the home page by clicking the Home link."""
    try:
        # Click the Home link to reset navigation state
        home_clicked = page.evaluate("""
            () => {
                const homeLink = document.querySelector('a[href=""]');
                if (homeLink && homeLink.innerText.includes('Home')) {
                    homeLink.click();
                    return true;
                }
                // Try finding by text
                const links = document.querySelectorAll('nav a, header a');
                for (const link of links) {
                    if (link.innerText.trim() === 'Home') {
                        link.click();
                        return true;
                    }
                }
                return false;
            }
        """)
        if home_clicked:
            page.wait_for_load_state("networkidle")
            time.sleep(0.5)
            return True
    except Exception:
        pass

    # Fallback: reload the page completely
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    time.sleep(0.5)
    return True


def scrape_dining_hall(page, hall_name: str, meal: str) -> dict:
    """
    Navigate to a dining hall and scrape its menu for the specified meal.
    """
    short_name = hall_name.replace(" Dining Commons", "").replace("Takeout at ", "").replace(" Commons", "")
    print(f"\nScraping {hall_name} - {meal}...")

    result = {
        "name": hall_name,
        "meals": {}
    }

    try:
        # Go to home page first
        go_to_home(page)
        time.sleep(0.5)

        # Click on the dining hall link in the main content area
        hall_clicked = page.evaluate(f"""
            () => {{
                const main = document.querySelector('main');
                if (!main) return false;
                const links = main.querySelectorAll('a');
                for (const link of links) {{
                    if (link.innerText.trim() === "{hall_name}" && link.offsetParent !== null) {{
                        link.click();
                        return true;
                    }}
                }}
                return false;
            }}
        """)

        if not hall_clicked:
            print(f"  Could not find link for {hall_name}")
            return result

        page.wait_for_load_state("networkidle")
        time.sleep(0.5)

        # Look for the Daily Menu link
        daily_menu_clicked = page.evaluate(f"""
            () => {{
                const main = document.querySelector('main');
                if (!main) return false;
                const links = main.querySelectorAll('a');
                for (const link of links) {{
                    if (link.innerText.includes("Daily Menu") && link.offsetParent !== null) {{
                        link.click();
                        return true;
                    }}
                }}
                return false;
            }}
        """)

        if not daily_menu_clicked:
            print(f"  Could not find Daily Menu for {hall_name}")
            return result

        page.wait_for_load_state("networkidle")
        time.sleep(0.5)

        # Find and click the target meal link
        meal_clicked = page.evaluate(f"""
            () => {{
                const main = document.querySelector('main');
                if (!main) return false;
                const links = main.querySelectorAll('a');
                for (const link of links) {{
                    if (link.innerText.trim() === "{meal}" && link.offsetParent !== null) {{
                        link.click();
                        return true;
                    }}
                }}
                return false;
            }}
        """)

        if not meal_clicked:
            print(f"  Could not find {meal} for {hall_name}")
            return result

        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # Now scrape the menu items
        categories = scrape_menu_page(page)

        if categories:
            result["meals"][meal] = {"categories": categories}
            total_items = sum(len(items) for items in categories.values())
            print(f"  Found {total_items} items in {len(categories)} categories")
            for cat, items in categories.items():
                print(f"    - {cat}: {len(items)} items")
        else:
            print(f"  No items found for {meal}")

    except Exception as e:
        print(f"  Error scraping {hall_name}: {e}")
        import traceback
        traceback.print_exc()

    return result


def scrape_all_dining_halls(headless: bool = HEADLESS) -> dict:
    """
    Main function to scrape all dining halls.
    """
    today = datetime.now().strftime("%Y-%m-%d")

    result = {
        "date": today,
        "scraped_at": datetime.now().isoformat(),
        "target_meal": TARGET_MEAL,
        "dining_halls": {}
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        )
        page = context.new_page()

        # Initial navigation
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        for hall_name in DINING_HALLS:
            hall_data = scrape_dining_hall(page, hall_name, TARGET_MEAL)

            # Use short name as key
            short_name = hall_name.replace(" Dining Commons", "").replace("Takeout at ", "").replace(" Commons", "")
            result["dining_halls"][short_name] = hall_data

            time.sleep(DELAY_BETWEEN_HALLS)

        browser.close()

    return result


def export_to_json(data: dict, filename: str = "netnutrition_menu.json"):
    """Export data to JSON file."""
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\nSaved to {filename}")


def export_to_csv(data: dict, filename: str = "netnutrition_menu.csv"):
    """Export data to CSV file."""
    rows = []

    date = data.get("date", "")

    for hall_name, hall_data in data.get("dining_halls", {}).items():
        for meal_name, meal_data in hall_data.get("meals", {}).items():
            for category, items in meal_data.get("categories", {}).items():
                for item in items:
                    rows.append({
                        "date": date,
                        "dining_hall": hall_name,
                        "meal": meal_name,
                        "category": category,
                        "item_name": item.get("name", ""),
                        "serving_size": item.get("serving_size", ""),
                        "dietary_tags": ", ".join(item.get("dietary_tags", [])),
                    })

    if rows:
        with open(filename, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
        print(f"Saved to {filename}")
    else:
        print("No data to export to CSV")


def main():
    print("=" * 60)
    print("UCSB NetNutrition Menu Scraper")
    print("=" * 60)
    print(f"Target meal: {TARGET_MEAL}")
    print(f"Dining halls: {len(DINING_HALLS)}")
    print(f"Headless mode: {HEADLESS}")
    print("=" * 60)

    data = scrape_all_dining_halls()

    export_to_json(data)
    export_to_csv(data)

    # Print summary
    total_items = sum(
        len(items)
        for hall in data["dining_halls"].values()
        for meal in hall.get("meals", {}).values()
        for items in meal.get("categories", {}).values()
    )
    print(f"\nTotal items scraped: {total_items}")


if __name__ == "__main__":
    main()
