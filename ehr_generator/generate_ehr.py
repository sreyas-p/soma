#!/usr/bin/env python3
"""
Synthetic EHR Data Generator

Generates realistic dummy Electronic Health Record (EHR) data for 
AI/RAG testing projects. Creates patient demographics and clinical 
encounters with semi-unstructured SOAP-style clinical notes.
"""

import os
import random
from datetime import datetime, timedelta
from typing import List, Tuple

import pandas as pd
from faker import Faker
from tqdm import tqdm

# Initialize Faker with seed for reproducibility
fake = Faker()
Faker.seed(42)
random.seed(42)

# ICD-10 codes with descriptions (common outpatient diagnoses)
ICD10_CODES = [
    ("J06.9", "Acute upper respiratory infection, unspecified"),
    ("J20.9", "Acute bronchitis, unspecified"),
    ("M54.5", "Low back pain"),
    ("I10", "Essential (primary) hypertension"),
    ("E11.9", "Type 2 diabetes mellitus without complications"),
    ("F32.9", "Major depressive disorder, single episode, unspecified"),
    ("F41.1", "Generalized anxiety disorder"),
    ("K21.0", "Gastro-esophageal reflux disease with esophagitis"),
    ("J45.909", "Unspecified asthma, uncomplicated"),
    ("M25.561", "Pain in right knee"),
    ("M25.562", "Pain in left knee"),
    ("R51.9", "Headache, unspecified"),
    ("N39.0", "Urinary tract infection, site not specified"),
    ("L30.9", "Dermatitis, unspecified"),
    ("R10.9", "Unspecified abdominal pain"),
    ("J02.9", "Acute pharyngitis, unspecified"),
    ("H10.9", "Unspecified conjunctivitis"),
    ("B34.9", "Viral infection, unspecified"),
    ("R05.9", "Cough, unspecified"),
    ("G43.909", "Migraine, unspecified, not intractable"),
]

# Symptoms mapped to diagnoses for realistic notes
SYMPTOMS_BY_DIAGNOSIS = {
    "J06.9": ["sore throat", "nasal congestion", "mild cough", "fatigue"],
    "J20.9": ["productive cough", "chest discomfort", "wheezing", "low-grade fever"],
    "M54.5": ["lower back pain", "stiffness", "pain radiating to buttocks", "difficulty bending"],
    "I10": ["occasional headaches", "no symptoms", "dizziness", "fatigue"],
    "E11.9": ["increased thirst", "frequent urination", "fatigue", "blurred vision"],
    "F32.9": ["low mood", "decreased energy", "poor sleep", "loss of interest"],
    "F41.1": ["excessive worry", "restlessness", "difficulty concentrating", "muscle tension"],
    "K21.0": ["heartburn", "acid reflux", "chest pain after eating", "regurgitation"],
    "J45.909": ["shortness of breath", "wheezing", "chest tightness", "cough at night"],
    "M25.561": ["right knee pain", "swelling", "stiffness", "difficulty walking"],
    "M25.562": ["left knee pain", "swelling", "stiffness", "difficulty with stairs"],
    "R51.9": ["headache", "sensitivity to light", "nausea", "neck stiffness"],
    "N39.0": ["burning urination", "frequent urination", "urgency", "lower abdominal pain"],
    "L30.9": ["skin rash", "itching", "redness", "dry patches"],
    "R10.9": ["abdominal pain", "bloating", "nausea", "changes in bowel habits"],
    "J02.9": ["sore throat", "difficulty swallowing", "fever", "swollen lymph nodes"],
    "H10.9": ["red eyes", "eye discharge", "itching", "tearing"],
    "B34.9": ["fever", "body aches", "fatigue", "chills"],
    "R05.9": ["persistent cough", "throat irritation", "chest discomfort", "post-nasal drip"],
    "G43.909": ["throbbing headache", "nausea", "light sensitivity", "visual disturbances"],
}

# Treatment plans by diagnosis
TREATMENTS_BY_DIAGNOSIS = {
    "J06.9": ["supportive care with rest and fluids", "OTC decongestants as needed", "return if symptoms worsen"],
    "J20.9": ["albuterol inhaler PRN", "increased fluid intake", "follow up in 1 week if not improving"],
    "M54.5": ["NSAIDs for pain management", "physical therapy referral", "activity modification"],
    "I10": ["continue current antihypertensive", "low sodium diet", "follow up in 3 months"],
    "E11.9": ["continue metformin 500mg BID", "diabetic diet counseling", "HbA1c recheck in 3 months"],
    "F32.9": ["start sertraline 50mg daily", "cognitive behavioral therapy referral", "follow up in 2 weeks"],
    "F41.1": ["continue current SSRI", "relaxation techniques", "therapy follow up"],
    "K21.0": ["omeprazole 20mg daily", "dietary modifications", "elevate head of bed"],
    "J45.909": ["albuterol rescue inhaler", "avoid triggers", "asthma action plan reviewed"],
    "M25.561": ["ice and elevation", "physical therapy evaluation", "consider MRI if not improving"],
    "M25.562": ["NSAIDs for 7 days", "knee brace as needed", "follow up in 2 weeks"],
    "R51.9": ["OTC analgesics", "hydration", "headache diary recommended"],
    "N39.0": ["ciprofloxacin 500mg BID x 3 days", "increase fluid intake", "follow up if symptoms persist"],
    "L30.9": ["topical hydrocortisone 1%", "moisturizer application", "avoid irritants"],
    "R10.9": ["trial of PPI", "bland diet", "return if severe pain develops"],
    "J02.9": ["penicillin VK 500mg TID x 10 days", "salt water gargles", "rest"],
    "H10.9": ["artificial tears QID", "warm compresses", "avoid contact lenses"],
    "B34.9": ["rest and hydration", "acetaminophen for fever", "return if symptoms worsen"],
    "R05.9": ["dextromethorphan as needed", "honey for cough", "humidifier use"],
    "G43.909": ["sumatriptan 50mg PRN", "identify triggers", "migraine prevention counseling"],
}


def generate_vital_signs() -> str:
    """
    Generate realistic vital signs string.
    
    Returns:
        str: Formatted vital signs string (BP, HR, Temp, RR, SpO2)
    """
    bp_systolic = random.randint(110, 150)
    bp_diastolic = random.randint(65, 95)
    heart_rate = random.randint(60, 100)
    temp = round(random.uniform(97.0, 99.5), 1)
    resp_rate = random.randint(12, 20)
    spo2 = random.randint(95, 100)
    
    return f"BP {bp_systolic}/{bp_diastolic}, HR {heart_rate}, Temp {temp}°F, RR {resp_rate}, SpO2 {spo2}%"


def generate_clinical_note(diagnosis_code: str, patient_name: str) -> str:
    """
    Generate a semi-unstructured SOAP-style clinical note.
    
    Args:
        diagnosis_code: ICD-10 diagnosis code
        patient_name: Patient's name for personalization
        
    Returns:
        str: 3-sentence clinical note mimicking doctor's documentation
    """
    first_name = patient_name.split()[0]
    
    # Get symptoms and treatments for this diagnosis
    symptoms = SYMPTOMS_BY_DIAGNOSIS.get(diagnosis_code, ["general discomfort", "fatigue"])
    treatments = TREATMENTS_BY_DIAGNOSIS.get(diagnosis_code, ["supportive care", "follow up as needed"])
    
    # Select random symptoms (1-2)
    selected_symptoms = random.sample(symptoms, min(2, len(symptoms)))
    symptom_text = " and ".join(selected_symptoms)
    
    # Duration
    duration = random.choice(["2 days", "3 days", "1 week", "several days", "a few days", "about a week"])
    
    # Generate vitals
    vitals = generate_vital_signs()
    
    # Select treatment
    treatment = random.choice(treatments)
    
    # Build the note
    subjective = f"{first_name} presents with {symptom_text} for {duration}."
    objective = f"Vitals: {vitals}. Physical exam {"unremarkable" if random.random() > 0.3 else "notable for mild tenderness"}."
    plan = f"Plan: {treatment}."
    
    return f"{subjective} {objective} {plan}"


def generate_patients(num_patients: int = 100) -> pd.DataFrame:
    """
    Generate synthetic patient demographics data.
    
    Args:
        num_patients: Number of patients to generate (default 100)
        
    Returns:
        pd.DataFrame: DataFrame with patient demographics
    """
    patients = []
    
    for i in tqdm(range(num_patients), desc="Generating patients"):
        patient_id = f"P{str(i + 1).zfill(5)}"
        gender = random.choice(["M", "F"])
        
        if gender == "M":
            name = fake.name_male()
        else:
            name = fake.name_female()
        
        # Generate DOB (ages 18-85)
        age = random.randint(18, 85)
        dob = fake.date_of_birth(minimum_age=age, maximum_age=age)
        
        # Santa Barbara, CA addresses
        street = fake.street_address()
        address = f"{street}, Santa Barbara, CA {fake.zipcode_in_state('CA')}"
        
        phone = fake.phone_number()
        
        patients.append({
            "patient_id": patient_id,
            "name": name,
            "dob": dob.strftime("%Y-%m-%d"),
            "gender": gender,
            "address": address,
            "phone": phone
        })
    
    return pd.DataFrame(patients)


def generate_encounters(df_patients: pd.DataFrame, avg_encounters_per_patient: int = 3) -> pd.DataFrame:
    """
    Generate synthetic clinical encounter data linked to patients.
    
    Args:
        df_patients: DataFrame containing patient data
        avg_encounters_per_patient: Average number of encounters per patient
        
    Returns:
        pd.DataFrame: DataFrame with clinical encounters
    """
    encounters = []
    encounter_counter = 1
    
    for _, patient in tqdm(df_patients.iterrows(), total=len(df_patients), desc="Generating encounters"):
        # Random number of encounters (1 to avg*2)
        num_encounters = random.randint(1, avg_encounters_per_patient * 2)
        
        for _ in range(num_encounters):
            encounter_id = f"E{str(encounter_counter).zfill(6)}"
            encounter_counter += 1
            
            # Random date in past 2 years
            days_ago = random.randint(1, 730)
            encounter_date = datetime.now() - timedelta(days=days_ago)
            
            # Random diagnosis
            diagnosis_code, diagnosis_desc = random.choice(ICD10_CODES)
            
            # Generate clinical note
            clinical_note = generate_clinical_note(diagnosis_code, patient["name"])
            
            encounters.append({
                "encounter_id": encounter_id,
                "patient_id": patient["patient_id"],
                "date": encounter_date.strftime("%Y-%m-%d"),
                "diagnosis_code": diagnosis_code,
                "diagnosis_description": diagnosis_desc,
                "clinical_note": clinical_note
            })
    
    return pd.DataFrame(encounters)


def save_data(df_patients: pd.DataFrame, df_encounters: pd.DataFrame, output_dir: str = "data") -> Tuple[str, str]:
    """
    Save generated data to CSV files.
    
    Args:
        df_patients: Patient demographics DataFrame
        df_encounters: Clinical encounters DataFrame
        output_dir: Output directory path
        
    Returns:
        Tuple[str, str]: Paths to saved files
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    patients_path = os.path.join(output_dir, "patients.csv")
    encounters_path = os.path.join(output_dir, "encounters.csv")
    
    df_patients.to_csv(patients_path, index=False)
    df_encounters.to_csv(encounters_path, index=False)
    
    return patients_path, encounters_path


def main() -> None:
    """
    Main function to orchestrate EHR data generation.
    """
    print("=" * 60)
    print("🏥 Synthetic EHR Data Generator")
    print("=" * 60)
    
    # Configuration
    NUM_PATIENTS = 100
    AVG_ENCOUNTERS = 3
    
    print(f"\nGenerating data for {NUM_PATIENTS} patients...")
    print(f"Average encounters per patient: {AVG_ENCOUNTERS}\n")
    
    # Generate patients
    df_patients = generate_patients(NUM_PATIENTS)
    print(f"✅ Generated {len(df_patients)} patients")
    
    # Generate encounters
    df_encounters = generate_encounters(df_patients, AVG_ENCOUNTERS)
    print(f"✅ Generated {len(df_encounters)} encounters")
    
    # Save to CSV
    patients_path, encounters_path = save_data(df_patients, df_encounters)
    
    print(f"\n📁 Data saved to:")
    print(f"   - {patients_path}")
    print(f"   - {encounters_path}")
    
    # Print sample data
    print("\n" + "=" * 60)
    print("📋 Sample Patient Record:")
    print("=" * 60)
    print(df_patients.iloc[0].to_string())
    
    print("\n" + "=" * 60)
    print("📋 Sample Encounter Record:")
    print("=" * 60)
    sample_encounter = df_encounters.iloc[0]
    print(f"Encounter ID: {sample_encounter['encounter_id']}")
    print(f"Patient ID: {sample_encounter['patient_id']}")
    print(f"Date: {sample_encounter['date']}")
    print(f"Diagnosis: {sample_encounter['diagnosis_code']} - {sample_encounter['diagnosis_description']}")
    print(f"\nClinical Note:\n{sample_encounter['clinical_note']}")
    
    print("\n" + "=" * 60)
    print("✅ EHR data generation complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
