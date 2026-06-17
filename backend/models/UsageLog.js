const mongoose = require('mongoose');

const usageLogSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    orgId: { type: String, default: 'org_default' },
    action: { type: String, default: 'analysis' },
    filename: { type: String, default: 'unknown' },
    rowsProcessed: { type: Number, default: 0 },
    columnsProcessed: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UsageLog', usageLogSchema);
