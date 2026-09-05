"""
RecoverAI - Synthetic Dataset Generator
Generates realistic merchant transaction records for revenue recovery AI modeling.
Includes diverse failure reasons, customer payment histories, subscription states, and checkout abandonment.
"""

import os
import random
import datetime
import numpy as np
import pandas as pd

# Set deterministic seed for reproducibility
RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

FIRST_NAMES = ["Aarav", "Aditi", "Rohan", "Pooja", "Vikram", "Sneha", "Karan", "Ananya", "Rahul", "Priya",
               "Siddharth", "Neha", "Arjun", "Divya", "Amit", "Kavita", "Suresh", "Meera", "Varun", "Tanvi",
               "Rajesh", "Shweta", "Deepak", "Ritu", "Alok", "Nisha", "Gaurav", "Simran", "Manish", "Preeti"]
LAST_NAMES = ["Sharma", "Verma", "Patel", "Gupta", "Mehta", "Singh", "Reddy", "Nair", "Iyer", "Chopra",
              "Kapoor", "Bhatia", "Joshi", "Deshmukh", "Agarwal", "Bansal", "Choudhury", "Malhotra", "Saxena", "Roy"]

PAYMENT_METHODS = ["UPI", "Credit Card", "Debit Card", "Net Banking", "Wallet"]
PAYMENT_METHOD_WEIGHTS = [0.45, 0.25, 0.15, 0.10, 0.05]

FAILURE_REASONS = [
    # Transient / Recoverable
    "network_timeout",
    "insufficient_funds",
    "issuer_down",
    "webhook_drop",
    "authentication_failed",
    "processor_error",
    # Permanent / Fatal / Non-recoverable without card update
    "card_expired",
    "account_closed",
    "fraud_blocked",
    "velocity_limit_exceeded"
]

TRANSIENT_FAILURES = {
    "network_timeout": 0.90,       # High probability of recovery on retry
    "issuer_down": 0.85,           # High recovery once issuer is back up
    "webhook_drop": 0.92,          # High recovery on status sync / retry
    "processor_error": 0.80,       # Good recovery probability
    "authentication_failed": 0.65, # Moderate recovery with payment link/reminder
    "insufficient_funds": 0.45,    # Moderate recovery after reminder / salary cycle
}

PERMANENT_FAILURES = {
    "card_expired": 0.12,          # Requires customer to update card details
    "account_closed": 0.02,        # Almost impossible to recover directly
    "fraud_blocked": 0.00,         # Blocked by security policy
    "velocity_limit_exceeded": 0.30# Requires cooldown or alternative payment
}

CUSTOMER_TIERS = ["VIP", "Enterprise", "Standard", "New"]
TIER_WEIGHTS = [0.15, 0.10, 0.50, 0.25]


def generate_dataset(num_records: int = 1250) -> pd.DataFrame:
    """Generates synthetic dataset of merchant transactions."""
    records = []
    base_date = datetime.datetime.now() - datetime.timedelta(days=30)
    
    # Pre-generate 300 unique customer profiles
    customers = []
    for c_id in range(101, 450):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        tier = random.choices(CUSTOMER_TIERS, weights=TIER_WEIGHTS)[0]
        
        if tier == "VIP":
            prev_success = random.randint(10, 45)
            prev_failure = random.randint(0, 2)
            ltv = round(random.uniform(50000, 250000), 2)
        elif tier == "Enterprise":
            prev_success = random.randint(15, 60)
            prev_failure = random.randint(0, 3)
            ltv = round(random.uniform(100000, 500000), 2)
        elif tier == "Standard":
            prev_success = random.randint(2, 15)
            prev_failure = random.randint(0, 4)
            ltv = round(random.uniform(5000, 45000), 2)
        else: # New
            prev_success = random.randint(0, 2)
            prev_failure = random.randint(0, 2)
            ltv = round(random.uniform(500, 5000), 2)
            
        customers.append({
            "customer_id": f"CUST{c_id:04d}",
            "customer_name": f"{first} {last}",
            "customer_email": f"{first.lower()}.{last.lower()}{random.randint(10,99)}@example.com",
            "customer_tier": tier,
            "previous_success_count": prev_success,
            "previous_failure_count": prev_failure,
            "customer_value": ltv
        })

    for i in range(1, num_records + 1):
        tx_id = f"TX{1000 + i}"
        customer = random.choice(customers)
        payment_method = random.choices(PAYMENT_METHODS, weights=PAYMENT_METHOD_WEIGHTS)[0]
        
        # Transaction timestamp spread across last 30 days
        days_offset = random.uniform(0, 30)
        tx_timestamp = base_date + datetime.timedelta(days=days_offset)
        hour = tx_timestamp.hour
        
        # Transaction Amount based on customer tier & category
        if customer["customer_tier"] in ["VIP", "Enterprise"]:
            amount = round(random.choice([2499, 4999, 8999, 14999, 24999, 39999, 49999]) + random.uniform(0, 0.99), 2)
        else:
            amount = round(random.choice([499, 999, 1499, 2499, 3499, 4999, 7999]) + random.uniform(0, 0.99), 2)

        # Decide transaction scenario
        # 60% Failed payments, 15% Abandoned checkouts, 15% Subscription failures, 10% Successful payments
        scenario_roll = random.random()
        
        if scenario_roll < 0.60:
            # Failed Payment Workflow
            payment_status = "FAILED"
            checkout_status = "COMPLETED"
            subscription_status = "NONE"
            days_overdue = random.randint(0, 7)
            retry_count = random.choices([0, 1, 2, 3], weights=[0.55, 0.25, 0.15, 0.05])[0]
            
            # Select failure reason
            is_transient = random.random() < 0.72
            if is_transient:
                failure_reason = random.choice(list(TRANSIENT_FAILURES.keys()))
                base_prob = TRANSIENT_FAILURES[failure_reason]
            else:
                failure_reason = random.choice(list(PERMANENT_FAILURES.keys()))
                base_prob = PERMANENT_FAILURES[failure_reason]

        elif scenario_roll < 0.75:
            # Checkout Abandonment
            payment_status = "ABANDONED"
            checkout_status = random.choice(["ABANDONED_CART", "PAYMENT_PAGE_DROPOFF", "OTP_DROPOFF"])
            subscription_status = "NONE"
            days_overdue = 0
            retry_count = 0
            failure_reason = "checkout_dropoff"
            base_prob = 0.58

        elif scenario_roll < 0.90:
            # Recurring Subscription Failure
            payment_status = "FAILED"
            checkout_status = "COMPLETED"
            subscription_status = random.choice(["ACTIVE_RENEWAL_DUE", "PAST_DUE", "CHURN_RISK"])
            days_overdue = random.randint(1, 14)
            retry_count = random.choices([0, 1, 2], weights=[0.6, 0.3, 0.1])[0]
            failure_reason = random.choice(["insufficient_funds", "card_expired", "issuer_down", "processor_error"])
            base_prob = TRANSIENT_FAILURES.get(failure_reason, PERMANENT_FAILURES.get(failure_reason, 0.5))

        else:
            # Natural Successful payment (baseline)
            payment_status = "SUCCESS"
            checkout_status = "COMPLETED"
            subscription_status = random.choice(["NONE", "ACTIVE_RENEWAL_DUE"])
            days_overdue = 0
            retry_count = 0
            failure_reason = "none"
            base_prob = 1.0

        # Adjust recovery probability with customer behavioral signals
        success_ratio = customer["previous_success_count"] / max(1, customer["previous_success_count"] + customer["previous_failure_count"])
        
        # Modifier factors
        prob = base_prob
        prob += 0.15 * (success_ratio - 0.5)
        if customer["customer_tier"] in ["VIP", "Enterprise"]:
            prob += 0.08
        if retry_count > 1:
            prob -= 0.18 * retry_count
        if days_overdue > 5:
            prob -= 0.02 * days_overdue
        if payment_method == "UPI":
            prob += 0.05 # UPI has faster user re-auth

        # Clip probability to [0.01, 0.99]
        prob = float(np.clip(prob, 0.01, 0.99))
        
        # Calculate Risk Score (0-100). Higher means higher risk / higher revenue jeopardy
        if payment_status == "SUCCESS":
            risk_score = random.randint(5, 20)
            recovery_eligible = "NO"
            optimal_action = "NO_ACTION"
            actual_recoverable = 0
        else:
            # Risk is higher for high value, multiple retries, or high failure rate
            raw_risk = (1.0 - prob) * 60 + (min(amount, 25000) / 25000) * 30 + (retry_count * 5)
            risk_score = int(np.clip(raw_risk + random.uniform(-5, 5), 10, 99))
            
            # Recovery eligibility
            if failure_reason in ["fraud_blocked", "account_closed"] or retry_count >= 2:
                recovery_eligible = "NO"
            else:
                recovery_eligible = "YES" if prob >= 0.35 else "NO"

            # Determine ground truth recoverable outcome
            actual_recoverable = 1 if (random.random() < prob and recovery_eligible == "YES") else 0

            # Determine optimal bounded action
            if payment_status == "ABANDONED":
                optimal_action = "SEND_CHECKOUT_REMINDER"
            elif subscription_status in ["ACTIVE_RENEWAL_DUE", "PAST_DUE", "CHURN_RISK"]:
                if retry_count >= 2:
                    optimal_action = "CREATE_ESCALATION"
                elif failure_reason == "card_expired":
                    optimal_action = "SEND_PAYMENT_REMINDER"
                else:
                    optimal_action = "RETRY_SUBSCRIPTION"
            elif retry_count >= 2:
                optimal_action = "CREATE_ESCALATION"
            elif failure_reason in ["network_timeout", "issuer_down", "webhook_drop", "processor_error"]:
                optimal_action = "RETRY_PAYMENT"
            elif failure_reason in ["insufficient_funds", "authentication_failed"]:
                optimal_action = "SEND_PAYMENT_REMINDER"
            elif failure_reason == "card_expired":
                optimal_action = "SEND_PAYMENT_REMINDER"
            else:
                optimal_action = "STOP_RECOVERY"

        records.append({
            "transaction_id": tx_id,
            "customer_id": customer["customer_id"],
            "customer_name": customer["customer_name"],
            "customer_email": customer["customer_email"],
            "customer_tier": customer["customer_tier"],
            "amount": amount,
            "currency": "INR",
            "payment_status": payment_status,
            "failure_reason": failure_reason,
            "payment_method": payment_method,
            "previous_success_count": customer["previous_success_count"],
            "previous_failure_count": customer["previous_failure_count"],
            "checkout_status": checkout_status,
            "subscription_status": subscription_status,
            "days_overdue": days_overdue,
            "retry_count": retry_count,
            "customer_value": customer["customer_value"],
            "transaction_timestamp": tx_timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "risk_score": risk_score,
            "recovery_probability": round(prob, 4),
            "recovery_eligible": recovery_eligible,
            "optimal_action": optimal_action,
            "actual_recoverable": actual_recoverable
        })

    df = pd.DataFrame(records)
    return df


if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    os.makedirs("ml", exist_ok=True)
    
    print("Generating 1,250 synthetic merchant transactions...")
    df = generate_dataset(1250)
    
    output_path = os.path.join("data", "synthetic_transactions.csv")
    df.to_csv(output_path, index=False)
    print(f"Dataset successfully created at: {output_path}")
    print(f"Total records: {len(df)}")
    print(f"Payment Status Breakdown:\n{df['payment_status'].value_counts()}")
    print(f"Recovery Eligible Count:\n{df['recovery_eligible'].value_counts()}")
    print(f"Optimal Actions:\n{df['optimal_action'].value_counts()}")
