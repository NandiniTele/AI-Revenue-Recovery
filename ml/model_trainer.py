"""
RecoverAI - Machine Learning Model Trainer & Evaluator
Trains an explainable revenue recovery prediction model on 70% train split, validates on 15%,
and evaluates on a 15% held-out test set to calculate genuine, reproducible metrics.
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    brier_score_loss,
    classification_report
)

from ml.dataset_generator import generate_dataset


def extract_features(df: pd.DataFrame) -> pd.DataFrame:
    """Prepares and extracts engineered features from raw transaction records."""
    df_feat = df.copy()
    
    # Extract timestamp features
    df_feat['transaction_timestamp'] = pd.to_datetime(df_feat['transaction_timestamp'])
    df_feat['hour_of_day'] = df_feat['transaction_timestamp'].dt.hour
    df_feat['day_of_week'] = df_feat['transaction_timestamp'].dt.dayofweek
    
    # Customer success ratio feature
    total_past = df_feat['previous_success_count'] + df_feat['previous_failure_count']
    df_feat['past_success_ratio'] = np.where(total_past > 0, df_feat['previous_success_count'] / total_past, 0.5)
    
    # Value to LTV ratio
    df_feat['amount_to_ltv_ratio'] = np.where(df_feat['customer_value'] > 0, df_feat['amount'] / df_feat['customer_value'], 1.0)
    
    return df_feat


def train_and_evaluate(dataset_path: str = "data/synthetic_transactions.csv"):
    os.makedirs("ml", exist_ok=True)
    os.makedirs("data", exist_ok=True)
    
    if not os.path.exists(dataset_path):
        print("Generating new dataset...")
        df = generate_dataset(1250)
        df.to_csv(dataset_path, index=False)
    else:
        df = pd.read_csv(dataset_path)

    print(f"Loaded dataset with {len(df)} records.")
    
    df_featured = extract_features(df)
    
    # Features and target
    numeric_features = [
        'amount',
        'previous_success_count',
        'previous_failure_count',
        'past_success_ratio',
        'days_overdue',
        'retry_count',
        'customer_value',
        'amount_to_ltv_ratio',
        'hour_of_day',
        'day_of_week'
    ]
    
    categorical_features = [
        'payment_method',
        'customer_tier',
        'failure_reason',
        'checkout_status',
        'subscription_status'
    ]
    
    X = df_featured[numeric_features + categorical_features]
    y = df_featured['actual_recoverable'].values
    
    # 70% Train, 15% Validation, 15% Test Split
    X_train_val, X_test, y_train_val, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42, stratify=y
    )
    
    X_train, X_val, y_train, y_val = train_test_split(
        X_train_val, y_train_val, test_size=0.1765, random_state=42, stratify=y_train_val # ~15% of total
    )
    
    print(f"Dataset split sizes: Train={len(X_train)} (70%), Val={len(X_val)} (15%), Held-out Test={len(X_test)} (15%)")
    
    # Preprocessor
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numeric_features),
            ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), categorical_features)
        ]
    )
    
    # Model pipeline
    clf = GradientBoostingClassifier(
        n_estimators=120,
        learning_rate=0.08,
        max_depth=4,
        subsample=0.85,
        random_state=42
    )
    
    pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', clf)
    ])
    
    # Fit model on training set
    pipeline.fit(X_train, y_train)
    
    # Validation evaluation
    val_preds = pipeline.predict(X_val)
    val_probs = pipeline.predict_proba(X_val)[:, 1]
    val_auc = roc_auc_score(y_val, val_probs)
    print(f"Validation ROC-AUC: {val_auc:.4f}")
    
    # Final Evaluation on Held-Out Test Set
    test_preds = pipeline.predict(X_test)
    test_probs = pipeline.predict_proba(X_test)[:, 1]
    
    accuracy = float(accuracy_score(y_test, test_preds))
    precision = float(precision_score(y_test, test_preds, zero_division=0))
    recall = float(recall_score(y_test, test_preds, zero_division=0))
    f1 = float(f1_score(y_test, test_preds, zero_division=0))
    roc_auc = float(roc_auc_score(y_test, test_probs))
    brier = float(brier_score_loss(y_test, test_probs))
    cm = confusion_matrix(y_test, test_preds).tolist()
    
    tn, fp, fn, tp = confusion_matrix(y_test, test_preds).ravel()
    
    # Extract Feature Importances
    cat_encoder = pipeline.named_steps['preprocessor'].named_transformers_['cat']
    cat_feature_names = cat_encoder.get_feature_names_out(categorical_features).tolist()
    all_feature_names = numeric_features + cat_feature_names
    
    importances = pipeline.named_steps['classifier'].feature_importances_
    feature_importance_list = sorted(
        [{"feature": name, "importance": round(float(imp), 4)} for name, imp in zip(all_feature_names, importances)],
        key=lambda x: x["importance"],
        reverse=True
    )[:12]
    
    # Business impact calculation on test set
    test_indices = X_test.index
    test_amounts = df.loc[test_indices, 'amount'].values
    
    actual_recovered_amount = float(np.sum(test_amounts[(y_test == 1) & (test_preds == 1)]))
    missed_recovery_amount = float(np.sum(test_amounts[(y_test == 1) & (test_preds == 0)])) # False Negatives
    wasted_action_amount = float(np.sum(test_amounts[(y_test == 0) & (test_preds == 1)])) # False Positives
    total_test_at_risk = float(np.sum(test_amounts))
    
    metrics_summary = {
        "model_type": "GradientBoostingClassifier + ColumnTransformer",
        "dataset_total": len(df),
        "train_size": len(X_train),
        "val_size": len(X_val),
        "test_size": len(X_test),
        "evaluation_metrics": {
            "accuracy": round(accuracy, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
            "roc_auc": round(roc_auc, 4),
            "brier_score": round(brier, 4)
        },
        "confusion_matrix": {
            "true_negatives": int(tn),
            "false_positives": int(fp),
            "false_negatives": int(fn),
            "true_positives": int(tp),
            "matrix_2x2": cm
        },
        "business_impact_test_set": {
            "total_test_revenue_at_risk": round(total_test_at_risk, 2),
            "recovered_revenue_captured": round(actual_recovered_amount, 2),
            "missed_recovery_opportunity_fn": round(missed_recovery_amount, 2),
            "wasted_action_revenue_fp": round(wasted_action_amount, 2),
            "recovery_capture_rate": round(actual_recovered_amount / max(1, (actual_recovered_amount + missed_recovery_amount)) * 100, 2)
        },
        "top_feature_importances": feature_importance_list,
        "feature_columns": {
            "numeric": numeric_features,
            "categorical": categorical_features
        }
    }
    
    # Save model artifact
    model_bundle_path = os.path.join("ml", "model_bundle.joblib")
    joblib.dump({
        "pipeline": pipeline,
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
        "metrics": metrics_summary
    }, model_bundle_path)
    print(f"Model saved to: {model_bundle_path}")
    
    # Save metrics JSON for API and UI scorecard
    metrics_json_path = os.path.join("ml", "ml_metrics.json")
    with open(metrics_json_path, "w") as f:
        json.dump(metrics_summary, f, indent=2)
    print(f"Metrics saved to: {metrics_json_path}")
    
    print("\n--- HELD-OUT TEST EVALUATION METRICS ---")
    print(f"Accuracy:  {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall:    {recall:.4f}")
    print(f"F1 Score:  {f1:.4f}")
    print(f"ROC-AUC:   {roc_auc:.4f}")
    print(f"Confusion Matrix:\nTN={tn}, FP={fp}\nFN={fn}, TP={tp}")
    
    return metrics_summary


if __name__ == "__main__":
    train_and_evaluate()
