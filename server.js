const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Middleware Configuration
app.use(cors({
  origin: 'https://hashimconsultancy.org',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json({ limit: '10mb' })); // Increased limit for file attachments

// Database Configuration
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'hashimconsultancy.org',
  user: process.env.DB_USER || 'hashimks_booking',
  port: process.env.DB_port || 3306,
  password: process.env.DB_PASSWORD || 'BKG@hashim2025',
  database: process.env.DB_DATABASE || 'hashimks_hashim_consulyancy',
});

// Database Connection
db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('Connected to MySQL database');
});

// Email Transporter Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'juharyimer7@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'qayz dhqy hkqw vbmw',
  },
});

// Verify Email Configuration
transporter.verify((error) => {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready');
  }
});

// Booking Endpoint with Email Attachment Support
app.post('/bookings', async (req, res) => {
  try {
    const {
      orderId,
      callType,
      startTime,
      endTime,
      duration,
      userId,
      userEmail,
      created,
      price,
      confirmed,
      orderStatus,
      rejectionReason,
      attachment,
      attachmentName,
      attachmentType
    } = req.body;

    // Validate required fields
    if (!orderId || !callType || !startTime || !endTime || !duration || !userId || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Database Insertion
    const query = `
      INSERT INTO bookings (
        order_id, call_type, start_time, end_time, duration, user_id, user_email,
        created, price, confirmed, order_status, rejection_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      orderId,
      callType,
      startTime,
      endTime,
      duration,
      userId,
      userEmail || null,
      created || new Date().toISOString(),
      price,
      confirmed || false,
      orderStatus || null,
      rejectionReason || null,
    ];

    const [result] = await db.promise().query(query, values);

    // Email Configuration
    const mailOptions = {
      from: `"Booking System" <${process.env.EMAIL_USER || 'juharyimer7@gmail.com'}>`,
      to: 'booking@hashimconsultancy.org',
      subject: `New Booking - Order #${orderId}`,
      html: `
        <h2>New Booking Details</h2>
        <table border="1" cellpadding="5" cellspacing="0">
          <tr><th>Order ID</th><td>${orderId}</td></tr>
          <tr><th>Call Type</th><td>${callType}</td></tr>
          <tr><th>Time Slot</th><td>${new Date(startTime).toLocaleString()} - ${new Date(endTime).toLocaleString()}</td></tr>
          <tr><th>Duration</th><td>${duration} minutes</td></tr>
          <tr><th>User ID</th><td>${userId}</td></tr>
          <tr><th>User Email</th><td>${userEmail || 'N/A'}</td></tr>
          <tr><th>Price</th><td>$${price.toFixed(2)}</td></tr>
          ${orderStatus ? `<tr><th>Status</th><td>${orderStatus}</td></tr>` : ''}
          ${rejectionReason ? `<tr><th>Rejection Reason</th><td>${rejectionReason}</td></tr>` : ''}
        </table>
      `,
    };

    // Add attachment if provided
    if (attachment && attachmentName) {
      mailOptions.attachments = [{
        filename: attachmentName,
        content: attachment,
        encoding: 'base64',
        contentType: attachmentType || 'application/octet-stream'
      }];
    }

    // Send Email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);

    res.status(201).json({
      success: true,
      message: 'Booking created and confirmation sent',
      bookingId: result.insertId
    });

  } catch (error) {
    console.error('Error processing booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process booking',
      error: error.message
    });
  }
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    database: db.state === 'connected' ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message
  });
});

// Server Startup
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});