const express = require('express');
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
app.use(express.json({ limit: '10mb' }));

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

// Email Sending Endpoint
app.post('/send-email', async (req, res) => {
  try {
    const {
      orderId,
      callType,
      startTime,
      endTime,
      duration,
      userId,
      userEmail,
      price,
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

    res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      emailId: info.messageId
    });

  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message
    });
  }
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
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