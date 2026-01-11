#!/usr/bin/env python3
"""
UCSB Dining AI Agent

An AI agent that can answer questions about UCSB dining menus using
OpenAI function calling with Supabase as the data source.
"""

import json
import os
from datetime import datetime
from typing import Optional, List, Dict, Any

from dotenv import load_dotenv
from openai import OpenAI

# Import our query functions
from dining_agent_queries import (
    get_dining_halls,
    get_meal_periods,
    get_todays_menu,
    search_menu_items,
    get_nutrition_info,
    compare_items,
    get_high_protein_items,
    get_low_calorie_items,
    get_vegan_items,
    get_vegetarian_items,
    get_current_meal_period,
    format_menu_for_display,
)

load_dotenv()

# Initialize OpenAI client (works with OpenRouter too)
api_key = os.getenv("OPENAI_API_KEY")
base_url = None

# Detect OpenRouter key (starts with sk-or-)
if api_key and api_key.startswith("sk-or-"):
    base_url = "https://openrouter.ai/api/v1"

client = OpenAI(api_key=api_key, base_url=base_url)

# ============================================
# System Prompt
# ============================================

SYSTEM_PROMPT = """You are a helpful AI assistant for UCSB students asking about campus dining menus and nutrition.

You have access to real-time menu data from 4 dining halls:
- Carrillo Dining Commons
- De La Guerra Dining Commons (also called "DLG")
- Portola Dining Commons
- Takeout at Ortega Commons (also called "Ortega")

Current date: {current_date}
Current time: {current_time}
Current/next meal period: {current_meal}

IMPORTANT GUIDELINES:
1. When a user asks about dining options, determine:
   - Which dining hall(s) they're asking about (ask if unclear)
   - The date (default to today if not specified)
   - The meal period (use current/upcoming meal if not specified)
   - Any dietary restrictions or nutrition requirements

2. Use the available functions to fetch real data from the database.

3. When presenting food items, always include:
   - Item name
   - Serving size
   - Calories
   - Key nutrition info (protein, etc.) when relevant
   - Dietary tags (🌱 for vegan, 🥛 for vegetarian)

4. Be conversational and helpful. If no items match strict criteria, suggest loosening filters.

5. For comparisons, present data in an easy-to-read format.

6. If a dining hall appears to have no menu, it may be closed - let the user know.

7. Handle these common queries naturally:
   - "What's for dinner?" → Ask which dining hall or show all
   - "Vegan options" → Use search_menu_items with dietary_tags=["vegan"]
   - "High protein" → Use search with min_protein parameter
   - "Under 400 calories" → Use search with max_calories parameter
   - "Nutritional info for X" → Use get_nutrition_info function

Remember: You're helping hungry college students find good food! Be friendly and helpful."""


# ============================================
# Tool Definitions for OpenAI/OpenRouter
# ============================================

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_dining_halls",
            "description": "Get a list of all UCSB dining halls",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_meal_periods",
            "description": "Get available meal periods for a specific date and/or dining hall",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format. Defaults to today."
                    },
                    "dining_hall": {
                        "type": "string",
                        "description": "Name of dining hall (Carrillo, De La Guerra, Portola, Ortega)"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_todays_menu",
            "description": "Get the full menu for a specific dining hall for today",
            "parameters": {
                "type": "object",
                "properties": {
                    "dining_hall": {
                        "type": "string",
                        "description": "Name of dining hall (Carrillo, De La Guerra/DLG, Portola, Ortega)"
                    },
                    "meal_period": {
                        "type": "string",
                        "description": "Meal period: Breakfast, Brunch, Lunch, Dinner, or Late Night",
                        "enum": ["Breakfast", "Brunch", "Lunch", "Dinner", "Late Night"]
                    }
                },
                "required": ["dining_hall"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_menu_items",
            "description": "Search for menu items with filters like dietary restrictions, calories, protein, etc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format. Defaults to today."
                    },
                    "dining_hall": {
                        "type": "string",
                        "description": "Filter by dining hall name"
                    },
                    "meal_period": {
                        "type": "string",
                        "description": "Filter by meal period",
                        "enum": ["Breakfast", "Brunch", "Lunch", "Dinner", "Late Night"]
                    },
                    "dietary_tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Filter by dietary tags like 'vegan', 'vegetarian', 'contains_nuts'"
                    },
                    "max_calories": {
                        "type": "integer",
                        "description": "Maximum calories per serving"
                    },
                    "min_protein": {
                        "type": "integer",
                        "description": "Minimum protein in grams"
                    },
                    "max_sodium": {
                        "type": "integer",
                        "description": "Maximum sodium in mg"
                    },
                    "search_term": {
                        "type": "string",
                        "description": "Search for items containing this text in the name"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_nutrition_info",
            "description": "Get detailed nutrition information for a specific menu item",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_name": {
                        "type": "string",
                        "description": "Name of the food item to look up"
                    },
                    "dining_hall": {
                        "type": "string",
                        "description": "Optional: specific dining hall"
                    },
                    "date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format. Defaults to today."
                    }
                },
                "required": ["item_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "compare_items",
            "description": "Compare nutrition facts for multiple menu items side by side",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of item names to compare"
                    },
                    "date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format. Defaults to today."
                    }
                },
                "required": ["item_names"]
            }
        }
    }
]


# ============================================
# Function Execution
# ============================================

def execute_function(function_name: str, arguments: dict) -> str:
    """Execute a function and return the result as a JSON string."""
    
    function_map = {
        "get_dining_halls": get_dining_halls,
        "get_meal_periods": get_meal_periods,
        "get_todays_menu": get_todays_menu,
        "search_menu_items": search_menu_items,
        "get_nutrition_info": get_nutrition_info,
        "compare_items": compare_items,
    }
    
    if function_name not in function_map:
        return json.dumps({"error": f"Unknown function: {function_name}"})
    
    try:
        result = function_map[function_name](**arguments)
        return json.dumps(result, default=str)
    except Exception as e:
        return json.dumps({"error": str(e)})


# ============================================
# AI Agent
# ============================================

class DiningAgent:
    """AI agent for answering UCSB dining questions."""
    
    def __init__(self, model: str = None):
        # Auto-detect model based on API key type
        if model:
            self.model = model
        elif os.getenv("OPENAI_API_KEY", "").startswith("sk-or-"):
            # OpenRouter - use a model that supports function calling
            self.model = "openai/gpt-4o-mini"
        else:
            self.model = "gpt-4o-mini"
        self.conversation_history: List[Dict[str, Any]] = []
    
    def _get_system_prompt(self) -> str:
        """Get system prompt with current date/time."""
        now = datetime.now()
        return SYSTEM_PROMPT.format(
            current_date=now.strftime("%Y-%m-%d"),
            current_time=now.strftime("%I:%M %p"),
            current_meal=get_current_meal_period()
        )
    
    def reset_conversation(self):
        """Clear conversation history."""
        self.conversation_history = []
    
    def chat(self, user_message: str) -> str:
        """
        Send a message to the AI and get a response.
        
        Args:
            user_message: The user's question about dining
        
        Returns:
            The AI's response string
        """
        # Add user message to history
        self.conversation_history.append({
            "role": "user",
            "content": user_message
        })
        
        # Build messages list
        messages = [
            {"role": "system", "content": self._get_system_prompt()}
        ] + self.conversation_history
        
        # Initial API call (using tools format for OpenRouter compatibility)
        response = client.chat.completions.create(
            model=self.model,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto"
        )
        
        assistant_message = response.choices[0].message
        
        # Handle tool calls (new format)
        while assistant_message.tool_calls:
            # Process each tool call
            tool_results = []
            for tool_call in assistant_message.tool_calls:
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments)
                
                print(f"  [Calling {function_name}({function_args})]")
                
                # Execute the function
                function_result = execute_function(function_name, function_args)
                
                tool_results.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "content": function_result
                })
            
            # Add assistant message with tool calls to history
            self.conversation_history.append({
                "role": "assistant",
                "content": assistant_message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    }
                    for tc in assistant_message.tool_calls
                ]
            })
            
            # Add tool results to history
            for result in tool_results:
                self.conversation_history.append(result)
            
            # Get next response
            messages = [
                {"role": "system", "content": self._get_system_prompt()}
            ] + self.conversation_history
            
            response = client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto"
            )
            
            assistant_message = response.choices[0].message
        
        # Add final response to history
        final_response = assistant_message.content
        self.conversation_history.append({
            "role": "assistant",
            "content": final_response
        })
        
        return final_response


# ============================================
# Interactive CLI
# ============================================

def run_interactive_chat():
    """Run an interactive chat session."""
    print("=" * 60)
    print("🍽️  UCSB Dining AI Assistant")
    print("=" * 60)
    print("Ask me anything about UCSB dining menus!")
    print("Examples:")
    print("  - What's for dinner at Carrillo?")
    print("  - Show me vegan options at DLG")
    print("  - What has the most protein?")
    print("  - Compare cheese pizza vs pepperoni pizza")
    print("  - Find something under 400 calories")
    print("\nType 'quit' to exit, 'reset' to start a new conversation.\n")
    
    agent = DiningAgent()
    
    while True:
        try:
            user_input = input("You: ").strip()
            
            if not user_input:
                continue
            
            if user_input.lower() == "quit":
                print("Goodbye! Enjoy your meal! 🍽️")
                break
            
            if user_input.lower() == "reset":
                agent.reset_conversation()
                print("Conversation reset.\n")
                continue
            
            print("\nAssistant: ", end="")
            response = agent.chat(user_input)
            print(response)
            print()
            
        except KeyboardInterrupt:
            print("\n\nGoodbye! 🍽️")
            break
        except Exception as e:
            print(f"\nError: {e}")
            print("Please try again.\n")


# ============================================
# API Functions for Integration
# ============================================

def ask_dining_question(question: str, model: str = None) -> str:
    """
    Single-turn question answering about dining.
    
    Args:
        question: User's question about UCSB dining
        model: OpenAI model to use
    
    Returns:
        AI response string
    """
    agent = DiningAgent(model=model)
    return agent.chat(question)


def get_dining_response(
    question: str,
    conversation_history: Optional[List[Dict]] = None,
    model: str = None
) -> Dict[str, Any]:
    """
    Get dining response with full metadata.
    
    Args:
        question: User's question
        conversation_history: Previous conversation (optional)
        model: OpenAI model to use
    
    Returns:
        Dictionary with response and updated history
    """
    agent = DiningAgent(model=model)
    
    if conversation_history:
        agent.conversation_history = conversation_history
    
    response = agent.chat(question)
    
    return {
        "response": response,
        "conversation_history": agent.conversation_history
    }


# ============================================
# Main
# ============================================

if __name__ == "__main__":
    # Check for OpenAI API key
    if not os.getenv("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY not found in environment variables.")
        print("Add it to your .env file:")
        print("  OPENAI_API_KEY=sk-your-key-here")
        exit(1)
    
    run_interactive_chat()
