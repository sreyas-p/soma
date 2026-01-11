const fs = require('fs');
const path = require('path');

class EHRProcessor {
  constructor() {
    this.ehrData = null;
    this.processedData = null;
  }

  // Load and parse EHR data
  loadEHRData(filePath = './ehr.json') {
    try {
      console.log('📂 Loading EHR data from:', filePath);
      const rawData = fs.readFileSync(filePath, 'utf8');
      this.ehrData = JSON.parse(rawData);
      console.log('✅ EHR data loaded successfully');
      return true;
    } catch (error) {
      console.error('❌ Error loading EHR data:', error.message);
      return false;
    }
  }

  // Extract patient demographics
  extractPatientDemographics() {
    const patient = this.ehrData.fhir.Patient?.[0];
    if (!patient) return null;

    return {
      name: patient.name?.[0]?.text || 'Unknown',
      gender: patient.gender || 'Unknown',
      birthDate: patient.birthDate || 'Unknown',
      age: patient.birthDate ? this.calculateAge(patient.birthDate) : 'Unknown',
      address: patient.address?.[0]?.text || 'Unknown',
      phone: patient.telecom?.find(t => t.system === 'phone')?.value || 'Unknown',
      email: patient.telecom?.find(t => t.system === 'email')?.value || 'Unknown'
    };
  }

  // Calculate age from birth date
  calculateAge(birthDate) {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  // Extract vital signs and measurements
  extractVitals() {
    const observations = this.ehrData.fhir.Observation || [];
    const vitals = {
      bloodPressure: [],
      heartRate: [],
      temperature: [],
      weight: [],
      height: [],
      bmi: [],
      oxygenSaturation: [],
      respiratoryRate: []
    };

    observations.forEach(obs => {
      const code = obs.code?.coding?.[0]?.code;
      const value = obs.valueQuantity?.value;
      const unit = obs.valueQuantity?.unit;
      const date = obs.effectiveDateTime || obs.issued;

      if (!code || !value || !date) return;

      // Map LOINC codes to vital signs
      switch (code) {
        case '85354-9': // Blood pressure
        case '85354-9': // Systolic BP
        case '8462-4': // Diastolic BP
          vitals.bloodPressure.push({ value, unit, date });
          break;
        case '8867-4': // Heart rate
          vitals.heartRate.push({ value, unit, date });
          break;
        case '8310-5': // Temperature
          vitals.temperature.push({ value, unit, date });
          break;
        case '29463-7': // Weight
          vitals.weight.push({ value, unit, date });
          break;
        case '8302-2': // Height
          vitals.height.push({ value, unit, date });
          break;
        case '39156-5': // BMI
          vitals.bmi.push({ value, unit, date });
          break;
        case '2708-6': // Oxygen saturation
          vitals.oxygenSaturation.push({ value, unit, date });
          break;
        case '9279-1': // Respiratory rate
          vitals.respiratoryRate.push({ value, unit, date });
          break;
      }
    });

    return vitals;
  }

  // Extract laboratory results
  extractLabResults() {
    const observations = this.ehrData.fhir.Observation || [];
    const labs = {};

    observations.forEach(obs => {
      const category = obs.category?.[0]?.coding?.[0]?.code;
      if (category !== 'laboratory') return;

      const code = obs.code?.coding?.[0]?.code;
      const display = obs.code?.coding?.[0]?.display;
      const value = obs.valueQuantity?.value;
      const unit = obs.valueQuantity?.unit;
      const date = obs.effectiveDateTime || obs.issued;
      const status = obs.status;

      if (!code || !date) return;

      if (!labs[code]) {
        labs[code] = [];
      }

      labs[code].push({
        display,
        value,
        unit,
        date,
        status
      });
    });

    return labs;
  }

  // Extract medical conditions
  extractConditions() {
    const conditions = this.ehrData.fhir.Condition || [];
    return conditions.map(condition => ({
      code: condition.code?.coding?.[0]?.code,
      display: condition.code?.coding?.[0]?.display,
      status: condition.clinicalStatus?.coding?.[0]?.code,
      onsetDate: condition.onsetDateTime || condition.onsetPeriod?.start,
      severity: condition.severity?.coding?.[0]?.display,
      category: condition.category?.[0]?.coding?.[0]?.display
    })).filter(c => c.code && c.display);
  }

  // Extract medications
  extractMedications() {
    const medications = this.ehrData.fhir.Medication || [];
    return medications.map(med => ({
      name: med.code?.coding?.[0]?.display,
      code: med.code?.coding?.[0]?.code,
      form: med.form?.coding?.[0]?.display,
      strength: med.ingredient?.[0]?.strength?.numerator?.value,
      strengthUnit: med.ingredient?.[0]?.strength?.numerator?.unit
    })).filter(m => m.name);
  }

  // Extract allergies
  extractAllergies() {
    const allergies = this.ehrData.fhir.AllergyIntolerance || [];
    return allergies.map(allergy => ({
      substance: allergy.code?.coding?.[0]?.display,
      severity: allergy.reaction?.[0]?.severity,
      manifestation: allergy.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display,
      status: allergy.clinicalStatus?.coding?.[0]?.code
    })).filter(a => a.substance);
  }

  // Extract procedures
  extractProcedures() {
    const procedures = this.ehrData.fhir.Procedure || [];
    return procedures.map(proc => ({
      code: proc.code?.coding?.[0]?.code,
      display: proc.code?.coding?.[0]?.display,
      status: proc.status,
      date: proc.performedDateTime || proc.performedPeriod?.start,
      category: proc.category?.coding?.[0]?.display
    })).filter(p => p.display);
  }

  // Extract social history and lifestyle data
  extractSocialHistory() {
    const observations = this.ehrData.fhir.Observation || [];
    const socialHistory = {
      smoking: null,
      alcohol: null,
      exercise: null,
      diet: null,
      occupation: null
    };

    observations.forEach(obs => {
      const category = obs.category?.[0]?.coding?.[0]?.code;
      const code = obs.code?.coding?.[0]?.code;
      const value = obs.valueCodeableConcept?.coding?.[0]?.display || obs.valueQuantity?.value;
      const date = obs.effectiveDateTime || obs.issued;

      if (category === 'social-history') {
        switch (code) {
          case '72166-2': // Smoking status
            socialHistory.smoking = { status: value, date };
            break;
          case '88121-1': // Alcohol consumption
            socialHistory.alcohol = { status: value, date };
            break;
          case '89555-7': // Exercise frequency
            socialHistory.exercise = { frequency: value, date };
            break;
        }
      }
    });

    return socialHistory;
  }

  // Process all EHR data into a structured format
  processEHRData() {
    if (!this.ehrData) {
      console.error('❌ No EHR data loaded');
      return null;
    }

    console.log('🔄 Processing EHR data...');

    this.processedData = {
      demographics: this.extractPatientDemographics(),
      vitals: this.extractVitals(),
      labResults: this.extractLabResults(),
      conditions: this.extractConditions(),
      medications: this.extractMedications(),
      allergies: this.extractAllergies(),
      procedures: this.extractProcedures(),
      socialHistory: this.extractSocialHistory(),
      summary: this.generateSummary()
    };

    console.log('✅ EHR data processed successfully');
    return this.processedData;
  }

  // Generate a human-readable summary
  generateSummary() {
    const data = this.processedData;
    if (!data) return '';

    const summary = [];

    // Demographics
    if (data.demographics) {
      summary.push(`Patient: ${data.demographics.name} (${data.demographics.age} years old, ${data.demographics.gender})`);
    }

    // Active conditions
    const activeConditions = data.conditions?.filter(c => c.status === 'active') || [];
    if (activeConditions.length > 0) {
      summary.push(`Active Conditions: ${activeConditions.map(c => c.display).join(', ')}`);
    }

    // Recent vitals
    const recentVitals = [];
    Object.entries(data.vitals).forEach(([type, values]) => {
      if (values.length > 0) {
        const latest = values[values.length - 1];
        recentVitals.push(`${type}: ${latest.value} ${latest.unit}`);
      }
    });
    if (recentVitals.length > 0) {
      summary.push(`Recent Vitals: ${recentVitals.join(', ')}`);
    }

    // Medications
    if (data.medications?.length > 0) {
      summary.push(`Current Medications: ${data.medications.map(m => m.name).join(', ')}`);
    }

    // Allergies
    if (data.allergies?.length > 0) {
      summary.push(`Allergies: ${data.allergies.map(a => a.substance).join(', ')}`);
    }

    // Social history
    if (data.socialHistory) {
      const social = [];
      if (data.socialHistory.smoking) social.push(`Smoking: ${data.socialHistory.smoking.status}`);
      if (data.socialHistory.exercise) social.push(`Exercise: ${data.socialHistory.exercise.frequency}`);
      if (social.length > 0) {
        summary.push(`Lifestyle: ${social.join(', ')}`);
      }
    }

    return summary.join('\n');
  }

  // Format data for AI agent prompts
  formatForAgentPrompt(agentType) {
    if (!this.processedData) {
      console.error('❌ No processed EHR data available');
      return '';
    }

    const data = this.processedData;
    let relevantData = '';

    switch (agentType.toLowerCase()) {
      case 'nutri':
        relevantData = this.formatNutritionData(data);
        break;
      case 'luna':
        relevantData = this.formatSleepData(data);
        break;
      case 'rex':
        relevantData = this.formatFitnessData(data);
        break;
      case 'meni':
        relevantData = this.formatMindfulnessData(data);
        break;
      default:
        relevantData = this.formatGeneralData(data);
    }

    return relevantData;
  }

  // Format data specifically for nutrition agent
  formatNutritionData(data) {
    const nutrition = [];

    // Demographics
    if (data.demographics) {
      nutrition.push(`Patient: ${data.demographics.name}, ${data.demographics.age} years old, ${data.demographics.gender}`);
    }

    // Weight and BMI
    if (data.vitals.weight?.length > 0) {
      const latestWeight = data.vitals.weight[data.vitals.weight.length - 1];
      nutrition.push(`Current Weight: ${latestWeight.value} ${latestWeight.unit}`);
    }
    if (data.vitals.bmi?.length > 0) {
      const latestBMI = data.vitals.bmi[data.vitals.bmi.length - 1];
      nutrition.push(`Current BMI: ${latestBMI.value}`);
    }

    // Medical conditions affecting nutrition
    const nutritionConditions = data.conditions?.filter(c => 
      c.display?.toLowerCase().includes('diabetes') ||
      c.display?.toLowerCase().includes('hypertension') ||
      c.display?.toLowerCase().includes('cholesterol') ||
      c.display?.toLowerCase().includes('kidney') ||
      c.display?.toLowerCase().includes('heart') ||
      c.display?.toLowerCase().includes('celiac') ||
      c.display?.toLowerCase().includes('allergy')
    ) || [];
    if (nutritionConditions.length > 0) {
      nutrition.push(`Nutrition-Relevant Conditions: ${nutritionConditions.map(c => c.display).join(', ')}`);
    }

    // Allergies
    if (data.allergies?.length > 0) {
      nutrition.push(`Food Allergies: ${data.allergies.map(a => a.substance).join(', ')}`);
    }

    // Lab results relevant to nutrition
    const nutritionLabs = [];
    Object.entries(data.labResults).forEach(([code, results]) => {
      if (code.includes('4548-4') || // HbA1c
          code.includes('2093-3') || // Cholesterol
          code.includes('2571-8') || // Triglycerides
          code.includes('2085-9') || // HDL
          code.includes('13457-7') || // LDL
          code.includes('6299-2')) {  // B12
        const latest = results[results.length - 1];
        nutritionLabs.push(`${latest.display}: ${latest.value} ${latest.unit}`);
      }
    });
    if (nutritionLabs.length > 0) {
      nutrition.push(`Recent Lab Results: ${nutritionLabs.join(', ')}`);
    }

    // Medications affecting nutrition
    const nutritionMeds = data.medications?.filter(m => 
      m.name?.toLowerCase().includes('metformin') ||
      m.name?.toLowerCase().includes('insulin') ||
      m.name?.toLowerCase().includes('statin') ||
      m.name?.toLowerCase().includes('diuretic') ||
      m.name?.toLowerCase().includes('blood pressure')
    ) || [];
    if (nutritionMeds.length > 0) {
      nutrition.push(`Nutrition-Relevant Medications: ${nutritionMeds.map(m => m.name).join(', ')}`);
    }

    return nutrition.join('\n');
  }

  // Format data specifically for sleep agent
  formatSleepData(data) {
    const sleep = [];

    // Demographics
    if (data.demographics) {
      sleep.push(`Patient: ${data.demographics.name}, ${data.demographics.age} years old`);
    }

    // Medical conditions affecting sleep
    const sleepConditions = data.conditions?.filter(c => 
      c.display?.toLowerCase().includes('sleep') ||
      c.display?.toLowerCase().includes('apnea') ||
      c.display?.toLowerCase().includes('insomnia') ||
      c.display?.toLowerCase().includes('anxiety') ||
      c.display?.toLowerCase().includes('depression') ||
      c.display?.toLowerCase().includes('pain')
    ) || [];
    if (sleepConditions.length > 0) {
      sleep.push(`Sleep-Relevant Conditions: ${sleepConditions.map(c => c.display).join(', ')}`);
    }

    // Medications affecting sleep
    const sleepMeds = data.medications?.filter(m => 
      m.name?.toLowerCase().includes('sleep') ||
      m.name?.toLowerCase().includes('melatonin') ||
      m.name?.toLowerCase().includes('ambien') ||
      m.name?.toLowerCase().includes('lunesta') ||
      m.name?.toLowerCase().includes('antidepressant') ||
      m.name?.toLowerCase().includes('anxiety')
    ) || [];
    if (sleepMeds.length > 0) {
      sleep.push(`Sleep-Related Medications: ${sleepMeds.map(m => m.name).join(', ')}`);
    }

    // Social history
    if (data.socialHistory) {
      if (data.socialHistory.smoking) {
        sleep.push(`Smoking Status: ${data.socialHistory.smoking.status}`);
      }
      if (data.socialHistory.alcohol) {
        sleep.push(`Alcohol Consumption: ${data.socialHistory.alcohol.status}`);
      }
    }

    return sleep.join('\n');
  }

  // Format data specifically for fitness agent
  formatFitnessData(data) {
    const fitness = [];

    // Demographics
    if (data.demographics) {
      fitness.push(`Patient: ${data.demographics.name}, ${data.demographics.age} years old, ${data.demographics.gender}`);
    }

    // Current vitals
    if (data.vitals.heartRate?.length > 0) {
      const latestHR = data.vitals.heartRate[data.vitals.heartRate.length - 1];
      fitness.push(`Resting Heart Rate: ${latestHR.value} ${latestHR.unit}`);
    }
    if (data.vitals.bloodPressure?.length > 0) {
      const latestBP = data.vitals.bloodPressure[data.vitals.bloodPressure.length - 1];
      fitness.push(`Blood Pressure: ${latestBP.value} ${latestBP.unit}`);
    }

    // Medical conditions affecting exercise
    const fitnessConditions = data.conditions?.filter(c => 
      c.display?.toLowerCase().includes('heart') ||
      c.display?.toLowerCase().includes('lung') ||
      c.display?.toLowerCase().includes('diabetes') ||
      c.display?.toLowerCase().includes('arthritis') ||
      c.display?.toLowerCase().includes('back pain') ||
      c.display?.toLowerCase().includes('knee') ||
      c.display?.toLowerCase().includes('shoulder')
    ) || [];
    if (fitnessConditions.length > 0) {
      fitness.push(`Exercise-Relevant Conditions: ${fitnessConditions.map(c => c.display).join(', ')}`);
    }

    // Current exercise level
    if (data.socialHistory?.exercise) {
      fitness.push(`Current Exercise: ${data.socialHistory.exercise.frequency}`);
    }

    // Recent procedures
    const recentProcedures = data.procedures?.filter(p => 
      p.date && new Date(p.date) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
    ) || [];
    if (recentProcedures.length > 0) {
      fitness.push(`Recent Procedures: ${recentProcedures.map(p => p.display).join(', ')}`);
    }

    return fitness.join('\n');
  }

  // Format data specifically for mindfulness agent
  formatMindfulnessData(data) {
    const mindfulness = [];

    // Demographics
    if (data.demographics) {
      mindfulness.push(`Patient: ${data.demographics.name}, ${data.demographics.age} years old`);
    }

    // Mental health conditions
    const mentalHealthConditions = data.conditions?.filter(c => 
      c.display?.toLowerCase().includes('anxiety') ||
      c.display?.toLowerCase().includes('depression') ||
      c.display?.toLowerCase().includes('stress') ||
      c.display?.toLowerCase().includes('ptsd') ||
      c.display?.toLowerCase().includes('bipolar') ||
      c.display?.toLowerCase().includes('mood')
    ) || [];
    if (mentalHealthConditions.length > 0) {
      mindfulness.push(`Mental Health Conditions: ${mentalHealthConditions.map(c => c.display).join(', ')}`);
    }

    // Mental health medications
    const mentalHealthMeds = data.medications?.filter(m => 
      m.name?.toLowerCase().includes('antidepressant') ||
      m.name?.toLowerCase().includes('anxiety') ||
      m.name?.toLowerCase().includes('mood') ||
      m.name?.toLowerCase().includes('antipsychotic') ||
      m.name?.toLowerCase().includes('ssri') ||
      m.name?.toLowerCase().includes('snri')
    ) || [];
    if (mentalHealthMeds.length > 0) {
      mindfulness.push(`Mental Health Medications: ${mentalHealthMeds.map(m => m.name).join(', ')}`);
    }

    // Stress-related conditions
    const stressConditions = data.conditions?.filter(c => 
      c.display?.toLowerCase().includes('hypertension') ||
      c.display?.toLowerCase().includes('insomnia') ||
      c.display?.toLowerCase().includes('headache') ||
      c.display?.toLowerCase().includes('pain')
    ) || [];
    if (stressConditions.length > 0) {
      mindfulness.push(`Stress-Related Conditions: ${stressConditions.map(c => c.display).join(', ')}`);
    }

    // Social history
    if (data.socialHistory) {
      if (data.socialHistory.smoking) {
        mindfulness.push(`Smoking Status: ${data.socialHistory.smoking.status}`);
      }
      if (data.socialHistory.exercise) {
        mindfulness.push(`Exercise Level: ${data.socialHistory.exercise.frequency}`);
      }
    }

    return mindfulness.join('\n');
  }

  // Format general data for any agent
  formatGeneralData(data) {
    return data.summary || 'No patient data available';
  }

  // Get processed data
  getProcessedData() {
    return this.processedData;
  }

  // Export processed data to JSON
  exportProcessedData(filePath = './processed-ehr.json') {
    if (!this.processedData) {
      console.error('❌ No processed data to export');
      return false;
    }

    try {
      fs.writeFileSync(filePath, JSON.stringify(this.processedData, null, 2));
      console.log('✅ Processed EHR data exported to:', filePath);
      return true;
    } catch (error) {
      console.error('❌ Error exporting processed data:', error.message);
      return false;
    }
  }
}

module.exports = EHRProcessor; 