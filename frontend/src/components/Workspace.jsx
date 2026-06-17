import React, { useState, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UploadCloud, CheckCircle, AlertTriangle, Brain, Sparkles, FileText } from 'lucide-react';
import { spring, buttonPress, cardHover, fadeUp, stagger as staggerFn, appleEase } from '../lib/motion';
import { API_URL, ML_URL } from '../lib/api';
import OverviewTab from './OverviewTab';
import AnomalyTab from './AnomalyTab';
import ChurnTab from './ChurnTab';
import ForecastTab from './ForecastTab';
import ProfileTab from './ProfileTab';
import CorrelationTab from './CorrelationTab';
import DataHealthTab from './DataHealthTab';

const PIPELINE_STAGES = ['Uploading', 'Cleaning data', 'Anomaly detection', 'Churn prediction', 'Forecasting', 'Finalizing'];
const AI_MESSAGES = [
  'Scanning your dataset...',
  'Identifying patterns in customer behavior...',
  'Training anomaly detection models...',
  'Building churn risk profiles...',
  'Generating demand forecasts...',
  'Wrapping up your insights...',
];

export default function Workspace() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pipelineStage, setPipelineStage] = useState(0);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef(null);

  const handleUpload = async (e) => {
    e?.preventDefault();
    if (!file) return setError('Please select a CSV file first.');
    setLoading(true);
    setError('');
    setPipelineStage(0);

    const interval = setInterval(() => {
      setPipelineStage(prev => Math.min(prev + 1, PIPELINE_STAGES.length - 1));
    }, 2500);

    const formData = new FormData();
    const startTime = Date.now();

    // For large files (>5MB), trim to first 10,000 rows on the client
    // to prevent server OOM crashes on Render free tier
    const MAX_ROWS = 10000;
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB

    if (file.size > MAX_SIZE) {
      try {
        const text = await file.text();
        const lines = text.split('\n');
        const trimmed = lines.slice(0, MAX_ROWS + 1).join('\n'); // +1 for header
        const trimmedBlob = new Blob([trimmed], { type: 'text/csv' });
        formData.append('file', trimmedBlob, file.name);
        addToast(`Large file detected — analyzing first ${MAX_ROWS.toLocaleString()} rows for optimal performance`, 'info');
      } catch {
        formData.append('file', file);
      }
    } else {
      formData.append('file', file);
    }

    try {
      const res = await axios.post(`${ML_URL}/api/analyze-csv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000, // 2 minutes for large files
      });
      setAnalysis(res.data);
      addToast(`Analysis complete — ${res.data.rows_processed?.toLocaleString()} rows processed`, 'success');

      if (token) {
        // Save Analysis to MongoDB permanently
        axios.post(`${API_URL}/api/analysis`, {
          filename: file.name,
          rowsProcessed: res.data.rows_processed || 0,
          columnsProcessed: res.data.columns_processed || 0,
          results: res.data
        }, { headers: { Authorization: `Bearer ${token}` } }).catch(err => console.error("Failed to save analysis history:", err));

        // Log usage statistics
        axios.post(`${API_URL}/api/usage/log`, {
          action: 'analysis', filename: file.name,
          rowsProcessed: res.data.rows_processed || 0,
          columnsProcessed: res.data.columns_processed || 0,
          duration: Date.now() - startTime
        }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to analyze dataset.');
      addToast('Analysis failed. Please try again.', 'error');
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) setFile(f);
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'anomaly', label: 'Anomalies' },
    { id: 'churn', label: 'Churn' },
    { id: 'forecast', label: 'Forecast' },
    { id: 'profile', label: 'Profile' },
    { id: 'correlation', label: 'Correlations' },
    { id: 'health', label: 'Data Health' },
  ];

  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <PipelineView key="pipeline" stage={pipelineStage} filename={file?.name} />
      ) : analysis ? (
        <ResultsView
          key="results"
          analysis={analysis}
          tabs={tabs}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onReset={() => { setAnalysis(null); setFile(null); }}
          file={file}
        />
      ) : (
        <UploadView
          key="upload"
          file={file}
          setFile={setFile}
          dragOver={dragOver}
          setDragOver={setDragOver}
          onDrop={onDrop}
          fileInput={fileInput}
          error={error}
          handleUpload={handleUpload}
        />
      )}
    </AnimatePresence>
  );
}

/* ─── AI Breathing Brain ─── */
function AIBrain() {
  return (
    <div className="relative mb-8">
      {/* Pulsing ring layers */}
      <motion.div
        className="absolute inset-0 rounded-full bg-(--color-accent)/10"
        animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: 80, height: 80, left: '50%', top: '50%', marginLeft: -40, marginTop: -40 }}
      />
      <motion.div
        className="absolute inset-0 rounded-full bg-(--color-accent)/5"
        animate={{ scale: [1, 2, 1], opacity: [0.2, 0, 0.2] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        style={{ width: 80, height: 80, left: '50%', top: '50%', marginLeft: -40, marginTop: -40 }}
      />
      {/* Breathing brain */}
      <motion.div
        animate={{
          scale: [1, 1.08, 1],
          rotate: [0, 5, -5, 0],
        }}
        transition={{
          scale: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
          rotate: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="relative z-10 w-20 h-20 mx-auto rounded-full bg-(--color-accent)/10 flex items-center justify-center"
      >
        <Brain size={36} className="text-(--color-accent)" />
      </motion.div>
    </div>
  );
}

/* ─── Flowing Pipeline ─── */
function PipelineView({ stage, filename }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02, y: -20 }}
      transition={{ ...spring.gentle }}
      className="flex flex-col items-center justify-center py-16"
    >
      <AIBrain />

      {/* AI Message — smooth crossfade */}
      <AnimatePresence mode="wait">
        <motion.h2
          key={stage}
          initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
          transition={{ ...spring.gentle }}
          className="text-xl font-bold mb-2 text-center"
        >
          {AI_MESSAGES[stage]}
        </motion.h2>
      </AnimatePresence>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-sm text-(--color-text-muted) mb-10"
      >Analyzing {filename}</motion.p>

      {/* Horizontal flowing pipeline */}
      <div className="w-full max-w-2xl px-4">
        <div className="flex items-center justify-between relative">
          {/* Connecting line */}
          <div className="absolute top-4 left-8 right-8 h-0.5 bg-(--color-border) rounded-full" />
          <motion.div
            className="absolute top-4 left-8 h-0.5 bg-(--color-accent) rounded-full origin-left"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: stage / (PIPELINE_STAGES.length - 1) }}
            style={{ width: 'calc(100% - 64px)' }}
            transition={{ ...spring.heavy }}
          />

          {PIPELINE_STAGES.map((s, i) => {
            const done = i < stage;
            const active = i === stage;
            return (
              <div key={i} className="flex flex-col items-center relative z-10" style={{ width: `${100 / PIPELINE_STAGES.length}%` }}>
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{
                    scale: active ? [1, 1.15, 1] : 1,
                    opacity: 1,
                  }}
                  transition={active
                    ? { scale: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }, opacity: { ...spring.gentle, delay: i * 0.08 } }
                    : { ...spring.bouncy, delay: i * 0.08 }
                  }
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs relative ${
                    done ? 'bg-green-500 text-white' :
                    active ? 'bg-(--color-accent) text-white' :
                    'bg-(--color-bg-card) border border-(--color-border) text-(--color-text-muted)'
                  }`}
                >
                  {done ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ ...spring.bouncy }}
                    >
                      <CheckCircle size={14} />
                    </motion.div>
                  ) : active ? (
                    <motion.div
                      animate={{ rotate: [0, 180, 360] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    >
                      <Sparkles size={12} />
                    </motion.div>
                  ) : (
                    <span className="text-[10px]">{i + 1}</span>
                  )}

                  {/* Active ring pulse */}
                  {active && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-(--color-accent)"
                      animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                    />
                  )}
                </motion.div>
                <motion.span
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: done || active ? 1 : 0.4, y: 0 }}
                  transition={{ ...spring.gentle, delay: i * 0.06 }}
                  className={`text-[11px] mt-2 text-center leading-tight ${
                    active ? 'text-(--color-text) font-medium' : 'text-(--color-text-muted)'
                  }`}
                >{s}</motion.span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Upload View (with anticipation) ─── */
function UploadView({ file, setFile, dragOver, setDragOver, onDrop, fileInput, error, handleUpload }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, y: -10 }}
      transition={{ ...spring.gentle }}
    >
      <h2 className="text-2xl font-bold mb-1">Workspace</h2>
      <p className="text-sm text-(--color-text-secondary) mb-8">Upload a CSV to run six ML pipelines automatically.</p>

      {/* Upload zone — spring scale on drag */}
      <motion.div
        animate={dragOver ? { scale: 1.015, borderColor: 'var(--color-accent)' } : { scale: 1 }}
        transition={{ ...spring.snappy }}
        className={`rounded-2xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer ${dragOver ? 'border-(--color-accent) bg-(--color-accent)/5' : 'border-(--color-border) hover:border-(--color-text-muted)'}`}
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <motion.div
          animate={dragOver ? { y: -5, scale: 1.1 } : { y: 0, scale: 1 }}
          transition={{ ...spring.bouncy }}
        >
          <UploadCloud size={40} className="mx-auto mb-4 text-(--color-text-muted)" />
        </motion.div>
        <h3 className="font-semibold mb-1">Drop your CSV here or click to browse</h3>
        <p className="text-sm text-(--color-text-muted) mb-4">Supports any e-commerce, sales, or transactional dataset</p>

        <AnimatePresence>
          {file && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -10 }}
              transition={{ ...spring.bouncy }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-(--color-accent)/10 text-(--color-accent) text-sm font-medium"
            >
              <FileText size={14} />
              {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
            </motion.div>
          )}
        </AnimatePresence>

        <input ref={fileInput} type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} className="hidden" />
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ ...spring.snappy }}
            className="flex items-center gap-2 mt-4 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5"
          >
            <AlertTriangle size={16} /> {typeof error === 'string' ? error : JSON.stringify(error)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Button — anticipation (pulls inward slightly before action) */}
      <motion.button
        {...buttonPress}
        onClick={handleUpload}
        disabled={!file}
        className="w-full mt-6 bg-(--color-accent) text-white font-medium py-3 rounded-full text-sm hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
      >
        Run Analysis Pipeline
      </motion.button>
    </motion.div>
  );
}

/* ─── Results View ─── */
export function ResultsView({ analysis, tabs, activeTab, setActiveTab, onReset, file }) {
  // Determine tab slide direction
  const tabIndex = tabs.findIndex(t => t.id === activeTab);

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab data={analysis} />;
      case 'anomaly': return <AnomalyTab data={analysis.anomaly_analysis} file={file} />;
      case 'churn': return <ChurnTab data={analysis.churn_prediction} />;
      case 'forecast': return <ForecastTab data={analysis.time_series_forecast} retentionData={analysis.product_retention_forecast} />;
      case 'profile': return <ProfileTab data={analysis.profile} />;
      case 'correlation': return <CorrelationTab data={analysis.correlation} />;
      case 'health': return <DataHealthTab data={analysis.data_health} file={file} />;
      default: return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ ...spring.gentle }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-0.5">Analysis Results</h2>
          <p className="text-sm text-(--color-text-secondary)">{analysis.filename} — {analysis.rows_processed?.toLocaleString()} rows × {analysis.columns_processed} columns</p>
        </div>
        <motion.button
          {...buttonPress}
          onClick={onReset}
          className="px-4 py-2 rounded-full text-sm font-medium border border-(--color-border) hover:bg-(--color-bg-hover) transition-colors cursor-pointer"
        >
          New Analysis
        </motion.button>
      </div>

      {/* Tabs with morphing active indicator */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-(--color-bg-card) border border-(--color-border) overflow-x-auto relative">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`relative px-3.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer z-10 ${activeTab === t.id ? 'text-(--color-text)' : 'text-(--color-text-secondary) hover:text-(--color-text)'}`}
          >
            {activeTab === t.id && (
              <motion.div
                layoutId="active-tab"
                className="absolute inset-0 rounded-lg bg-(--color-bg) shadow-sm"
                transition={{ ...spring.snappy }}
                style={{ zIndex: -1 }}
              />
            )}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content with directional slide */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8, scale: 0.995 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.995 }}
          transition={{ ...spring.gentle }}
        >
          {renderTab()}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
