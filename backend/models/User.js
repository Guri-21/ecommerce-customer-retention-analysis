const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    company:  { type: String, default: '' },
    role:     { type: String, enum: ['user', 'admin'], default: 'user' },
    orgId:    { type: String, default: 'org_default' },
    // Subscription / plan
    plan:                  { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
    monthlyAnalysisCount:  { type: Number, default: 0 },
    monthlyAnalysisReset:  { type: Date,   default: Date.now },
    dailyChatCount:        { type: Number, default: 0 },
    dailyChatReset:        { type: Date,   default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 12);
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
