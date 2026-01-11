const axios = require('axios');

const BACKEND_URL = 'http://localhost:3001/chat';

const testMessages = {
  'Nutri': 'I want to lose weight and improve my nutrition. I\'m 30 years old, 180cm, 85kg, and I walk about 8,000 steps per day.',
  'Luna': 'I have trouble falling asleep and often wake up in the middle of the night. I usually go to bed around 11 PM and wake up at 7 AM.',
  'Rex': 'I want to get stronger and more fit. I\'m a beginner with no equipment at home. I can work out 3 times per week for about 30 minutes.',
  'Meni': 'I feel stressed and anxious lately. I have trouble focusing at work and often feel overwhelmed. I want to learn some relaxation techniques.'
};

async function testAgent(agentName, message) {
  try {
    console.log(`\n🧪 Testing ${agentName}...`);
    console.log(`Message: "${message}"`);
    
    const response = await axios.post(BACKEND_URL, {
      agent: agentName,
      messages: [
        { role: 'user', content: message }
      ]
    });

    console.log(`✅ ${agentName} Response:`);
    console.log(response.data.choices[0].message.content);
    console.log('─'.repeat(50));
    
  } catch (error) {
    console.error(`❌ Error testing ${agentName}:`, error.response?.data || error.message);
  }
}

async function testAllAgents() {
  console.log('🚀 Testing all Aware agents with specialized prompts...\n');
  
  for (const [agent, message] of Object.entries(testMessages)) {
    await testAgent(agent, message);
    // Wait a bit between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ All agent tests completed!');
}

testAllAgents().catch(console.error); 