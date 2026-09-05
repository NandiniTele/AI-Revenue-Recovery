# 🤖 AI Revenue Recovery — RecoverAI

> An AI-powered revenue recovery platform that analyzes failed transactions, applies smart retry policies, and helps businesses recover lost revenue using intelligent agents and real-time dashboards.

---

## 🔗 Links

| | URL |
|---|---|
| 🌐 **Live Demo (Frontend)** | [https://ai-revenue-recovery-rust-seven.vercel.app](https://ai-revenue-recovery-rust-seven.vercel.app) |
| 📦 **GitHub Repository** | [https://github.com/NandiniTele/AI-Revenue-Recovery](https://github.com/NandiniTele/AI-Revenue-Recovery) |

---

## ✨ Features

- 📊 **Dashboard** — Real-time revenue recovery metrics and KPI cards
- 💳 **Transactions** — View, filter, and analyze 1,250+ demo transactions
- 🤖 **AI Agent Studio** — Autonomous agents with configurable retry strategies
- 🛡️ **Policy Settings** — Customizable approval/block rules and risk thresholds
- 🔍 **Audit Trail** — Full audit log of every AI decision and action
- 💬 **Merchant Copilot** — Gemini-powered AI assistant grounded in live data
- 📈 **ML Risk Engine** — Predictive risk scoring for every transaction

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **Backend** | FastAPI (Python), SQLAlchemy, SQLite |
| **AI / ML** | Google Gemini API, scikit-learn Risk Engine |
| **Payments** | Razorpay (test mode) |
| **Frontend Hosting** | Vercel |
| **Backend Hosting** | Render |

---

## 🚀 Quick Start (Local)

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Clone the repository
```bash
git clone https://github.com/NandiniTele/AI-Revenue-Recovery.git
cd AI-Revenue-Recovery
```

### 2. Set up environment variables
```bash
cp .env.example .env
# Edit .env and add your API keys (optional)
```

### 3. Run the backend
```bash
pip install -r requirements.txt
python -m backend.seed_db        # Seed 1,250 demo transactions
uvicorn backend.main:app --reload --port 8000
```

### 4. Run the frontend
```bash
cd frontend
npm install
npm run dev
```

### 5. Open the app
```
http://localhost:5173
```

---

## 📁 Project Structure

```
AI-Revenue-Recovery/
├── backend/               # FastAPI backend
│   ├── main.py            # App entry point, CORS, routing
│   ├── models.py          # SQLAlchemy models (Transaction, AuditLog, etc.)
│   ├── database.py        # DB session & initialization
│   ├── seed_db.py         # Demo data seeder (1,250 transactions)
│   ├── agent.py           # AI recovery agent logic
│   ├── assistant.py       # Merchant Copilot (Gemini)
│   └── routers/           # API route handlers
├── frontend/              # React + Vite frontend
│   └── src/
│       ├── pages/         # Dashboard, Transactions, Audit Trail, etc.
│       └── types.ts       # TypeScript interfaces
├── ml/                    # Machine learning risk engine
│   └── risk_engine.py
├── data/                  # SQLite database (auto-created)
├── tests/                 # Pytest test suite
├── render.yaml            # Render backend deployment config
├── vercel.json            # Vercel frontend deployment config
├── requirements.txt       # Python dependencies
└── .env.example           # Environment variable template
```

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/dashboard` | Dashboard KPIs |
| GET | `/api/transactions` | List transactions (paginated) |
| GET | `/api/audit` | Audit trail (paginated, filtered) |
| POST | `/api/agent/run` | Trigger AI recovery agent |
| POST | `/api/demo/reset` | Reset demo data (1,250 txs) |
| POST | `/api/copilot/chat` | Merchant Copilot chat |

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | No | SQLite path (default: `sqlite:///data/recoverai.db`) |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for Merchant Copilot |
| `RAZORPAY_KEY_ID` | Optional | Razorpay test key ID |
| `RAZORPAY_KEY_SECRET` | Optional | Razorpay test key secret |

---

## 📄 License

MIT License — feel free to use and modify for your own projects.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/NandiniTele">NandiniTele</a>
</p>