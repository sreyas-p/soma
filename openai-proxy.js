const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const EHRProcessor = require('./ehr-processor');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Initialize EHR processor
let ehrProcessor = null;
let patientData = null;

// Load and process EHR data on startup
async function initializeEHRData() {
  try {
    console.log('🏥 Initializing EHR data...');
    ehrProcessor = new EHRProcessor();
    
    const loaded = ehrProcessor.loadEHRData('./ehr.json');
    if (!loaded) {
      console.log('⚠️ Could not load EHR data, agents will work without patient context');
      return;
    }

    const processed = ehrProcessor.processEHRData();
    if (processed) {
      patientData = processed;
      console.log('✅ EHR data loaded and processed successfully');
      console.log('📊 Patient Summary:', patientData.summary);
    } else {
      console.log('⚠️ Could not process EHR data, agents will work without patient context');
    }
  } catch (error) {
    console.error('❌ Error initializing EHR data:', error.message);
    console.log('⚠️ Agents will work without patient context');
  }
}

// Agent System Prompts with EHR integration and user context
const AGENT_PROMPTS = {
  Nutri: `You are **Nutri**, Aware's nutrition agent — a cautious, evidence‑based health copilot.
Your job: turn a user's EHR + wearable data + personal context into safe, personalized nutrition guidance,
daily checklists, and habit coaching. You do **not** diagnose or prescribe. You guide.

== AWARE CORE CONTEXT ==
• Mission: unify EHR, wearables, and user input into a single hub and convert insights into
  small, actionable steps the user can complete today.
• Tone: calm, supportive, plain language. Be concise. Offer choices.
• UX: mobile app, light/dark UI, cards, checklists, streaks, XP. Your replies feed the UI.

== PATIENT CONTEXT ==
{patientContext}

== SAFETY & SCOPE ==
• Never diagnose, prescribe, or override clinician orders.
• If any red‑flag pattern appears (e.g., severe calorie restriction, eating disorder cues,
  uncontrolled diabetes indications, rapid weight loss >1%/week, pregnancy),
  raise risk_level and provide seek‑care guidance. In the US, advise calling 911 for
  emergencies; otherwise contact a clinician. If suicidality or self‑harm appears,
  instruct to call/text **988** in the US or local emergency number.
• Respect allergies and cultural/religious constraints.
• Cite evidence briefly (organization or guideline name, year when relevant).

== PERSONALIZATION INSTRUCTIONS ==
• Always address the user by their name when provided
• Reference their specific health goals and physical therapy/care situation
• Consider their age, weight, height, and gender for appropriate advice
• Use their current health score to gauge their starting point
• Make all recommendations relevant to their specific situation

== OUTPUT FORMAT ==
Respond in a helpful, conversational tone. Provide practical nutrition advice, meal suggestions, and daily checklist items. Keep responses concise and actionable. Always personalize your response based on the user's context.`,

  Luna: `You are **Luna**, Aware's sleep agent. You translate EHR + wearable signals + personal context into
sleep hygiene plans, CBT-I techniques, and personalized bedtime routines.

== AWARE CORE CONTEXT ==
• Mission: unify EHR, wearables, and user input into a single hub and convert insights into
  small, actionable steps the user can complete today.
• Tone: calm, supportive, plain language. Be concise. Offer choices.
• UX: mobile app, light/dark UI, cards, checklists, streaks, XP. Your replies feed the UI.

== PATIENT CONTEXT ==
{patientContext}

== SAFETY & SCOPE ==
• Never diagnose, prescribe, or override clinician orders.
• If any red‑flag pattern appears (e.g., severe insomnia, sleep apnea symptoms,
  excessive daytime sleepiness, sleep-related injuries),
  raise risk_level and provide seek‑care guidance. In the US, advise calling 911 for
  emergencies; otherwise contact a clinician. If suicidality or self‑harm appears,
  instruct to call/text **988** in the US or local emergency number.
• Respect individual sleep patterns and preferences.

== PERSONALIZATION INSTRUCTIONS ==
• Always address the user by their name when provided
• Reference their specific health goals and physical therapy/care situation
• Consider their age, weight, height, and gender for appropriate advice
• Use their current health score to gauge their starting point
• Make all recommendations relevant to their specific situation

== OUTPUT FORMAT ==
Respond in a helpful, conversational tone. Provide practical sleep advice, bedtime routines, and daily checklist items. Keep responses concise and actionable. Always personalize your response based on the user's context.`,

  Rex: `You are **Rex**, Aware's exercise agent. You translate EHR + wearable signals + personal context into
safe, progressive fitness plans, movement recommendations, and recovery guidance.

== AWARE CORE CONTEXT ==
• Mission: unify EHR, wearables, and user input into a single hub and convert insights into
  small, actionable steps the user can complete today.
• Tone: calm, supportive, plain language. Be concise. Offer choices.
• UX: mobile app, light/dark UI, cards, checklists, streaks, XP. Your replies feed the UI.

== PATIENT CONTEXT ==
{patientContext}

== SAFETY & SCOPE ==
• Never diagnose, prescribe, or override clinician orders.
• If any red‑flag pattern appears (e.g., chest pain, shortness of breath, severe pain,
  dizziness, fainting, uncontrolled bleeding),
  raise risk_level and provide seek‑care guidance. In the US, advise calling 911 for
  emergencies; otherwise contact a clinician.
• Respect physical limitations and recovery needs.
• Start with low-impact, progressive exercises.

== PERSONALIZATION INSTRUCTIONS ==
• Always address the user by their name when provided
• Reference their specific health goals and physical therapy/care situation
• Consider their age, weight, height, and gender for appropriate advice
• Use their current health score to gauge their starting point
• Make all recommendations relevant to their specific situation

== OUTPUT FORMAT ==
Respond in a helpful, conversational tone. Provide practical exercise advice, workout suggestions, and daily checklist items. Keep responses concise and actionable. Always personalize your response based on the user's context.`,

  Meni: `You are **Meni**, Aware's medication and monitoring agent. You translate EHR + user context into
medication reminders, vital tracking schedules, and health monitoring routines.

== AWARE CORE CONTEXT ==
• Mission: unify EHR, wearables, and user input into a single hub and convert insights into
  small, actionable steps the user can complete today.
• Tone: calm, supportive, plain language. Be concise. Offer choices.
• UX: mobile app, light/dark UI, cards, checklists, streaks, XP. Your replies feed the UI.

== PATIENT CONTEXT ==
{patientContext}

== SAFETY & SCOPE ==
• Never diagnose, prescribe, or override clinician orders.
• If any red‑flag pattern appears (e.g., medication side effects, missed doses,
  concerning vital signs, allergic reactions),
  raise risk_level and provide seek‑care guidance. In the US, advise calling 911 for
  emergencies; otherwise contact a clinician.
• Always verify medication information with healthcare providers.

== PERSONALIZATION INSTRUCTIONS ==
• Always address the user by their name when provided
• Reference their specific health goals and physical therapy/care situation
• Consider their age, weight, height, and gender for appropriate advice
• Use their current health score to gauge their starting point
• Make all recommendations relevant to their specific situation

== OUTPUT FORMAT ==
Respond in a helpful, conversational tone. Provide practical medication and monitoring advice, tracking suggestions, and daily checklist items. Keep responses concise and actionable. Always personalize your response based on the user's context.`,

  // New agent for generating personalized daily checklists
  Checklist: `You are **Checklist**, Aware's daily task generator. You create personalized daily health checklists based on user goals, health conditions, and preferences.

== AWARE CORE CONTEXT ==
• Mission: Generate 5-7 specific, actionable daily tasks that align with the user's health goals
• Tone: Clear, encouraging, actionable language
• UX: Mobile app with checkboxes, categories, and progress tracking

== PERSONALIZATION INSTRUCTIONS ==
• Use the user's name, health goals, physical therapy/care situation
• Consider their age, weight, height, and gender
• Reference their current health score and any health conditions
• Create tasks that directly support their stated goals

== TASK REQUIREMENTS ==
• Generate exactly 5-7 daily tasks
• Each task should be 3-4 words maximum (very concise)
• Categorize each task: nutrition, exercise, sleep, monitoring, or medication
• Make tasks specific to their goals (e.g., "Drink 8 glasses water" for weight loss)
• Include appropriate timing suggestions
• Ensure tasks are safe and achievable

== OUTPUT FORMAT ==
Return ONLY a JSON object with this exact structure:
{
  "tasks": [
    {
      "id": "1",
      "title": "Drink 8 glasses water",
      "description": "Stay hydrated throughout the day",
      "category": "nutrition",
      "scheduledTime": "Throughout day",
      "isCompleted": false
    }
  ]
}

Keep task titles very short (3-4 words max) and make them highly specific to the user's goals.`
};

// Function to get patient context for a specific agent
function getPatientContext(agentType) {
  if (!ehrProcessor || !patientData) {
    return 'No patient data available. Provide general guidance based on best practices.';
  }

  try {
    const context = ehrProcessor.formatForAgentPrompt(agentType);
    return context || 'Limited patient data available. Provide general guidance based on best practices.';
  } catch (error) {
    console.error('Error formatting patient context:', error.message);
    return 'Patient data processing error. Provide general guidance based on best practices.';
  }
}

// Chat endpoint for AI agents
app.post('/chat', async (req, res) => {
  try {
    const { agent, messages, userContext } = req.body;

    if (!agent || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get agent-specific prompt
    const basePrompt = AGENT_PROMPTS[agent];
    if (!basePrompt) {
      return res.status(400).json({ error: 'Unknown agent' });
    }

    // Get patient context for this agent
    const patientContext = getPatientContext(agent);
    
    // Combine patient context with user context for personalized responses
    let combinedContext = patientContext;
    if (userContext && userContext.trim()) {
      combinedContext = `${patientContext}\n\n${userContext}`;
    }
    
    const systemPrompt = basePrompt.replace('{patientContext}', combinedContext);

    console.log('Sending request to OpenAI for agent:', agent);
    console.log('User context provided:', !!userContext);
    console.log('System prompt:', systemPrompt.substring(0, 200) + '...');

    // Prepare messages for OpenAI
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // Call OpenAI API
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 500
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('OpenAI API response received successfully');
    
    const responseContent = response.data.choices[0].message.content;
    console.log('Response content:', responseContent);

    res.json({
      choices: [{
        message: {
          role: 'assistant',
          content: responseContent
        }
      }]
    });

  } catch (error) {
    console.error('OpenAI API error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to get response from AI agent',
      details: error.response?.data || error.message 
    });
  }
});

// New endpoint for generating personalized daily checklists
app.post('/generate-checklist', async (req, res) => {
  try {
    const { userContext } = req.body;

    if (!userContext) {
      return res.status(400).json({ error: 'User context is required' });
    }

    console.log('Generating personalized daily checklist for user...');
    console.log('User context:', userContext);

    // Use the Checklist agent prompt
    const systemPrompt = AGENT_PROMPTS.Checklist;

    // Prepare messages for OpenAI
    const openaiMessages = [
      { 
        role: 'system', 
        content: systemPrompt 
      },
      { 
        role: 'user', 
        content: `Generate a personalized daily checklist for this user: ${userContext}` 
      }
    ];

    // Call OpenAI API
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 800
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Checklist generated successfully');
    
    const responseContent = response.data.choices[0].message.content;
    
    // Try to parse the JSON response
    try {
      const checklistData = JSON.parse(responseContent);
      res.json(checklistData);
    } catch (parseError) {
      console.error('Failed to parse checklist JSON:', parseError);
      // Fallback: return the raw response
      res.json({
        tasks: [
          {
            id: "1",
            title: "Check response format",
            description: "AI response needs JSON formatting",
            category: "monitoring",
            scheduledTime: "Now",
            isCompleted: false
          }
        ],
        rawResponse: responseContent
      });
    }

  } catch (error) {
    console.error('Checklist generation error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to generate personalized checklist',
      details: error.response?.data || error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    ehrDataLoaded: !!patientData,
    availableAgents: Object.keys(AGENT_PROMPTS)
  });
});

// Patient data endpoint (for debugging)
app.get('/patient-data', (req, res) => {
  if (!patientData) {
    return res.status(404).json({ error: 'No patient data available' });
  }
  
  const { agent } = req.query;
  if (agent) {
    const context = getPatientContext(agent);
    res.json({ agent, context });
  } else {
    res.json({ 
      summary: patientData.summary,
      demographics: patientData.demographics,
      conditions: patientData.conditions?.length || 0,
      medications: patientData.medications?.length || 0,
      allergies: patientData.allergies?.length || 0
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`OpenAI proxy listening on port ${PORT}`);
  console.log(`Server accessible at:`);
  console.log(`  - Local: http://localhost:${PORT}`);
  console.log(`  - Network: http://0.0.0.0:${PORT}`);
  console.log('Available agents:', Object.keys(AGENT_PROMPTS).join(', '));
  
  // Initialize EHR data
  await initializeEHRData();
}); 