#!/usr/bin/env python3
"""
UCSB Dining Menu Scraper

Scrapes the daily menu from https://apps.dining.ucsb.edu/menu/day
Outputs structured JSON: Dining Common -> Meal Period -> Station -> [Food Items]
"""

import json
import re
import sys

import requests
from bs4 import BeautifulSoup

URL = "https://apps.dining.ucsb.edu/menu/day"


def scrape_dining_menu(url: str = URL) -> dict:
    """
    Scrape UCSB dining menu and return structured dictionary.

    Returns:
        dict: {dining_common: {meal_period: {station: [food_items]}}}
    """
    response = requests.get(url, timeout=15)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    menu = {}

    # Find all h4 tags with data-name attribute (Dining Commons names)
    dc_headers = soup.find_all("h4", attrs={"data-name": True})

    for h4 in dc_headers:
        dc_name = h4.get("data-name")
        if not dc_name:
            continue

        menu[dc_name] = {}

        # Find the collapsible body for this dining common
        dc_code = h4.get("data-code", dc_name.lower().replace(" ", "-"))
        body_id = f"{dc_code}-body"
        body_div = soup.find("div", id=body_id)

        if not body_div:
            continue

        # Find all h5 tags (Meal Periods) within this dining common's body
        for h5 in body_div.find_all("h5"):
            meal_text = h5.get_text(strip=True)

            if not meal_text:
                continue

            # Check if this is a "closed" message
            if "closed" in meal_text.lower():
                menu[dc_name] = {"closed": meal_text}
                break

            # Extract meal period name (e.g., "Brunch" from "Brunch 10:00 AM - 2:00 PM")
            meal_match = re.match(r"^([\w\s]+?)(?:\s*\d|$)", meal_text)
            meal_name = meal_match.group(1).strip() if meal_match else meal_text

            # Extract hours separately if present
            hours_match = re.search(r"(\d+:\d+\s*[AP]M\s*-\s*\d+:\d+\s*[AP]M)", meal_text)
            hours = hours_match.group(1) if hours_match else ""

            menu[dc_name][meal_name] = {"hours": hours, "stations": {}}

            # Structure: h5 is in .panel-heading, dl's are in sibling .panel-body
            panel_heading = h5.find_parent("div", class_="panel-heading")
            if not panel_heading:
                continue

            panel_body = panel_heading.find_next_sibling("div", class_="panel-body")
            if not panel_body:
                continue

            # Find all dl elements (stations) in the panel body
            for dl in panel_body.find_all("dl"):
                dt = dl.find("dt")
                if not dt:
                    continue

                station_name = dt.get_text(strip=True)
                food_items = [dd.get_text(strip=True) for dd in dl.find_all("dd") if dd.get_text(strip=True)]

                if station_name and food_items:
                    menu[dc_name][meal_name]["stations"][station_name] = food_items

    return menu


def main():
    """Main entry point."""
    print(f"Fetching menu from {URL}...\n", file=sys.stderr)

    try:
        menu = scrape_dining_menu()
    except requests.RequestException as e:
        print(f"Error fetching menu: {e}", file=sys.stderr)
        sys.exit(1)

    # Print formatted JSON to stdout
    print(json.dumps(menu, indent=2, ensure_ascii=False))

    # Summary to stderr
    print("\n--- Summary ---", file=sys.stderr)
    for dc, meals in menu.items():
        if isinstance(meals, dict) and "closed" in meals:
            print(f"  {dc}: {meals['closed']}", file=sys.stderr)
        else:
            meal_names = list(meals.keys())
            total_items = sum(
                len(items)
                for meal_data in meals.values()
                if isinstance(meal_data, dict) and "stations" in meal_data
                for items in meal_data["stations"].values()
            )
            print(f"  {dc}: {', '.join(meal_names)} ({total_items} items)", file=sys.stderr)


if __name__ == "__main__":
    main()
