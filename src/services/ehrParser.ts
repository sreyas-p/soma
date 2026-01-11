/**
 * EHR Parser Service for React Native
 * Parses detailed EHR JSON data and extracts relevant health information
 */

import { HistoricalHealthData, RecentHealthData, ChronicDisease } from '@/types/onboarding';

// Types for parsed EHR data
export interface ParsedEHRData {
  demographics: {
    firstName: string;
    lastName: string;
    middleName?: string;
    preferredName?: string;
    dateOfBirth: string;
    gender: 'male' | 'female' | 'other';
    age: number;
    phone?: string;
    email?: string;
    address?: string;
    patientId?: string;
    emergencyContact?: {
      name: string;
      relationship: string;
      phone: string;
    };
  };
  historicalData: HistoricalHealthData;
  recentData: RecentHealthData;
  encounters?: EncounterRecord[];
  labResults?: LabResult[];
  immunizations?: Immunization[];
  careTeam?: CareTeamMember[];
}

export interface EncounterRecord {
  encounterId: string;
  date: string;
  type: string;
  provider?: string;
  facility?: string;
  chiefComplaint?: string;
  diagnoses: { diagnosis: string; icd10: string; status: string }[];
  clinicalNote?: string;
}

export interface LabResult {
  date: string;
  panel: string;
  results: { test: string; value: number | string; unit: string; flag: string }[];
}

export interface Immunization {
  vaccine: string;
  date: string;
  notes?: string;
}

export interface CareTeamMember {
  name: string;
  role: string;
  specialty: string;
  phone?: string;
}

/**
 * Parse the detailed EHR JSON format
 */
export function parseDetailedEHR(data: any): ParsedEHRData | null {
  try {
    if (!data.patient || !data.patient.demographics) {
      console.warn('Invalid EHR format: missing patient demographics');
      return null;
    }

    const patient = data.patient;
    const demographics = patient.demographics;
    const medHistory = data.medical_history || {};
    const allergies = data.allergies || [];
    const medications = data.medications || {};
    const immunizations = data.immunizations || [];
    const vitals = data.vital_signs_history || [];
    const labResults = data.lab_results || [];
    const encounters = data.encounters || [];
    const careTeam = data.care_team || [];

    // Parse demographics
    const parsedDemographics = {
      firstName: demographics.name?.first || '',
      lastName: demographics.name?.last || '',
      middleName: demographics.name?.middle,
      preferredName: demographics.name?.preferred,
      dateOfBirth: demographics.date_of_birth || '',
      gender: parseGender(demographics.gender),
      age: demographics.age || calculateAge(demographics.date_of_birth),
      phone: demographics.phone?.mobile || demographics.phone?.home,
      email: demographics.email,
      address: formatAddress(demographics.address),
      patientId: patient.patient_id,
      emergencyContact: demographics.emergency_contact ? {
        name: demographics.emergency_contact.name,
        relationship: demographics.emergency_contact.relationship,
        phone: demographics.emergency_contact.phone,
      } : undefined,
    };

    // Parse HISTORICAL data (conditions, surgeries, family history, allergies)
    const historicalData: HistoricalHealthData = {
      geneticConditions: extractGeneticConditions(medHistory.family_history),
      chronicDiseases: parseChronicDiseases(medHistory.past_medical_history),
      familyHistory: parseFamilyHistory(medHistory.family_history),
      allergies: parseAllergies(allergies),
      pastSurgeries: parseSurgeries(medHistory.surgical_history),
      bloodType: undefined, // Not in this format
    };

    // Parse RECENT data (current vitals, measurements, medications, lifestyle)
    const latestVitals = vitals[0]; // Most recent vitals
    const recentData: RecentHealthData = {
      measurements: {
        height: latestVitals?.height_cm ? {
          value: latestVitals.height_cm,
          unit: 'cm',
          recordedAt: latestVitals.date,
        } : undefined,
        weight: latestVitals?.weight_kg ? {
          value: latestVitals.weight_kg,
          unit: 'kg',
          recordedAt: latestVitals.date,
        } : undefined,
        bmi: latestVitals?.bmi ? {
          value: latestVitals.bmi,
          recordedAt: latestVitals.date,
        } : undefined,
      },
      vitals: {
        bloodPressure: latestVitals?.blood_pressure ? {
          systolic: parseInt(latestVitals.blood_pressure.split('/')[0]),
          diastolic: parseInt(latestVitals.blood_pressure.split('/')[1]),
          recordedAt: latestVitals.date,
        } : undefined,
        heartRate: latestVitals?.heart_rate ? {
          value: latestVitals.heart_rate,
          unit: 'bpm',
          recordedAt: latestVitals.date,
        } : undefined,
        temperature: latestVitals?.temperature ? {
          value: latestVitals.temperature,
          unit: latestVitals.temperature_unit === 'F' ? '°F' : '°C',
          recordedAt: latestVitals.date,
        } : undefined,
        oxygenSaturation: latestVitals?.oxygen_saturation ? {
          value: latestVitals.oxygen_saturation,
          unit: '%',
          recordedAt: latestVitals.date,
        } : undefined,
      },
      currentMedications: parseCurrentMedications(medications.current),
      lifestyle: parseLifestyle(medHistory.social_history),
    };

    // Parse encounters
    const parsedEncounters: EncounterRecord[] = encounters.map((e: any) => ({
      encounterId: e.encounter_id,
      date: e.date,
      type: e.type,
      provider: e.provider?.name,
      facility: e.facility?.name,
      chiefComplaint: e.chief_complaint,
      diagnoses: (e.assessment || []).map((a: any) => ({
        diagnosis: a.diagnosis,
        icd10: a.icd10,
        status: a.status,
      })),
      clinicalNote: e.clinical_note,
    }));

    // Parse lab results
    const parsedLabResults: LabResult[] = labResults.map((l: any) => ({
      date: l.result_date || l.collection_date,
      panel: l.panel,
      results: l.results || [],
    }));

    // Parse immunizations
    const parsedImmunizations: Immunization[] = immunizations.map((i: any) => ({
      vaccine: i.vaccine,
      date: i.date,
      notes: i.notes,
    }));

    // Parse care team
    const parsedCareTeam: CareTeamMember[] = careTeam.map((c: any) => ({
      name: c.name,
      role: c.role,
      specialty: c.specialty,
      phone: c.phone,
    }));

    return {
      demographics: parsedDemographics,
      historicalData,
      recentData,
      encounters: parsedEncounters,
      labResults: parsedLabResults,
      immunizations: parsedImmunizations,
      careTeam: parsedCareTeam,
    };
  } catch (error) {
    console.error('Error parsing detailed EHR:', error);
    return null;
  }
}

/**
 * Parse gender string to standard format
 */
function parseGender(gender: string): 'male' | 'female' | 'other' {
  const g = (gender || '').toLowerCase();
  if (g === 'male' || g === 'm') return 'male';
  if (g === 'female' || g === 'f') return 'female';
  return 'other';
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth: string): number {
  if (!dateOfBirth) return 0;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Format address object to string
 */
function formatAddress(address: any): string {
  if (!address) return '';
  const parts = [
    address.street,
    address.apt,
    address.city,
    address.state,
    address.zip,
  ].filter(Boolean);
  return parts.join(', ');
}

/**
 * Extract genetic conditions from family history
 */
function extractGeneticConditions(familyHistory: any[]): any[] {
  if (!familyHistory) return [];
  
  // Look for hereditary/genetic patterns in family history
  const geneticConditions: any[] = [];
  const hereditaryConditions = new Set<string>();
  
  familyHistory.forEach((member: any) => {
    (member.conditions || []).forEach((condition: string) => {
      // Track conditions that appear in multiple family members
      if (hereditaryConditions.has(condition)) {
        geneticConditions.push({
          name: condition,
          inheritedFrom: member.relative,
          notes: member.notes,
        });
      }
      hereditaryConditions.add(condition);
    });
  });
  
  return geneticConditions;
}

/**
 * Parse chronic diseases from past medical history
 */
function parseChronicDiseases(pastMedicalHistory: any[]): ChronicDisease[] {
  if (!pastMedicalHistory) return [];
  
  return pastMedicalHistory.map((condition: any) => ({
    name: condition.condition,
    diagnosedDate: condition.onset_date,
    status: condition.status?.toLowerCase() === 'active' ? 'active' : 
            condition.status?.toLowerCase() === 'resolved' ? 'resolved' : 'managed',
    category: mapConditionToCategory(condition.icd10, condition.condition),
    severity: 'moderate', // Default, could be enhanced
    icd10Code: condition.icd10,
    notes: condition.notes,
  }));
}

/**
 * Map ICD-10 code to condition category
 */
function mapConditionToCategory(icd10: string, conditionName: string): string {
  if (!icd10) return 'other';
  
  const prefix = icd10.charAt(0);
  const nameLower = (conditionName || '').toLowerCase();
  
  // ICD-10 chapter mapping
  if (prefix === 'F') return 'mental_health';
  if (prefix === 'I') return 'cardiovascular';
  if (prefix === 'J') return 'respiratory';
  if (prefix === 'K') return 'gastrointestinal';
  if (prefix === 'E') return 'endocrine';
  if (prefix === 'G') return 'neurological';
  if (prefix === 'M') return 'musculoskeletal';
  if (prefix === 'N') return 'kidney';
  if (prefix === 'L') return 'skin';
  if (prefix === 'S' || prefix === 'T') return 'other'; // Injuries
  
  // Fallback to name-based detection
  if (nameLower.includes('anxiety') || nameLower.includes('depression')) return 'mental_health';
  if (nameLower.includes('diabetes')) return 'endocrine';
  if (nameLower.includes('hypertension') || nameLower.includes('heart')) return 'cardiovascular';
  if (nameLower.includes('asthma') || nameLower.includes('respiratory')) return 'respiratory';
  
  return 'other';
}

/**
 * Parse family history
 */
function parseFamilyHistory(familyHistory: any[]): any[] {
  if (!familyHistory) return [];
  
  return familyHistory.map((member: any) => ({
    relationship: member.relative,
    conditions: member.conditions || [],
    ageAtDiagnosis: member.age,
    isDeceased: !!member.age_at_death,
    causeOfDeath: member.cause_of_death,
    notes: member.notes,
  }));
}

/**
 * Parse allergies
 */
function parseAllergies(allergies: any[]): any[] {
  if (!allergies) return [];
  
  return allergies.map((allergy: any) => ({
    allergen: allergy.allergen,
    type: allergy.type?.toLowerCase() || 'unknown',
    reaction: allergy.reaction,
    severity: allergy.severity?.toLowerCase() || 'unknown',
    onsetDate: allergy.onset_date,
    verified: allergy.verified,
    notes: allergy.notes,
  }));
}

/**
 * Parse surgical history
 */
function parseSurgeries(surgicalHistory: any[]): any[] {
  if (!surgicalHistory) return [];
  
  return surgicalHistory.map((surgery: any) => ({
    procedure: surgery.procedure,
    date: surgery.date,
    surgeon: surgery.surgeon,
    facility: surgery.facility,
    notes: surgery.notes,
    complications: surgery.complications,
  }));
}

/**
 * Parse current medications
 */
function parseCurrentMedications(currentMeds: any[]): any[] {
  if (!currentMeds) return [];
  
  return currentMeds.map((med: any) => ({
    name: med.name,
    dose: med.dose,
    route: med.route,
    frequency: med.frequency,
    indication: med.indication,
    prescriber: med.prescriber,
    startDate: med.start_date,
    pharmacy: med.pharmacy,
    refillsRemaining: med.refills_remaining,
    notes: med.notes,
  }));
}

/**
 * Parse lifestyle/social history
 */
function parseLifestyle(socialHistory: any): any {
  if (!socialHistory) return {};
  
  return {
    smoking: socialHistory.tobacco?.status || 'unknown',
    alcohol: socialHistory.alcohol?.frequency || 'unknown',
    exercise: {
      frequency: socialHistory.exercise?.frequency,
      type: socialHistory.exercise?.type,
      duration: socialHistory.exercise?.duration,
    },
    diet: socialHistory.diet?.type,
    sleep: {
      hours: socialHistory.sleep?.average_hours,
      quality: socialHistory.sleep?.quality,
    },
    caffeine: socialHistory.caffeine?.amount,
    occupation: socialHistory.occupation,
    livingSubstance: socialHistory.living_situation,
  };
}

/**
 * Convert parsed EHR data to onboarding form data format
 */
export function ehrToOnboardingData(parsed: ParsedEHRData) {
  return {
    basicInfo: {
      firstName: parsed.demographics.firstName,
      lastName: parsed.demographics.lastName,
      dateOfBirth: parsed.demographics.dateOfBirth,
      biologicalSex: parsed.demographics.gender,
    },
    physicalMeasurements: {
      height: parsed.recentData.measurements.height?.value || 0,
      heightUnit: (parsed.recentData.measurements.height?.unit === 'cm' ? 'cm' : 'inches') as 'inches' | 'cm',
      weight: parsed.recentData.measurements.weight?.value || 0,
      weightUnit: (parsed.recentData.measurements.weight?.unit === 'kg' ? 'kg' : 'lbs') as 'lbs' | 'kg',
      bloodType: 'unknown' as const,
    },
    medicalConditions: parsed.historicalData.chronicDiseases.map(d => ({
      name: d.name,
      diagnosedYear: d.diagnosedDate ? new Date(d.diagnosedDate).getFullYear().toString() : '',
      currentlyManaged: d.status === 'active' || d.status === 'managed',
    })),
    medications: parsed.recentData.currentMedications.map((m: any) => ({
      name: m.name,
      dosage: m.dose,
      frequency: m.frequency,
      purpose: m.indication,
    })),
    allergies: parsed.historicalData.allergies.map((a: any) => ({
      allergen: a.allergen,
      reaction: a.reaction,
      severity: a.severity === 'severe' ? 'severe' : a.severity === 'moderate' ? 'moderate' : 'mild',
    })),
    surgeries: parsed.historicalData.pastSurgeries.map((s: any) => ({
      procedure: s.procedure,
      year: s.date ? new Date(s.date).getFullYear().toString() : '',
      notes: s.notes,
    })),
    familyHistory: parsed.historicalData.familyHistory.map((f: any) => ({
      relationship: f.relationship,
      conditions: f.conditions,
      notes: f.notes,
    })),
    lifestyle: {
      smokingStatus: mapSmokingStatus(parsed.recentData.lifestyle?.smoking),
      alcoholConsumption: mapAlcoholConsumption(parsed.recentData.lifestyle?.alcohol),
      exerciseFrequency: mapExerciseFrequency(parsed.recentData.lifestyle?.exercise?.frequency),
      sleepHours: parseSleepHours(parsed.recentData.lifestyle?.sleep?.hours),
      stressLevel: 'moderate' as const,
      dietType: parsed.recentData.lifestyle?.diet || 'standard',
    },
  };
}

function mapSmokingStatus(status: string): 'never' | 'former' | 'current' | 'occasional' {
  const s = (status || '').toLowerCase();
  if (s.includes('never')) return 'never';
  if (s.includes('former') || s.includes('quit')) return 'former';
  if (s.includes('current') || s.includes('daily')) return 'current';
  if (s.includes('occasional') || s.includes('social')) return 'occasional';
  return 'never';
}

function mapAlcoholConsumption(freq: string): 'none' | 'occasional' | 'moderate' | 'heavy' {
  const f = (freq || '').toLowerCase();
  if (f.includes('none') || f.includes('never') || f.includes('denies')) return 'none';
  if (f.includes('social') || f.includes('occasional') || f.includes('1-2')) return 'occasional';
  if (f.includes('moderate') || f.includes('3-4') || f.includes('weekly')) return 'moderate';
  if (f.includes('heavy') || f.includes('daily')) return 'heavy';
  return 'occasional';
}

function mapExerciseFrequency(freq: string): 'none' | 'light' | 'moderate' | 'active' | 'very_active' {
  const f = (freq || '').toLowerCase();
  if (f.includes('none') || f.includes('sedentary')) return 'none';
  if (f.includes('1-2') || f.includes('light')) return 'light';
  if (f.includes('3-4') || f.includes('moderate')) return 'moderate';
  if (f.includes('5') || f.includes('active')) return 'active';
  if (f.includes('daily') || f.includes('6') || f.includes('7')) return 'very_active';
  return 'moderate';
}

function parseSleepHours(hours: string): number {
  if (!hours) return 7;
  const match = hours.match(/(\d+)/);
  return match ? parseInt(match[1]) : 7;
}

/**
 * Main entry point - parse EHR data from JSON
 */
export function parseEHRData(ehrData: any): ParsedEHRData | null {
  try {
    // If it's a string, try to parse it
    if (typeof ehrData === 'string') {
      try {
        ehrData = JSON.parse(ehrData);
      } catch {
        console.warn('Unable to parse EHR data as JSON');
        return null;
      }
    }

    // Check for our detailed EHR format
    if (ehrData.patient && ehrData.patient.demographics) {
      return parseDetailedEHR(ehrData);
    }

    console.warn('Unknown EHR format');
    return null;
  } catch (error) {
    console.error('Error parsing EHR data:', error);
    return null;
  }
}

// Export for backward compatibility
export { parseDetailedEHR as parseCSVEHRData };
export function getPatientListFromCSV(_csv: string): any[] { return []; }
