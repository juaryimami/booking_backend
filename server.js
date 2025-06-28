const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Flexible CORS configuration to support any host
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., mobile apps, curl, or localhost)
    if (!origin) return callback(null, true);
    // Allow all origins for now (can be restricted later with an environment variable)
    callback(null, true); // This allows any origin
  },
  methods: ['GET', 'POST', 'OPTIONS'], // Handle preflight requests
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Enable cookies if needed
  optionsSuccessStatus: 200, // For legacy browser support
}));

// Middleware
app.use(express.json({ limit: '10mb' })); // Increased limit for attachments
app.use(express.urlencoded({ extended: true }));

// Nodemailer configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Verify transporter connection
const verifyTransporter = async () => {
  try {
    await transporter.verify();
    console.log('Email server is ready');
  } catch (error) {
    console.error('Email configuration error:', error);
    setTimeout(verifyTransporter, 5000); // Retry after 5 seconds
  }
};

verifyTransporter();

// Email endpoint
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
      attachmentType,
    } = req.body;

    // Validate required fields
    if (!orderId || !callType || !startTime || !endTime || !duration || !userId || !price) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const sanitize = (str) => str.toString().replace(/<[^>]*>?/gm, '');
    const sanitizedOrderId = sanitize(orderId);

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
        filename: sanitize(attachmentName),
        content: Buffer.from(attachment, 'base64'), // Decode base64 attachment
        contentType: attachmentType || 'application/octet-stream',
      }];
    }

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);

    res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      emailId: info.messageId,
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? null : err.message,
  });
});

// Server startup
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
