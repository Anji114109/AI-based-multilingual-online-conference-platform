# 🌐 LinguaMeet — AI-Based Multilingual Online Conference Platform

> **Real-time multilingual video conferencing with live AI-powered transcription, translation, and meeting summarization.**

LinguaMeet is a full-stack web application that enables participants from different linguistic backgrounds to communicate seamlessly during online meetings. It provides **live speech-to-text transcription**, **real-time multilingual translation**, **AI-powered meeting summaries**, and **downloadable PDF transcripts** — all in one platform.

---

## ✨ Features

- 🎙️ **Live Speech Transcription** — Real-time ASR (Automatic Speech Recognition) using Zipformer ONNX models via a Python FastAPI service
- 🌍 **Real-time Translation** — Automatic translation of spoken content into the participant's preferred language using Google Gemini AI
- 📹 **Video Conferencing** — Integrated HD video calling powered by Stream Video SDK
- 🔐 **Google OAuth Login** — Secure sign-in with Google via Firebase Authentication
- 👑 **Host Controls** — Hosts can approve/deny join requests, manage meetings
- 📝 **Meeting History** — View all past meetings with full transcripts (as Host or Member)
- 🤖 **AI Summary Generation** — Post-meeting AI summaries using Google Gemini
- 📄 **PDF Export** — Download full meeting transcripts as formatted PDF files
- 💬 **Live Subtitles** — Real-time subtitle overlay during calls
- 🗄️ **Persistent Storage** — All meeting data stored in MongoDB Atlas

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────────┐
│   Frontend      │────▶│   Backend        │────▶│  Transcription Service │
│  React + Vite   │     │  Node.js/Express │     │  Python FastAPI + ASR  │
│  (Port: 5173)   │◀────│  (Port: 5000)    │◀────│  (Port: 8000)          │
└─────────────────┘     └──────────────────┘     └────────────────────────┘
        │                       │                          │
        │                       ▼                          ▼
        │               ┌──────────────┐        ┌─────────────────┐
        │               │ MongoDB Atlas│        │  Zipformer ONNX │
        │               │  (Database)  │        │  ASR Models     │
        │               └──────────────┘        └─────────────────┘
        │
        ▼
┌─────────────────────┐
│  Stream Video SDK   │  (Video Calling)
│  Firebase Auth      │  (Google Login)
│  Google Gemini AI   │  (Summaries & Translation)
└─────────────────────┘
```

---

## 📁 Project Structure

```
ai-multilingual-conference-summarizer/
├── frontend/                        # React + Vite frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx             # Main dashboard (login, create/join meeting)
│   │   │   ├── CallPage.jsx         # Live meeting room with subtitles & video
│   │   │   └── SummaryPage.jsx      # Post-meeting AI summary page
│   │   ├── components/              # Reusable UI components
│   │   ├── context/Firebase.jsx     # Firebase Auth context
│   │   ├── hooks/useLiveTranscription.js  # WebSocket transcription hook
│   │   └── services/                # API & socket services
│   └── .env.example                 # Frontend environment template
│
├── backend/                         # Node.js + Express backend
│   ├── src/
│   │   ├── server.js                # Entry point, Socket.IO setup
│   │   ├── app.js                   # Express app, routes, middleware
│   │   ├── routes/                  # API route definitions
│   │   ├── controllers/             # Route handler logic
│   │   ├── sockets/                 # Socket.IO & Python client
│   │   ├── services/                # Meeting persistence logic
│   │   ├── db/                      # MongoDB connection & indexes
│   │   └── middleware/auth.js       # JWT verification
│   └── .env.example                 # Backend environment template
│
└── transcription-service/           # Python FastAPI ASR service
    ├── app.py                       # FastAPI app with WebSocket endpoint
    ├── model.py                     # Zipformer streaming ASR wrapper
    ├── translate.py                 # Google Gemini translation
    ├── pdf_font.py                  # PDF font registration
    ├── models/zipformer/            # ASR model files (download separately)
    └── requirements.txt             # Python dependencies
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+
- **Python** 3.10+
- **MongoDB Atlas** account
- **Google Firebase** project (for Auth)
- **Stream Video SDK** account
- **Google Gemini API** key

---

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/Anji114109/AI-based-multilingual-online-conference-platform.git
cd AI-based-multilingual-online-conference-platform
```

---

### 2️⃣ Download ASR Model Files

> ⚠️ The ONNX model files are too large for GitHub (260MB). Download them separately.

Download the **Zipformer streaming ONNX models** from [k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx/releases) and place them in:

```
transcription-service/models/zipformer/
├── encoder-epoch-99-avg-1-chunk-16-left-128.onnx
├── encoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx
├── decoder-epoch-99-avg-1-chunk-16-left-128.onnx
├── decoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx
├── joiner-epoch-99-avg-1-chunk-16-left-128.onnx
├── joiner-epoch-99-avg-1-chunk-16-left-128.int8.onnx
├── bpe.model
└── tokens.txt
```

---

### 3️⃣ Transcription Service Setup (Python)

```bash
cd transcription-service

# Create virtual environment
python -m venv venv

# Activate (Windows CMD)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and fill environment variables
copy .env .env.local
```

**`.env` file:**
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

**Run:**
```bash
# With venv activated:
uvicorn app:app --reload --host 0.0.0.0 --port 8000

# OR directly (no activation needed):
venv\Scripts\python.exe -m uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

---

### 4️⃣ Backend Setup (Node.js)

```bash
cd backend

# Install dependencies
npm install

# Create your .env from the example
copy .env.example .env
```

**Fill in `backend/.env`:**
```env
PORT=5000
NODE_ENV=development

GEMINI_API_KEY=your_gemini_api_key
WHISPER_SERVICE_URL=http://127.0.0.1:8000

STEAM_API_KEY=your_stream_api_key
STEAM_API_SECRET=your_stream_api_secret

JWT_SECRET_KEY=your_jwt_secret

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FIREBASE_WEB_API_KEY=your_firebase_web_api_key

MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/?appName=Cluster
MONGODB_DB_NAME=tech-meet
```

**Run:**
```bash
npm run dev       # Development (auto-restart with nodemon)
npm start         # Production
```

---

### 5️⃣ Frontend Setup (React + Vite)

```bash
cd frontend

# Install dependencies
npm install

# Create your .env from the example
copy .env.example .env
```

**Fill in `frontend/.env`:**
```env
VITE_BACKEND_URL=http://localhost:5000
VITE_TRANSCRIPTION_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_STREAM_API_KEY=your_stream_api_key
```

**Run:**
```bash
npm run dev       # Starts at http://localhost:5173
```

---

## 🖥️ Running All Services

Open **3 separate terminals**:

| Terminal | Command | Port |
|----------|---------|------|
| Transcription | `venv\Scripts\python.exe -m uvicorn app:app --reload` | `8000` |
| Backend | `npm run dev` | `5000` |
| Frontend | `npm run dev` | `5173` |

Then open → **http://localhost:5173**

---

## 🔧 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + Vite | UI framework & build tool |
| React Router v6 | Client-side routing |
| Socket.IO Client | Real-time communication |
| Stream Video React SDK | Video calling |
| Firebase Auth | Google OAuth login |
| Three.js / React Three Fiber | 3D landing page animations |
| Motion (Framer Motion) | UI animations |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | REST API server |
| Socket.IO | Real-time WebSocket events |
| MongoDB + MongoDB Driver | Database |
| Google Gemini AI | Summarization & translation |
| Stream Server SDK | Video call token management |
| JWT | Authentication tokens |
| Multer + FFmpeg | Audio file handling |
| PDFKit | PDF generation |

### Transcription Service
| Technology | Purpose |
|---|---|
| Python + FastAPI | ASR microservice |
| Uvicorn | ASGI server |
| Zipformer ONNX | Streaming speech recognition |
| sherpa-onnx | ONNX runtime for ASR |
| Google Gemini AI | Post-meeting transcript correction |
| ReportLab | PDF transcript generation |

---

## 📡 API Endpoints

### Backend (Port 5000)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/google` | Google OAuth sign-in |
| `GET` | `/api/history/meetings` | Get user's meeting history |
| `GET` | `/api/history/meetings/:id` | Get meeting details |
| `POST` | `/api/gemini/summarize` | Generate AI meeting summary |
| `GET` | `/api/pdf/:meetingId` | Download meeting PDF |

### Transcription Service (Port 8000)
| Method | Endpoint | Description |
|---|---|---|
| `WS` | `/ws` | WebSocket for live audio streaming |
| `GET` | `/transcript/:meetingId` | Get meeting transcript |
| `GET` | `/pdf/:meetingId` | Download transcript as PDF |
| `POST` | `/modify-transcript/:meetingId` | AI-correct transcript with Gemini |

---

## 🔐 Environment Variables Summary

| Variable | Service | Description |
|---|---|---|
| `GEMINI_API_KEY` | Backend & Transcription | Google Gemini AI key |
| `MONGODB_URI` | Backend | MongoDB Atlas connection string |
| `STEAM_API_KEY` | Backend | Stream Video API key |
| `FIREBASE_WEB_API_KEY` | Backend | Firebase project API key |
| `JWT_SECRET_KEY` | Backend | Secret for signing JWT tokens |
| `VITE_BACKEND_URL` | Frontend | Backend server URL |
| `VITE_STREAM_API_KEY` | Frontend | Stream Video public key |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

**Venkatareddy Ambati**
- GitHub: [@Anji114109](https://github.com/Anji114109)

---

> Built with ❤️ for breaking language barriers in online collaboration.
