import pandas as pd
import numpy as np
import warnings
from sklearn.ensemble import IsolationForest

warnings.filterwarnings("ignore")


def get_anomaly_mask(df: pd.DataFrame, contamination: float = 0.01):
    """
    Shared utility: runs Isolation Forest and returns (mask, scores, numeric_cols).
    mask: boolean Series where True = anomaly.
    """
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if len(numeric_cols) == 0:
        return None, None, []

    features = df[numeric_cols].copy()
    features = features.fillna(features.median())

    model = IsolationForest(contamination=contamination, n_estimators=50, max_samples=256, random_state=42)
    predictions = model.fit_predict(features)
    scores = model.decision_function(features)

    mask = pd.Series(predictions == -1, index=df.index)
    return mask, scores, numeric_cols


def clean_anomalies(df: pd.DataFrame, contamination: float = 0.01):
    """
    Remove anomalous rows from a DataFrame.
    Returns (cleaned_df, rows_removed, total_rows).
    """
    mask, scores, numeric_cols = get_anomaly_mask(df, contamination)
    if mask is None:
        return df, 0, len(df)

    rows_removed = int(mask.sum())
    cleaned_df = df[~mask].copy()
    return cleaned_df, rows_removed, len(df)


def run_anomaly_detection(df: pd.DataFrame) -> dict:
    """
    Unsupervised Anomaly Detection using Isolation Forest.
    Returns anomaly count, anomaly scores, top drivers, and flagged sample rows.
    """
    mask, scores, numeric_cols = get_anomaly_mask(df)
    if mask is None:
        return {"error": "No numeric columns found to run Anomaly Detection."}

    df = df.copy()
    df['_anomaly_flag'] = mask.map({True: -1, False: 1})
    df['_anomaly_score'] = scores

    anomalies = df[df['_anomaly_flag'] == -1]
    total_anomalies = len(anomalies)

    if total_anomalies == 0:
        return {"anomaly_count": 0, "message": "No anomalies detected.", "anomaly_percentage": 0}

    # Means comparison
    normal_means = df[df['_anomaly_flag'] == 1][numeric_cols].mean().to_dict()
    anomaly_means = anomalies[numeric_cols].mean().to_dict()

    # Driver analysis
    differences = {}
    for col in numeric_cols:
        norm_val = normal_means.get(col, 0)
        anom_val = anomaly_means.get(col, 0)
        if pd.isna(norm_val) or pd.isna(anom_val) or norm_val == 0:
            diff = 0
        else:
            diff = abs((anom_val - norm_val) / norm_val) * 100
        differences[col] = diff

    sorted_diffs = sorted(differences.items(), key=lambda x: x[1], reverse=True)[:5]
    top_drivers = [{"column": item[0], "deviation_pct": round(item[1], 1)} for item in sorted_diffs]

    # Flagged sample rows (top 15 most anomalous)
    flagged_samples = anomalies.nsmallest(15, '_anomaly_score')
    sample_cols = numeric_cols[:6]
    flagged_list = []
    for _, row in flagged_samples.iterrows():
        flagged_list.append({
            "score": round(float(row['_anomaly_score']), 4),
            "values": {col: round(float(row[col]), 2) if not pd.isna(row[col]) else None for col in sample_cols}
        })

    # Severity distribution
    anomaly_scores = anomalies['_anomaly_score'].values
    severity = {
        "critical": int(np.sum(anomaly_scores < np.percentile(anomaly_scores, 10))),
        "high": int(np.sum((anomaly_scores >= np.percentile(anomaly_scores, 10)) & (anomaly_scores < np.percentile(anomaly_scores, 40)))),
        "medium": int(np.sum(anomaly_scores >= np.percentile(anomaly_scores, 40)))
    }

    return {
        "anomaly_count": total_anomalies,
        "anomaly_percentage": round((total_anomalies / len(df)) * 100, 2),
        "severity_distribution": severity,
        "top_anomaly_drivers": top_drivers,
        "flagged_samples": flagged_list,
        "anomaly_profile_means": {k: round(v, 2) for k, v in anomaly_means.items() if not pd.isna(v)},
        "normal_profile_means": {k: round(v, 2) for k, v in normal_means.items() if not pd.isna(v)},
        "model_info": {
            "algorithm": "Isolation Forest",
            "contamination": 0.01,
            "features_used": len(numeric_cols)
        }
    }
