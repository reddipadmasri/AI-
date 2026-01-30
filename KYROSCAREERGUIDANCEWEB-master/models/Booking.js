const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: String,
    userEmail: String,
    date: String,
    time: String,
    topic: String,
    notes: String
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);