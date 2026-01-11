const fs = require('fs');

console.log('🧪 Simple EHR Test Starting...');

try {
  // Check if file exists
  console.log('📂 Checking file...');
  const stats = fs.statSync('./ehr.json');
  console.log('✅ File exists, size:', stats.size, 'bytes');

  // Read and parse JSON
  console.log('📖 Reading file...');
  const rawData = fs.readFileSync('./ehr.json', 'utf8');
  console.log('✅ File read successfully');

  console.log('🔍 Parsing JSON...');
  const data = JSON.parse(rawData);
  console.log('✅ JSON parsed successfully');

  // Check structure
  console.log('📊 Data structure:');
  console.log('Keys:', Object.keys(data));
  
  if (data.fhir) {
    console.log('FHIR keys:', Object.keys(data.fhir));
    
    // Check for Patient data
    if (data.fhir.Patient) {
      console.log('Patient records:', data.fhir.Patient.length);
      if (data.fhir.Patient[0]) {
        console.log('First patient:', data.fhir.Patient[0].name?.[0]?.text || 'No name');
      }
    }

    // Check for Observations
    if (data.fhir.Observation) {
      console.log('Observation records:', data.fhir.Observation.length);
    }

    // Check for Conditions
    if (data.fhir.Condition) {
      console.log('Condition records:', data.fhir.Condition.length);
    }

    // Check for Medications
    if (data.fhir.Medication) {
      console.log('Medication records:', data.fhir.Medication.length);
    }
  }

  console.log('✅ Test completed successfully!');

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Stack:', error.stack);
} 