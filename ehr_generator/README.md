# Synthetic EHR Data Generator

Generate realistic dummy Electronic Health Record (EHR) data for AI/RAG testing projects.

## Features

- **100 synthetic patients** with realistic demographics (Santa Barbara, CA locale)
- **Clinical encounters** linked to patients with ICD-10 diagnosis codes
- **SOAP-style clinical notes** for RAG system testing
- Reproducible output (seeded random generation)

## Installation

```bash
cd ehr_generator
pip install -r requirements.txt
```

## Usage

```bash
python generate_ehr.py
```

## Output

The script generates two CSV files in the `data/` directory:

### `patients.csv`
| Column | Description |
|--------|-------------|
| patient_id | Unique patient identifier (P00001, P00002, ...) |
| name | Full name |
| dob | Date of birth (YYYY-MM-DD) |
| gender | M or F |
| address | Street address in Santa Barbara, CA |
| phone | Phone number |

### `encounters.csv`
| Column | Description |
|--------|-------------|
| encounter_id | Unique encounter identifier (E000001, E000002, ...) |
| patient_id | Foreign key to patients |
| date | Encounter date (YYYY-MM-DD) |
| diagnosis_code | ICD-10 diagnosis code |
| diagnosis_description | Human-readable diagnosis |
| clinical_note | Semi-unstructured SOAP-style note |

## Sample Clinical Note

```
John presents with sore throat and nasal congestion for 3 days. 
Vitals: BP 125/82, HR 78, Temp 98.6°F, RR 16, SpO2 98%. Physical exam unremarkable. 
Plan: supportive care with rest and fluids.
```

## Use Cases

- Testing RAG (Retrieval-Augmented Generation) systems
- Training/fine-tuning healthcare NLP models
- Prototyping clinical data pipelines
- Demo data for healthcare applications

## License

MIT - Free for educational and commercial use.
