# Soma

**Your AI-powered health copilot.** Soma unifies your health data from Apple HealthKit, wearables, and personal inputs into one hub—then turns it into personalized, actionable daily guidance.

![React Native](https://img.shields.io/badge/React_Native-0.81-blue?logo=react)
![Expo](https://img.shields.io/badge/Expo-54-black?logo=expo)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Backend-green?logo=supabase)

## Features

### 🤖 AI Health Agents
Five specialized AI agents provide personalized guidance:

| Agent | Role |
|-------|------|
| **Soma** | Primary health copilot - coordinates all aspects of your wellness |
| **Nutri** | Nutrition advisor with real-time UCSB dining hall menus |
| **Luna** | Sleep optimization and bedtime routine coach |
| **Rex** | Fitness and exercise recommendations |
| **Meni** | Medication tracking and health monitoring |

### 📊 Health Integration
- **Apple HealthKit** sync for steps, sleep, heart rate, workouts
- Real-time health data visualization
- Historical trend analysis
- Goal tracking with progress indicators

### 🍽️ Campus Dining (UCSB)
- Live menu data from Carrillo, De La Guerra, Ortega, Portola
- AI-powered meal recommendations based on your health goals
- Allergy and dietary restriction filtering
- Nutritional information for all items

### ✅ Smart Daily Checklists
- Auto-generated tasks based on your health data and goals
- Categories: nutrition, exercise, sleep, medication, monitoring
- Progress tracking and streaks

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile | React Native + Expo |
| Language | TypeScript |
| Backend | Vercel Serverless + Supabase |
| AI | OpenAI GPT-4 via OpenRouter |
| Health Data | Apple HealthKit |

## Quick Start

### Prerequisites
- Node.js 18+
- iOS device or simulator (HealthKit requires iOS)
- Xcode 15+ (for iOS builds)

### Setup

```bash
# Clone and install
git clone https://github.com/sreyas-p/soma.git
cd soma
npm install

# Set environment variables
cp env-example.txt .env
# Edit .env with your API keys

# Run on iOS
npm run ios
```

### Environment Variables

```bash
OPENAI_API_KEY=your_openai_key
OPENROUTER_API_KEY=your_openrouter_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Project Structure

```
soma/
├── api/                    # Vercel serverless functions
│   ├── chat.js            # AI agent chat endpoint
│   ├── generate-checklist.js
│   └── user-context.js    # User data formatting
├── src/
│   ├── components/        # React Native components
│   ├── screens/           # App screens
│   ├── services/          # HealthKit, dining, etc.
│   ├── contexts/          # Auth context
│   └── theme/             # Design system
├── ios/                   # Native iOS project
└── *.sql                  # Database schemas
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Chat with AI agents |
| `/api/generate-checklist` | POST | Generate daily tasks |
| `/api/user-context` | GET | Fetch user health context |
| `/api/health` | GET | Health check |

## Deployment

### Vercel (API)
```bash
vercel --prod
```

### iOS (TestFlight)
```bash
eas build --platform ios
eas submit --platform ios
```

## License

MIT

---

Built at SB Hacks XI 🏖️
