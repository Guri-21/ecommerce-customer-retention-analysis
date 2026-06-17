from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import pandas as pd
import numpy as np
import io

from models.anomaly import run_anomaly_detection, clean_anomalies
from models.churn import run_churn_prediction
from models.forecasting import run_time_series_forecast, run_product_retention_forecast
from models.profiler import run_data_profile, run_correlation, run_distribution
from models.data_health import run_data_health, auto_fix_dataset

app = FastAPI(title="AutoML Studio Analytics Engine", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def read_csv_robust(content: bytes) -> pd.DataFrame:
    """Read CSV with robust encoding handling."""
    try:
        return pd.read_csv(io.StringIO(content.decode('utf-8')))
    except UnicodeDecodeError:
        return pd.read_csv(io.StringIO(content.decode('latin-1')))


@app.get("/")
def health_check():
    return {"status": "ok", "version": "4.0.0", "message": "AutoML Studio Analytics Engine is running"}


@app.post("/api/analyze-csv")
async def analyze_csv(file: UploadFile = File(...)):
    """
    Full analysis pipeline:
    1. Data Profiling (column stats, quality score)
    2. Anomaly Detection (Isolation Forest with scoring)
    3. Churn Prediction (RFM + Random Forest)
    4. Time-Series Forecasting (trend + 30-day projection)
    5. Correlation Analysis (matrix + top pairs)
    6. Distribution Analysis (histograms)
    7. Data Health Assessment (quality scores, issues, fix suggestions)
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        content = await file.read()
        df = read_csv_robust(content)

        # Memory optimization for Render free tier (512MB limit)
        # 1. Downsample large datasets
        original_rows = len(df)
        if len(df) > 10000:
            df = df.sample(n=10000, random_state=42).reset_index(drop=True)

        # 2. Optimize dtypes to reduce memory
        for col in df.select_dtypes(include=['float64']).columns:
            df[col] = df[col].astype('float32')
        for col in df.select_dtypes(include=['int64']).columns:
            if df[col].min() >= -32768 and df[col].max() <= 32767:
                df[col] = df[col].astype('int16')
            else:
                df[col] = df[col].astype('int32')

        # Free the raw CSV content from memory
        del content
        import gc
        gc.collect()

        # 3. Run each model sequentially with cleanup between runs
        profile = run_data_profile(df)
        gc.collect()

        anomaly = run_anomaly_detection(df)
        gc.collect()

        churn = run_churn_prediction(df)
        gc.collect()

        forecast = run_time_series_forecast(df)
        gc.collect()

        retention = run_product_retention_forecast(df)
        gc.collect()

        corr = run_correlation(df)
        gc.collect()

        dist = run_distribution(df)
        gc.collect()

        health = run_data_health(df)
        gc.collect()

        return {
            "status": "success",
            "filename": file.filename,
            "rows_processed": original_rows,
            "rows_sampled": len(df),
            "columns_processed": len(df.columns),
            "profile": profile,
            "anomaly_analysis": anomaly,
            "churn_prediction": churn,
            "time_series_forecast": forecast,
            "product_retention_forecast": retention,
            "correlation": corr,
            "distribution": dist,
            "data_health": health,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing CSV: {str(e)}")


@app.post("/api/clean-csv")
async def clean_csv(file: UploadFile = File(...)):
    """
    Remove anomalous rows from a dataset and return the cleaned CSV.
    Uses Isolation Forest with 1% contamination threshold.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        content = await file.read()
        df = read_csv_robust(content)

        cleaned_df, rows_removed, total_rows = clean_anomalies(df)

        # Convert to CSV bytes for download
        output = io.BytesIO()
        cleaned_df.to_csv(output, index=False)
        output.seek(0)

        clean_filename = file.filename.replace('.csv', '_cleaned.csv')

        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{clean_filename}"',
                "X-Rows-Removed": str(rows_removed),
                "X-Rows-Remaining": str(len(cleaned_df)),
                "X-Total-Rows": str(total_rows),
                "Access-Control-Expose-Headers": "X-Rows-Removed, X-Rows-Remaining, X-Total-Rows, Content-Disposition",
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error cleaning CSV: {str(e)}")


@app.post("/api/fix-csv")
async def fix_csv(file: UploadFile = File(...)):
    """
    Auto-fix data quality issues:
    - Fill missing numeric values with median
    - Fill missing categorical values with mode
    - Remove duplicate rows
    Returns the fixed CSV as a download.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        content = await file.read()
        df = read_csv_robust(content)

        fixed_df, change_log = auto_fix_dataset(df)

        total_fixes = sum(c.get("rows_affected", 0) for c in change_log if c["action"] == "fill_missing")
        dupes_removed = sum(c.get("rows_removed", 0) for c in change_log if c["action"] == "remove_duplicates")

        output = io.BytesIO()
        fixed_df.to_csv(output, index=False)
        output.seek(0)

        fixed_filename = file.filename.replace('.csv', '_fixed.csv')

        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{fixed_filename}"',
                "X-Fixes-Applied": str(len(change_log)),
                "X-Cells-Fixed": str(total_fixes),
                "X-Duplicates-Removed": str(dupes_removed),
                "X-Rows-Remaining": str(len(fixed_df)),
                "Access-Control-Expose-Headers": "X-Fixes-Applied, X-Cells-Fixed, X-Duplicates-Removed, X-Rows-Remaining, Content-Disposition",
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fixing CSV: {str(e)}")
