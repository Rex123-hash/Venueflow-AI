# VenueFlow AI 🏟️
> **AI-Powered Crowd Management Platform for Indian Sporting Venues**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Cloud%20Run-blue?style=for-the-badge&logo=google-cloud)](https://venue-flow-ai-559905175681.asia-south1.run.app)
[![Vertex AI](https://img.shields.io/badge/Powered%20by-Vertex%20AI%20Gemini%202.0-orange?style=for-the-badge&logo=google)](https://cloud.google.com/vertex-ai)
[![TypeScript](https://img.shields.io/badge/TypeScript-Full%20Stack-3178C6?style=for-the-badge&logo=typescript)](https://typescriptlang.org)
[![Google OAuth](https://img.shields.io/badge/Auth-Google%20OAuth%202.0-red?style=for-the-badge&logo=google)](https://developers.google.com/identity)

---

## 🌐 Live Demo

**Production URL:** https://venue-flow-ai-559905175681.asia-south1.run.app

**Demo Credentials (no Google account needed):**
| Role | Email | Password |
|------|-------|----------|
| Manager | `manager@venueflow.ai` | `Manager@123` |
| Fan | `fan1@venueflow.ai` | `Fan@12345` |
| Staff | `staff1@venueflow.ai` | `Staff@123` |

Or simply click **"Continue with Google"** to sign in with your Google account.

---

## 🎯 Challenge Vertical: Smart Venue Assistant

VenueFlow AI is built around the **Smart Assistant** vertical — an intelligent, real-time platform that acts as a digital co-pilot for both fans attending a live sporting event and venue operations managers coordinating 42,000+ people simultaneously.

---

## 🧠 What It Does

VenueFlow AI solves a real problem faced at every major Indian sporting event: **chaos**. Long gate queues, no food court information, zero real-time guidance, and dangerous emergency response times.

The platform has three AI personas powered by **Google Cloud Vertex AI**:

| Agent | Role | Model |
|---|---|---|
| **FlowBot** | Fan-facing chatbot — navigates fans to seats, food courts, and exits in real-time | `gemini-2.0-flash-001` (Streaming SSE) |
| **FlowAgent** | Manager AI analyst — predicts crowd hotspots 15 min early with live zone data | `gemini-2.0-flash-001` (JSON predictions) |
| **Emergency AI** | Auto-generates calm, contextual PA announcements during evacuations | `gemini-2.0-flash-001` |

---

## 🏗️ Architecture & Approach

```
┌──────────────────────────────────────────────────────────────┐
│                     Google Cloud Run                          │
│                                                              │
│   ┌──────────────────┐    ┌──────────────────────────────┐  │
│   │  React 18 SPA    │───▶│   Node.js + Express Backend  │  │
│   │  (Vite + TS)     │    │      (serves static SPA)     │  │
│   └──────────────────┘    └──────────────┬───────────────┘  │
│                                          │                   │
│                         ┌────────────────▼──────────────┐   │
│                         │    Simulation Engine           │   │
│                         │   (Real-time Digital Twin)     │   │
│                         └────────────────┬──────────────┘   │
└──────────────────────────────────────────┼───────────────────┘
                                           │
             ┌─────────────────────────────┼──────────────────┐
             │                             │                  │
      ┌──────▼──────┐             ┌────────▼──────┐  ┌───────▼──────┐
      │ Vertex AI   │             │  PostgreSQL   │  │  Redis Cache │
      │ Gemini 2.0  │             │  (Prisma ORM) │  │  (fallback)  │
      └─────────────┘             └───────────────┘  └──────────────┘
```

### Key Design Decisions

1. **Real-time Simulation Engine**: A pure TypeScript class (`SimulationEngine.ts`) runs a physics-based crowd simulation. This "digital twin" of the venue replicates what real IoT sensor feeds would provide in production.

2. **Vertex AI with ADC**: All AI calls use Application Default Credentials (ADC) — no API keys embedded in code. On Cloud Run, the service account identity is used automatically.

3. **Live Zone-Aware Predictions**: FlowAgent receives the actual live zone occupancy numbers before calling Vertex AI, so every prediction is grounded in what's actually happening right now — not generic advice.

4. **Streaming AI Responses**: FlowBot uses Server-Sent Events (SSE) to stream Gemini tokens directly to the browser.

5. **Mock-first Resilience**: Every route has a graceful fallback to mock data if Prisma/Redis are unavailable — the app always works.

---

## 🚀 How It Works

### For Fans:
1. **Login** with Google OAuth 2.0 (one click) — your real Google photo and name appear in the UI
2. **FlowBot** greets you with seat, gate queue times, and food recommendations
3. **Live ticker** shows real-time crowd density updates
4. During emergencies, a **full-screen overlay** shows evacuation path with AI-generated PA announcements

### For Managers:
1. **Operations Command Center** — live heatmap of all venue zones
2. **FlowAgent AI Predictions** — auto-refreshed every 60 seconds from Vertex AI, based on real zone data
3. Skeleton loaders while AI runs, fallback predictions if Vertex AI is unreachable
4. **Phase controls** — simulate PRE_MATCH → GATES_OPEN → MATCH_LIVE → HALFTIME → CLEARING
5. **Export Report** — download a full `.txt` operations report with zone status + AI predictions, attributed to the logged-in Google user
6. **God Mode** — trigger emergency evacuation protocol instantly

---

## 🛠️ Tech Stack

### Frontend
- **React 18** + TypeScript + Vite
- **Tailwind CSS** — custom design system with glassmorphism
- **Framer Motion** — micro-animations and transitions
- **Recharts** — analytics charts (area, bar, pie)
- **Socket.io Client** — real-time simulation updates
- **Zustand** — global state management (auth + simulation)

### Backend
- **Node.js** + Express.js + TypeScript
- **Prisma ORM** + PostgreSQL (with mock data fallback)
- **Redis** — live simulation state caching (optional)
- **Socket.io** — bidirectional real-time communication
- **Passport.js** — Google OAuth 2.0 strategy
- **JWT** — stateless authentication
- **Helmet + CORS** — security hardening

### Google Cloud Services ☁️
| Service | Usage |
|---------|-------|
| **Vertex AI** (`@google-cloud/vertexai`) | Powers FlowBot, FlowAgent, Emergency AI via `gemini-2.0-flash-001` with ADC |
| **Google OAuth 2.0** (`passport-google-oauth20`) | One-click "Continue with Google" sign-in |
| **Cloud Run** | Containerized, auto-scaling serverless deployment |
| **Cloud Build** | CI/CD via `gcloud run deploy --source` |
| **Artifact Registry** | Docker image storage |

---

## 📋 Setup & Running Locally

### Prerequisites
- Node.js 20+
- Google Cloud SDK (`gcloud`) installed and authenticated
- PostgreSQL (optional — app runs fully with mock data)

### 1. Clone & Install

```bash
git clone https://github.com/Rex123-hash/Venueflow-AI.git
cd Venueflow-AI/venueflow-ai

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
cd backend
cp .env.example .env
# Edit .env with your values (see below)
```

### 3. Authenticate with Google Cloud (for Vertex AI)

```bash
gcloud auth application-default login
gcloud config set project venue-flow-ai-493017
```

### 4. Run

```bash
# Terminal 1 — Backend
cd backend && npm run dev     # → http://localhost:3001

# Terminal 2 — Frontend
cd frontend && npm run dev    # → http://localhost:5173
```

---

## ⚙️ Environment Variables

### Backend (`.env`)

```env
# Server
PORT=3001
NODE_ENV=development

# JWT
JWT_SECRET=your-secure-secret-min-32-chars
JWT_EXPIRES_IN=7d

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3001

# Google Cloud Vertex AI (uses Application Default Credentials)
GOOGLE_CLOUD_PROJECT_ID=venue-flow-ai-493017
GOOGLE_CLOUD_LOCATION=us-central1

# Optional — app works with mock data without these
# DATABASE_URL=postgresql://user:pass@localhost:5432/venueflow
# REDIS_URL=redis://localhost:6379
```

### Google Cloud Console Setup

1. Create OAuth 2.0 credentials at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. **Authorized JavaScript origins**: `http://localhost:5173`
3. **Authorized redirect URIs**: `http://localhost:3001/api/auth/google/callback`

For production, also add:
- Origin: `https://venue-flow-ai-559905175681.asia-south1.run.app`
- Redirect: `https://venue-flow-ai-559905175681.asia-south1.run.app/api/auth/google/callback`

---

## 🚢 Deployment (Google Cloud Run)

```bash
# 1. Build frontend
cd frontend && npm run build

# 2. Deploy from project root (uses Dockerfile)
cd ..
gcloud run deploy venue-flow-ai \
  --source . \
  --region asia-south1 \
  --project venue-flow-ai-493017 \
  --allow-unauthenticated

# 3. Set production environment variables
gcloud run services update venue-flow-ai \
  --region asia-south1 \
  --set-env-vars "GOOGLE_CLIENT_ID=...,GOOGLE_CLIENT_SECRET=...,JWT_SECRET=...,FRONTEND_URL=https://your-url.run.app,BACKEND_URL=https://your-url.run.app,GOOGLE_CLOUD_PROJECT_ID=venue-flow-ai-493017,GOOGLE_CLOUD_LOCATION=us-central1"
```

---

## 🧪 Testing

```bash
cd backend
npm test    # Runs Jest test suite
```

Tests cover:
- Auth middleware (JWT validation)
- AI route response format validation
- Simulation Engine phase transitions
- Emergency announcement generation

---

## 📁 Project Structure

```
venueflow-ai/
├── frontend/                    # React SPA
│   └── src/
│       ├── components/          # Navbar, ZoneMap, ChatBot, AlertBanner…
│       ├── pages/               # Landing, Login, ManagerDashboard, FanDashboard…
│       ├── stores/              # Zustand (authStore, simulationStore, eventStore)
│       └── lib/                 # api.ts, socket.ts, runtime.ts
│
├── backend/                     # Express TypeScript API
│   └── src/
│       ├── routes/              # auth, ai, events, zones, simulation, emergency…
│       ├── services/            # gemini.ts (Vertex AI), SimulationEngine, AlertBot
│       ├── middleware/          # JWT auth, role guards
│       ├── lib/                 # Prisma client, Redis client
│       └── config/              # Mock data, venue map SVG config
│   └── prisma/
│       └── schema.prisma        # Multi-venue, multi-event DB schema
│
├── Dockerfile                   # Single-container build (backend serves frontend)
├── .gcloudignore                # Excludes node_modules from Cloud Build upload
└── README.md
```

---

## 🔐 Security

- All protected API endpoints use JWT Bearer token validation
- Role-based access control (`FAN`, `STAFF`, `MANAGER`, `ADMIN`) on every route
- Google OAuth enforces `prompt: 'select_account'` for explicit account choice
- CORS restricted to allow-list origins in production
- Helmet.js sets hardened HTTP headers
- No secrets in frontend code — all via environment variables and ADC
- `.env` excluded from git via `.gitignore`

---

## 💡 Assumptions Made

1. **Simulation over real sensors**: The crowd engine replicates IoT sensor data using a physics-based random walk model. In production, this would consume data from gate scanner APIs and seat occupancy sensors.
2. **Single venue demo**: Seeded with IPL 2025 — MI vs CSK at DY Patil Stadium. The schema supports multiple venues and events.
3. **Mock-first fallback**: All routes handle DB/Redis unavailability gracefully — the demo never crashes.
4. **ADC on Cloud Run**: Vertex AI authentication uses the Cloud Run service account identity automatically — no API keys needed.

---

*Built for Prompt Wars Hackathon 2025 · Powered by Google Cloud Vertex AI, OAuth 2.0 & Cloud Run*
