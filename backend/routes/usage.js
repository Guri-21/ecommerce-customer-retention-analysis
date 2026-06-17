const express = require('express');
const jwt = require('jsonwebtoken');
const UsageLog = require('../models/UsageLog');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'automl_secret_key_2024';

function authCheck(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
  } catch { return null; }
}

// ─── Log a usage event ───
router.post('/log', async (req, res) => {
  const decoded = authCheck(req);
  if (!decoded) return res.status(401).json({ error: 'Auth required.' });

  try {
    const { action, filename, rowsProcessed, columnsProcessed, duration } = req.body;
    await UsageLog.create({
      userId: decoded.id,
      orgId: decoded.orgId || 'org_default',
      action: action || 'analysis',
      filename: filename || 'unknown',
      rowsProcessed: rowsProcessed || 0,
      columnsProcessed: columnsProcessed || 0,
      duration: duration || 0,
    });
    res.status(201).json({ logged: true });
  } catch (err) {
    console.error('Usage log error:', err.message);
    res.status(500).json({ error: 'Failed to log usage.' });
  }
});

// ─── Get own usage stats ───
router.get('/me', async (req, res) => {
  const decoded = authCheck(req);
  if (!decoded) return res.status(401).json({ error: 'Auth required.' });

  try {
    const myLogs = await UsageLog.find({ userId: decoded.id }).sort({ timestamp: -1 }).limit(100).lean();
    const totalAnalyses = myLogs.length;
    const totalRows = myLogs.reduce((sum, l) => sum + (l.rowsProcessed || 0), 0);

    // Last 7 days breakdown
    const now = new Date();
    const dailyCounts = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dailyCounts[d.toISOString().split('T')[0]] = 0;
    }
    myLogs.forEach(l => {
      const key = new Date(l.timestamp).toISOString().split('T')[0];
      if (dailyCounts.hasOwnProperty(key)) dailyCounts[key]++;
    });

    res.json({
      totalAnalyses,
      totalRows,
      recentLogs: myLogs.slice(0, 10),
      dailyChart: Object.entries(dailyCounts).map(([date, count]) => ({ date, count }))
    });
  } catch (err) {
    console.error('Usage fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch usage.' });
  }
});

// ─── ADMIN: Platform-wide stats ───
router.get('/admin/stats', async (req, res) => {
  const decoded = authCheck(req);
  if (!decoded || decoded.role !== 'admin') return res.status(403).json({ error: 'Admin required.' });

  try {
    const allLogs = await UsageLog.find().sort({ timestamp: -1 }).limit(500).lean();
    const totalAnalyses = allLogs.length;
    const totalRows = allLogs.reduce((sum, l) => sum + (l.rowsProcessed || 0), 0);
    const uniqueUsers = [...new Set(allLogs.map(l => l.userId))].length;

    const orgStats = {};
    allLogs.forEach(l => {
      if (!orgStats[l.orgId]) orgStats[l.orgId] = { analyses: 0, rows: 0 };
      orgStats[l.orgId].analyses++;
      orgStats[l.orgId].rows += l.rowsProcessed || 0;
    });

    const now = new Date();
    const dailyCounts = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dailyCounts[d.toISOString().split('T')[0]] = 0;
    }
    allLogs.forEach(l => {
      const key = new Date(l.timestamp).toISOString().split('T')[0];
      if (dailyCounts.hasOwnProperty(key)) dailyCounts[key]++;
    });

    res.json({
      totalAnalyses,
      totalRows,
      uniqueUsers,
      orgStats,
      dailyChart: Object.entries(dailyCounts).map(([date, count]) => ({ date, count })),
      recentLogs: allLogs.slice(0, 20)
    });
  } catch (err) {
    console.error('Admin stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch admin stats.' });
  }
});

module.exports = router;
