const EHRProcessor = require('./ehr-processor');

async function testEHRProcessor() {
  console.log('🧪 Testing EHR Data Processor...\n');

  const processor = new EHRProcessor();

  // Load EHR data
  console.log('📂 Loading EHR data...');
  const loaded = processor.loadEHRData('./ehr.json');
  if (!loaded) {
    console.error('❌ Failed to load EHR data');
    return;
  }

  // Process EHR data
  console.log('🔄 Processing EHR data...');
  const processedData = processor.processEHRData();
  if (!processedData) {
    console.error('❌ Failed to process EHR data');
    return;
  }

  // Display results
  console.log('\n📊 PROCESSED EHR DATA SUMMARY:');
  console.log('================================');

  // Demographics
  if (processedData.demographics) {
    console.log('\n👤 PATIENT DEMOGRAPHICS:');
    console.log(`Name: ${processedData.demographics.name}`);
    console.log(`Age: ${processedData.demographics.age} years old`);
    console.log(`Gender: ${processedData.demographics.gender}`);
    console.log(`Birth Date: ${processedData.demographics.birthDate}`);
  }

  // Vitals
  console.log('\n💓 VITAL SIGNS:');
  Object.entries(processedData.vitals).forEach(([type, values]) => {
    if (values.length > 0) {
      const latest = values[values.length - 1];
      console.log(`${type}: ${latest.value} ${latest.unit} (${new Date(latest.date).toLocaleDateString()})`);
    }
  });

  // Conditions
  if (processedData.conditions?.length > 0) {
    console.log('\n🏥 MEDICAL CONDITIONS:');
    processedData.conditions.forEach(condition => {
      console.log(`- ${condition.display} (${condition.status})`);
    });
  }

  // Medications
  if (processedData.medications?.length > 0) {
    console.log('\n💊 MEDICATIONS:');
    processedData.medications.forEach(med => {
      console.log(`- ${med.name}`);
    });
  }

  // Allergies
  if (processedData.allergies?.length > 0) {
    console.log('\n⚠️ ALLERGIES:');
    processedData.allergies.forEach(allergy => {
      console.log(`- ${allergy.substance} (${allergy.severity || 'Unknown severity'})`);
    });
  }

  // Social History
  if (processedData.socialHistory) {
    console.log('\n🌍 SOCIAL HISTORY:');
    if (processedData.socialHistory.smoking) {
      console.log(`Smoking: ${processedData.socialHistory.smoking.status}`);
    }
    if (processedData.socialHistory.exercise) {
      console.log(`Exercise: ${processedData.socialHistory.exercise.frequency}`);
    }
    if (processedData.socialHistory.alcohol) {
      console.log(`Alcohol: ${processedData.socialHistory.alcohol.status}`);
    }
  }

  // Test agent-specific formatting
  console.log('\n🤖 AGENT-SPECIFIC DATA FORMATTING:');
  console.log('==================================');

  const agents = ['Nutri', 'Luna', 'Rex', 'Meni'];
  agents.forEach(agent => {
    console.log(`\n📋 ${agent.toUpperCase()} AGENT DATA:`);
    const agentData = processor.formatForAgentPrompt(agent);
    console.log(agentData || 'No relevant data found');
  });

  // Export processed data
  console.log('\n💾 Exporting processed data...');
  processor.exportProcessedData('./processed-ehr.json');

  console.log('\n✅ EHR Data Processing Test Complete!');
}

// Run the test
testEHRProcessor().catch(console.error); 