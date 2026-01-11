/**
 * Food Analysis Service
 * Uses Google Gemini API to analyze food photos and estimate nutritional information
 */

import { GEMINI_API_KEY } from '@/config/apiKeys';

// Types for nutritional analysis results
export interface NutritionEstimate {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
}

export interface FoodItem {
  name: string;
  portion_size: string;
  nutrition: NutritionEstimate;
  confidence: 'high' | 'medium' | 'low';
}

export interface FoodAnalysisResult {
  success: boolean;
  items: FoodItem[];
  total_nutrition: NutritionEstimate;
  meal_description: string;
  health_notes: string[];
  error?: string;
}

// Vertex AI Gemini API configuration
const GEMINI_API_URL = 'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.0-flash:generateContent';

/**
 * Analyze a food photo using Google Gemini Vision API
 * @param imageBase64 - Base64 encoded image data (without data:image prefix)
 * @param customApiKey - Optional custom API key (uses configured key if not provided)
 * @returns Food analysis result with nutritional estimates
 */
export async function analyzeFoodPhoto(
  imageBase64: string,
  customApiKey?: string
): Promise<FoodAnalysisResult> {
  const apiKey = customApiKey || GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      items: [],
      total_nutrition: getEmptyNutrition(),
      meal_description: '',
      health_notes: [],
      error: 'Gemini API key not configured. Please add your API key in src/config/apiKeys.ts',
    };
  }

  try {
    const prompt = `Analyze this food image and provide detailed nutritional estimates. 

Please identify each food item visible and estimate its nutritional content. Be specific about portion sizes.

Respond in the following JSON format ONLY (no markdown, no code blocks, just raw JSON):
{
  "items": [
    {
      "name": "Food item name",
      "portion_size": "estimated portion (e.g., '1 cup', '150g', '1 medium')",
      "nutrition": {
        "calories": number,
        "protein_g": number,
        "carbs_g": number,
        "fat_g": number,
        "fiber_g": number,
        "sugar_g": number,
        "sodium_mg": number
      },
      "confidence": "high" | "medium" | "low"
    }
  ],
  "meal_description": "Brief description of the overall meal",
  "health_notes": ["Array of health-related observations or tips"]
}

If you cannot identify food in the image, respond with:
{
  "error": "Could not identify food in this image"
}`;

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          topK: 32,
          topP: 1,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      console.error('Request URL:', `${GEMINI_API_URL}?key=***`);
      
      if (response.status === 400) {
        return {
          success: false,
          items: [],
          total_nutrition: getEmptyNutrition(),
          meal_description: '',
          health_notes: [],
          error: 'Invalid request. Please try with a different image.',
        };
      }
      
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          items: [],
          total_nutrition: getEmptyNutrition(),
          meal_description: '',
          health_notes: [],
          error: 'Invalid API key. Please check your Gemini API key.',
        };
      }
      
      return {
        success: false,
        items: [],
        total_nutrition: getEmptyNutrition(),
        meal_description: '',
        health_notes: [],
        error: `API error: ${response.status}`,
      };
    }

    const data = await response.json();
    
    // Extract the text response from Gemini
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textResponse) {
      return {
        success: false,
        items: [],
        total_nutrition: getEmptyNutrition(),
        meal_description: '',
        health_notes: [],
        error: 'No response from AI. Please try again.',
      };
    }

    // Parse the JSON response
    const analysisResult = parseGeminiResponse(textResponse);
    
    if (analysisResult.error) {
      return {
        success: false,
        items: [],
        total_nutrition: getEmptyNutrition(),
        meal_description: '',
        health_notes: [],
        error: analysisResult.error,
      };
    }

    // Calculate total nutrition
    const totalNutrition = calculateTotalNutrition(analysisResult.items || []);

    return {
      success: true,
      items: analysisResult.items || [],
      total_nutrition: totalNutrition,
      meal_description: analysisResult.meal_description || 'Meal analyzed',
      health_notes: analysisResult.health_notes || [],
    };
  } catch (error) {
    console.error('Food analysis error:', error);
    return {
      success: false,
      items: [],
      total_nutrition: getEmptyNutrition(),
      meal_description: '',
      health_notes: [],
      error: error instanceof Error ? error.message : 'Failed to analyze food photo',
    };
  }
}

/**
 * Parse the Gemini response text into structured data
 */
function parseGeminiResponse(text: string): Partial<FoodAnalysisResult> & { error?: string } {
  try {
    // Clean up the response - remove any markdown code blocks if present
    let cleanedText = text.trim();
    
    // Remove markdown code blocks
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.slice(7);
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.slice(3);
    }
    
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.slice(0, -3);
    }
    
    cleanedText = cleanedText.trim();
    
    const parsed = JSON.parse(cleanedText);
    
    if (parsed.error) {
      return { error: parsed.error };
    }
    
    return {
      items: parsed.items || [],
      meal_description: parsed.meal_description || '',
      health_notes: parsed.health_notes || [],
    };
  } catch (parseError) {
    console.error('Failed to parse Gemini response:', text, parseError);
    return { error: 'Failed to parse nutritional analysis. Please try again.' };
  }
}

/**
 * Calculate total nutrition from all food items
 */
function calculateTotalNutrition(items: FoodItem[]): NutritionEstimate {
  return items.reduce(
    (total, item) => ({
      calories: total.calories + (item.nutrition?.calories || 0),
      protein_g: total.protein_g + (item.nutrition?.protein_g || 0),
      carbs_g: total.carbs_g + (item.nutrition?.carbs_g || 0),
      fat_g: total.fat_g + (item.nutrition?.fat_g || 0),
      fiber_g: total.fiber_g + (item.nutrition?.fiber_g || 0),
      sugar_g: total.sugar_g + (item.nutrition?.sugar_g || 0),
      sodium_mg: total.sodium_mg + (item.nutrition?.sodium_mg || 0),
    }),
    getEmptyNutrition()
  );
}

/**
 * Get empty nutrition object
 */
function getEmptyNutrition(): NutritionEstimate {
  return {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
  };
}

/**
 * Format nutrition value for display
 */
export function formatNutritionValue(value: number, unit: string): string {
  if (unit === 'mg') {
    return `${Math.round(value)}${unit}`;
  }
  return `${value.toFixed(1)}${unit}`;
}

/**
 * Get confidence color for display
 */
export function getConfidenceColor(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high':
      return '#059669'; // green
    case 'medium':
      return '#D97706'; // amber
    case 'low':
      return '#DC2626'; // red
    default:
      return '#78716C'; // grey
  }
}
