const axios = require('axios');

const API_KEY = process.env.OPENAI_API_KEY;

async function testAPIKey() {
  try {
    console.log('🧪 Testing API key directly with OpenAI...');
    console.log('API Key length:', API_KEY.length);
    console.log('API Key starts with:', API_KEY.substring(0, 20) + '...');
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Hello, this is a test message.' }
        ],
        max_tokens: 50,
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    console.log('✅ API Key is valid!');
    console.log('Response:', response.data.choices[0].message.content);
    
  } catch (error) {
    console.log('❌ API Key test failed:');
    console.log('Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }
}

testAPIKey(); 