require('dotenv').config();
console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS:", process.env.EMAIL_PASS);

const express = require('express');
const app = express(); // <- define app here first
const cors = require('cors');

// Enable CORS for frontend
app.use(cors({
  origin: 'https://kyroscareerguidanceweb.onrender.com',
  credentials: true
}));

// Enable JSON parsing
app.use(express.json());

const mongoose = require('mongoose');

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');

const User = require('./models/User');
const Assessment = require('./models/Assessment');
const Booking = require('./models/Booking');

const PORT = process.env.PORT || 5000;


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/test-api', (req, res) => {
    res.json({ message: 'API is working' });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://Mohan:20082001Tinku@cluster0.hwxjzfe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// File upload setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// Authentication middleware to verify JWT token
const authenticate = async(req, res, next) => {
    try {
        // Check for Authorization header
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }

        // Extract the token from the header
        const token = authHeader.replace('Bearer ', '');

        // If no token is found
        if (!token) {
            return res.status(401).json({ message: 'Token missing, authorization denied' });
        }

        // Verify the token with the JWT_SECRET
        const decoded = jwt.verify(token, JWT_SECRET);

        // Attach user data (from token) to the request object for future access in other routes
        req.user = decoded;

        // Proceed to the next middleware or route handler
        next();
    } catch (err) {
        console.error('Authentication error:', err);
        // If token is invalid or expired
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// User registration
app.post('/api/register', async(req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = new User({
            name,
            email,
            password: hashedPassword
        });

        await user.save();

        // Generate token
        const token = jwt.sign({ id: user._id, email: user.email },
            JWT_SECRET, { expiresIn: '7d' }
        );

        res.status(201).json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// User login
app.post('/api/login', async(req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Book session route (requires authentication)
app.post('/api/book-session', authenticate, async(req, res) => {
    const { userName, userEmail, phone, date, time, topic, notes } = req.body;
    const userId = req.user.id; // Extracted from JWT token

    try {
        const newBooking = new Booking({
            userId,
            userName,
            userEmail,
            phone,
            date,
            time,
            topic,
            notes
        });

        await newBooking.save();

        // Admin email
        const adminMailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: 'New Session Booking',
            html: `
                <h3>New Career Session Booking</h3>
                <p><strong>Name:</strong> ${userName}</p>
                <p><strong>Email:</strong> ${userEmail}</p>
                <p><strong>Phone:</strong> ${phone}</p>
                <p><strong>Date:</strong> ${date}</p>
                <p><strong>Time:</strong> ${time}</p>
                <p><strong>Topic:</strong> ${topic}</p>
                <p><strong>Notes:</strong> ${notes}</p>
            `
        };

        // User confirmation email
        const userMailOptions = {
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: 'Kyros - Your Session is Booked!',
            html: `
                <h2>Hi ${userName},</h2>
                <p>Thank you for booking a career coaching session with Kyros.</p>
                <ul>
                    <li><strong>Date:</strong> ${date}</li>
                    <li><strong>Time:</strong> ${time}</li>
                    <li><strong>Topic:</strong> ${topic}</li>
                    <li><strong>Notes:</strong> ${notes || 'None'}</li>
                </ul>
                <p>Warm regards,<br>Kyros Team</p>
            `
        };

        // Send admin and user confirmation emails
        await transporter.sendMail(adminMailOptions);
        await transporter.sendMail(userMailOptions);

        res.status(201).json({ message: 'Booking confirmed, emails sent!' });
    } catch (error) {
        console.error('Booking error:', error);
        res.status(500).json({ message: 'Booking failed', error: error.message });
    }
});

// Save career assessment
app.post('/api/assessments', authenticate, async(req, res) => {
    try {
        const assessment = new Assessment({
            userId: req.user.id,
            answers: req.body.answers,
            results: req.body.results
        });

        await assessment.save();
        res.status(201).json(assessment);
    } catch (err) {
        console.error("Career Error:", err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get user assessments
app.get('/api/assessments', authenticate, async(req, res) => {
    try {
        const assessments = await Assessment.find({ userId: req.user.id });
        res.json(assessments);
    } catch (err) {
        console.error("Assessment Error:", err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    res.json({
        message: 'File uploaded successfully',
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`
    });
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
