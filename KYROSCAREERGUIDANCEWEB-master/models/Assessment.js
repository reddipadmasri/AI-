const mongoose = require('mongoose');

const AssessmentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    answers: [String],
    results: mongoose.Schema.Types.Mixed
});

module.exports = mongoose.model('Assessment', AssessmentSchema);