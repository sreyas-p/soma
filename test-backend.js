const axios = require('axios');

async function testBackend() {
  const urls = [
    'http://10.131.203.110:3001/chat',  // Your computer's current IP
    'http://192.168.6.87:3001/chat',  // Your computer's IP
    'http://localhost:3001/chat',
    'http://127.0.0.1:3001/chat',
  ];

  for (const url of urls) {
    try {
      console.log(`\n🧪 Testing: ${url}`);
      
      const response = await axios.post(url, {
        agent: 'Nutri',
        messages: [{ role: 'user', content: 'Hello, can you help me with nutrition?' }]
      }, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('✅ Success!');
      console.log('Response:', response.data.choices[0].message.content.substring(0, 100) + '...');
      
    } catch (error) {
      console.log('❌ Failed:', error.message);
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Data:', error.response.data);
      }
    }
  }
}

console.log('🚀 Testing backend connectivity...');
testBackend().then(() => {
  console.log('\n✅ Backend test completed!');
}).catch(console.error); 