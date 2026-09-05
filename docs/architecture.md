# RecoverAI System Architecture & Technical Specifications

**Track 03 – AI Revenue Recovery**

## 1. High-Level Architecture

```text
Synthetic Dataset (1,250 txns) ──► 70/15/15 Train/Val/Test Split ──► GradientBoosting ML Model
                                                                           │
                                                                           ▼ (Risk Score 0-100, Recovery Prob 0-1.0)
Merchant Transaction Ingestion ──► Data Validation ──► Revenue-at-Risk Engine ──► AI Diagnosis Engine
                                                                                   │
                                                                                   ▼
                                                                         Recovery Decision Agent
                                                                                   │
                                                                                   ▼
                                                                      Policy & Guardrail Layer
                                                                           ├── IF BLOCKED ──► Trigger Escalation & Log
                                                                           └── IF APPROVED ──► Test Payment Gateway
                                                                                                    │
                                                                                                    ▼
                                                                                           Execution Result
                                                                                                    │
                                                                                                    ▼
                                                                                           Revenue Recovered
                                                                                                    │
                                                                                                    ▼
                                                                                            Audit Trail (Timestamped)
                                                                                                    │
                                                                                                    ▼
                                                                             React Executive Dashboard & Copilot
```

---

## 2. Core Modules & Responsibilities

### A. Machine Learning Pipeline (`/ml`)
- **Dataset Generation (`ml/dataset_generator.py`)**: 1,250 synthetic records across payment methods (UPI, Cards, Net Banking), failure causes, and customer tiers.
- **Model Trainer & Evaluator (`ml/model_trainer.py`)**: Evaluates on an untouched 15% held-out test split, reporting true Precision, Recall, F1, ROC-AUC, confusion matrix, and feature importances.
- **Risk Engine (`ml/risk_engine.py`)**: Real-time inference calculating risk scores (0–100), recovery probabilities (0.0–1.0), and driving risk factors.

### B. Policy & Guardrail Engine (`/backend/policy_engine.py`)
Bounded autonomy enforcement:
1. **Success Guard**: Prohibits recovery actions on already settled transactions.
2. **Max Retry Rule**: Strictly halts payment retries when `retry_count >= 2`, redirecting to `CREATE_ESCALATION`.
3. **Fatal Error Guard**: Prevents automated retries for `fraud_blocked` or `account_closed`.
4. **Expired Card Rule**: Blocks automated retry and dispatches payment method update link.
5. **Customer Cooldown Rule**: Enforces 24-hour communication cooldown to prevent spam.
6. **High-Value Threshold**: Escalate transactions exceeding ₹40,000 for manual supervisor authorization.

### C. Payment Execution Gateway (`/backend/payment_gateway.py`)
- Test-mode only architecture.
- Integrates Razorpay sandbox APIs alongside a high-fidelity Mock Test Gateway.
- Includes controlled failure simulation mode to prove graceful failure handling.

### D. Natural Language Merchant Copilot (`/backend/assistant.py`)
- Zero-hallucination query assistant translating merchant questions directly into SQL aggregations.

### E. Executive Dashboard (`/frontend`)
- React + Vite + Tailwind CSS + Recharts interface.
- 1-click batch recovery simulation, live activity streams, 4-pillar single-transaction deep dive, and real ML scorecard.
