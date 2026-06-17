const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Analysis = require('../models/Analysis');
const fs = require('fs');
const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

let aiReady = false;

function getApiKey() {
    return process.env.OPENROUTER_API_KEY || null;
}

// Validate API key on first load (non-blocking)
setTimeout(async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
        console.error('❌ OPENROUTER_API_KEY is not set in .env');
        return;
    }
    try {
        const res = await axios.post(OPENROUTER_API_URL, {
            model: MODEL,
            messages: [{ role: 'user', content: 'Reply with just "ok"' }],
            max_tokens: 10,
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
                'X-Title': 'AutoML Studio',
            },
            timeout: 15000,
        });
        if (res.data?.choices?.[0]?.message) {
            aiReady = true;
            console.log(`✅ OpenRouter API key validated (model: ${MODEL})`);
        }
    } catch (err) {
        console.error('⚠️  OpenRouter API key validation failed:', err.response?.data?.error?.message || err.message);
        console.error('   → Check your OPENROUTER_API_KEY in backend/.env');
    }
}, 2000);

// Build context from analysis data
function buildAnalysisContext(analysis) {
    if (!analysis) return '';

    let ctx = `## Dataset: ${analysis.filename}\n`;
    ctx += `- Rows: ${analysis.rowsProcessed || '?'}\n`;
    ctx += `- Columns: ${analysis.columnsProcessed || '?'}\n\n`;

    const results = analysis.results || {};

    // Profile summary
    if (results.profile) {
        const p = results.profile;
        ctx += `## Data Profile\n`;
        ctx += `- Quality Score: ${p.quality_score}%\n`;
        ctx += `- Total Missing Values: ${p.total_missing}\n`;
        ctx += `- Numeric Columns: ${p.numeric_columns}, Categorical: ${p.categorical_columns}\n`;
        if (p.columns) {
            ctx += `- Column Details:\n`;
            p.columns.slice(0, 20).forEach(c => {
                ctx += `  - ${c.name} (${c.dtype}): ${c.missing_pct}% missing, ${c.unique} unique`;
                if (c.mean != null) ctx += `, mean=${c.mean}, std=${c.std}`;
                ctx += `\n`;
            });
        }
        ctx += '\n';
    }

    // Anomaly summary
    if (results.anomaly_analysis && !results.anomaly_analysis.error) {
        const a = results.anomaly_analysis;
        ctx += `## Anomaly Detection Results\n`;
        ctx += `- Anomalies Found: ${a.anomaly_count} (${a.anomaly_percentage}%)\n`;
        if (a.severity_distribution) {
            ctx += `- Severity: Critical=${a.severity_distribution.critical}, High=${a.severity_distribution.high}, Medium=${a.severity_distribution.medium}\n`;
        }
        if (a.top_anomaly_drivers) {
            ctx += `- Top Drivers: ${a.top_anomaly_drivers.map(d => `${d.column} (${d.deviation_pct}% deviation)`).join(', ')}\n`;
        }
        ctx += '\n';
    }

    // Churn summary
    if (results.churn_prediction && !results.churn_prediction.error) {
        const c = results.churn_prediction;
        ctx += `## Churn Prediction Results\n`;
        ctx += `- Total Customers: ${c.total_customers}\n`;
        ctx += `- Overall Churn Rate: ${c.overall_churn_rate}%\n`;
        ctx += `- Retention Rate: ${c.retention_rate}%\n`;
        if (c.segment_counts) {
            ctx += `- Risk Segments: ${JSON.stringify(c.segment_counts)}\n`;
        }
        if (c.feature_importance) {
            ctx += `- Feature Importance: ${JSON.stringify(c.feature_importance)}\n`;
        }
        ctx += '\n';
    }

    // Forecast summary
    if (results.time_series_forecast && !results.time_series_forecast.error) {
        const f = results.time_series_forecast;
        ctx += `## Forecast Summary\n`;
        ctx += `- Date Column: ${f.date_column_used}\n`;
        ctx += `- Target Column: ${f.target_column_used}\n`;
        ctx += `- Forecast Period: ${f.forecast_period_days} days\n`;
        ctx += '\n';
    }

    // Product Retention Forecast summary
    if (results.product_retention_forecast && !results.product_retention_forecast.error) {
        const prf = results.product_retention_forecast;
        ctx += `## Product Retention Forecast\n`;
        ctx += `- Returning Customers: ${prf.returning_customer_count} out of ${prf.total_customers} (${prf.return_rate_pct}% return rate)\n`;
        if (prf.top_retention_products && prf.top_retention_products.length > 0) {
            ctx += `- Top Products Driving Customer Retention:\n`;
            prf.top_retention_products.forEach(p => {
                ctx += `  - ${p.product}${p.category && p.category !== '—' ? ` (${p.category})` : ''}: ${p.return_customer_share_pct}% of returning customer orders, retention lift ${p.retention_lift}x, trend: ${p.trend} (${p.trend_change_pct}%)\n`;
                ctx += `    → Recommendation: ${p.recommendation}\n`;
            });
        }
        if (prf.manufacturing_actions && prf.manufacturing_actions.length > 0) {
            ctx += `- Manufacturing Actions:\n`;
            prf.manufacturing_actions.forEach(a => {
                ctx += `  - ${a.product}: ${a.action.toUpperCase()} (urgency: ${a.urgency}) — ${a.reason}\n`;
            });
        }
        ctx += '\n';
    }

    // Data health summary
    if (results.data_health) {
        const h = results.data_health;
        ctx += `## Data Health\n`;
        ctx += `- Overall Score: ${h.overall_score}/100\n`;
        ctx += `- Completeness: ${h.completeness}%, Uniqueness: ${h.uniqueness}%\n`;
        ctx += `- Duplicate Rows: ${h.duplicate_rows} (${h.duplicate_pct}%)\n`;
        if (h.issues) {
            ctx += `- Issues: ${h.issues.map(i => i.message).join('; ')}\n`;
        }
        ctx += '\n';
    }

    // Correlation summary
    if (results.correlation && !results.correlation.error) {
        const cr = results.correlation;
        if (cr.top_correlations) {
            ctx += `## Top Correlations\n`;
            cr.top_correlations.slice(0, 5).forEach(c => {
                ctx += `- ${c.col1} ↔ ${c.col2}: ${c.correlation}\n`;
            });
            ctx += '\n';
        }
    }

    return ctx;
}

// Test endpoint (no auth needed)
router.get('/test', async (req, res) => {
    const apiKey = getApiKey();
    if (!apiKey) {
        return res.status(503).json({
            status: 'error',
            message: 'OPENROUTER_API_KEY is not configured. Add it to backend/.env file.',
            configured: false
        });
    }

    try {
        const response = await axios.post(OPENROUTER_API_URL, {
            model: MODEL,
            messages: [{ role: 'user', content: 'Reply with just "Hello! AI Chat is working."' }],
            max_tokens: 30,
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:5001',
                'X-Title': 'AutoML Studio',
            },
            timeout: 15000,
        });

        const reply = response.data?.choices?.[0]?.message?.content || '';
        res.json({
            status: 'ok',
            message: reply,
            configured: true,
            model: MODEL
        });
    } catch (err) {
        console.error('Chat test failed:', err.response?.data || err.message);
        res.status(500).json({
            status: 'error',
            message: `API key is set but test failed: ${err.response?.data?.error?.message || err.message}`,
            configured: true
        });
    }
});

// Chat endpoint
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { message, analysisId, history } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required.' });
        }

        const apiKey = getApiKey();
        if (!apiKey) {
            return res.status(503).json({
                error: 'AI Chat is not configured. Please add OPENROUTER_API_KEY to your backend .env file.'
            });
        }

        // Load analysis context if provided
        let analysisContext = '';
        if (analysisId) {
            try {
                const analysis = await Analysis.findById(analysisId);
                if (analysis) {
                    let resultsData = analysis.results;
                    if (typeof analysis.results === 'string' && analysis.results.endsWith('.json')) {
                        try {
                            const fileContent = fs.readFileSync(analysis.results, 'utf8');
                            resultsData = JSON.parse(fileContent);
                        } catch (fsErr) {
                            console.warn('Could not read analysis results file:', fsErr.message);
                        }
                    }
                    const hydrated = { ...analysis.toObject(), results: resultsData };
                    analysisContext = buildAnalysisContext(hydrated);
                }
            } catch (dbErr) {
                console.warn('Could not load analysis context:', dbErr.message);
            }
        }

        const systemPrompt = `You are an expert data analyst assistant for AutoML Studio, an automated machine learning platform. 
You help users understand their data, analysis results, and provide actionable business insights.

Rules:
- Be concise but helpful. Use bullet points when listing things.
- If the user asks about their data, reference the analysis context below.
- If asked for recommendations, give specific, actionable advice.
- Format responses in clean markdown.
- Never make up data that isn't in the context.
- If you don't have enough context to answer, say so clearly.
- When discussing product retention, explain which products drive repeat customers and what manufacturing actions to take.

${analysisContext ? `\n--- ANALYSIS CONTEXT ---\n${analysisContext}\n--- END CONTEXT ---` : '(No analysis data loaded yet. The user hasn\'t run an analysis or you don\'t have context.)'}`;

        // Build messages in OpenAI format
        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Add chat history
        if (history && Array.isArray(history) && history.length > 0) {
            for (const msg of history) {
                if (msg && msg.content && msg.role) {
                    messages.push({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: msg.content,
                    });
                }
            }
        }

        // Add current user message
        messages.push({ role: 'user', content: message });

        const response = await axios.post(OPENROUTER_API_URL, {
            model: MODEL,
            messages,
            max_tokens: 2048,
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
                'X-Title': 'AutoML Studio',
            },
            timeout: 30000,
        });

        const reply = response.data?.choices?.[0]?.message?.content;
        if (!reply) {
            console.error('Chat: Empty response from OpenRouter');
            return res.status(500).json({ error: 'AI returned an empty response. Please try again.' });
        }

        res.json({ response: reply });
    } catch (err) {
        console.error('Chat error:', JSON.stringify(err.response?.data || err.message));

        const errMsg = err.response?.data?.error?.message || err.response?.data?.error || err.message || '';
        let userMessage = `AI error: ${typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg)}`;

        if (err.code === 'ECONNABORTED' || (typeof errMsg === 'string' && errMsg.includes('timeout'))) {
            userMessage = 'AI response timed out. Please try a simpler question.';
        } else if (typeof errMsg === 'string' && (errMsg.includes('429') || errMsg.includes('rate'))) {
            userMessage = 'AI rate limit reached. Please wait a moment and try again.';
        } else if (typeof errMsg === 'string' && (errMsg.includes('safety') || errMsg.includes('SAFETY'))) {
            userMessage = 'The AI could not respond due to safety filters. Please rephrase your question.';
        }

        res.status(500).json({ error: userMessage });
    }
});

module.exports = router;
