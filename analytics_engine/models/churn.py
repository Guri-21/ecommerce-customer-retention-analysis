import pandas as pd
import numpy as np
import warnings
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")


def run_churn_prediction(df: pd.DataFrame) -> dict:
    """
    Automated Churn Prediction using RFM (Recency, Frequency, Monetary) analysis.
    
    Strategy:
    1. Auto-detect customer ID, date, and monetary columns
    2. Engineer RFM features
    3. Label churners heuristically (no purchase in last 25% of date range)
    4. Train Random Forest and return risk segments + feature importance
    """
    
    # --- Step 1: Auto-detect columns ---
    date_col = _find_date_column(df)
    customer_col = _find_customer_column(df)
    monetary_col = _find_monetary_column(df)
    
    if not date_col or not customer_col or not monetary_col:
        return {
            "error": "Could not auto-detect required columns (Customer ID, Date, Sales/Revenue). "
                     "Ensure your CSV has identifiable customer, date, and monetary columns."
        }
    
    # --- Step 2: Build RFM table ---
    df['_parsed_date'] = pd.to_datetime(df[date_col], errors='coerce')
    df_clean = df.dropna(subset=['_parsed_date', monetary_col, customer_col])
    
    if len(df_clean) < 50:
        return {"error": "Not enough valid rows to build churn model."}
    
    reference_date = df_clean['_parsed_date'].max() + pd.Timedelta(days=1)
    
    rfm = df_clean.groupby(customer_col).agg(
        recency=('_parsed_date', lambda x: (reference_date - x.max()).days),
        frequency=('_parsed_date', 'count'),
        monetary=(monetary_col, 'sum')
    ).reset_index()
    
    rfm.columns = ['customer_id', 'recency', 'frequency', 'monetary']
    rfm = rfm[(rfm['frequency'] > 0) & (rfm['monetary'] > 0)]
    
    if len(rfm) < 30:
        return {"error": "Not enough unique customers to build a meaningful churn model."}
    
    # --- Step 3: Heuristic churn labeling ---
    # Customers whose last purchase is in the oldest 25% of recency = "churned"
    recency_threshold = rfm['recency'].quantile(0.75)
    rfm['churned'] = (rfm['recency'] >= recency_threshold).astype(int)
    
    # --- Step 4: Train Random Forest ---
    feature_cols = ['recency', 'frequency', 'monetary']
    X = rfm[feature_cols].copy()
    y = rfm['churned']
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    model = RandomForestClassifier(n_estimators=30, random_state=42, max_depth=5)
    model.fit(X_scaled, y)
    
    rfm['churn_probability'] = model.predict_proba(X_scaled)[:, 1]
    
    # --- Step 5: Risk segmentation ---
    rfm['risk_segment'] = pd.cut(
        rfm['churn_probability'],
        bins=[0, 0.3, 0.6, 1.0],
        labels=['Low Risk', 'Medium Risk', 'High Risk'],
        include_lowest=True
    )
    
    segment_counts = rfm['risk_segment'].value_counts().to_dict()
    segment_counts = {str(k): int(v) for k, v in segment_counts.items()}
    
    # Feature importance
    importances = dict(zip(feature_cols, [round(float(x), 4) for x in model.feature_importances_]))
    
    # Summary stats per segment
    segment_stats = {}
    for seg in ['Low Risk', 'Medium Risk', 'High Risk']:
        seg_df = rfm[rfm['risk_segment'] == seg]
        if len(seg_df) > 0:
            segment_stats[seg] = {
                "count": int(len(seg_df)),
                "avg_recency": round(float(seg_df['recency'].mean()), 1),
                "avg_frequency": round(float(seg_df['frequency'].mean()), 1),
                "avg_monetary": round(float(seg_df['monetary'].mean()), 2),
                "avg_churn_prob": round(float(seg_df['churn_probability'].mean()), 3)
            }
    
    # Top at-risk customers (sample)
    top_risk = rfm.nlargest(10, 'churn_probability')[['customer_id', 'recency', 'frequency', 'monetary', 'churn_probability']].copy()
    top_risk['customer_id'] = top_risk['customer_id'].astype(str)
    top_risk_list = top_risk.round(3).to_dict(orient='records')
    
    overall_churn_rate = round(float(rfm['churned'].mean()) * 100, 1)
    
    return {
        "total_customers": int(len(rfm)),
        "overall_churn_rate": overall_churn_rate,
        "retention_rate": round(100 - overall_churn_rate, 1),
        "segment_counts": segment_counts,
        "segment_stats": segment_stats,
        "feature_importance": importances,
        "top_at_risk_customers": top_risk_list,
        "columns_used": {
            "customer": customer_col,
            "date": date_col,
            "monetary": monetary_col
        },
        "model_info": {
            "algorithm": "Random Forest Classifier",
            "n_estimators": 100,
            "features": feature_cols,
            "recency_threshold_days": int(recency_threshold)
        }
    }


def _find_date_column(df):
    """Auto-detect the best date column."""
    for col in df.columns:
        if any(kw in col.lower() for kw in ['date', 'time', 'timestamp', 'order_date']):
            try:
                pd.to_datetime(df[col].dropna().iloc[0])
                return col
            except:
                pass
    return None


def _find_customer_column(df):
    """Auto-detect the customer ID column."""
    for col in df.columns:
        if any(kw in col.lower() for kw in ['customer_id', 'customer id', 'cust_id', 'user_id', 'userid', 'client']):
            return col
    # Fallback: look for 'id' columns with many unique values
    for col in df.columns:
        if 'id' in col.lower() and df[col].nunique() > 10:
            return col
    return None


def _find_monetary_column(df):
    """Auto-detect the monetary/sales column."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    for col in numeric_cols:
        if any(kw in col.lower() for kw in ['sales', 'revenue', 'amount', 'total', 'price', 'monetary', 'profit']):
            return col
    return numeric_cols[0] if numeric_cols else None
