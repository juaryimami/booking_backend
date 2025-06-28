const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Enhanced CORS configuration for production
const allowedOrigins = [
  'https://hashimconsultancy.org',
  // Add other allowed origins if needed
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Enhanced security middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Production settings
const isProduction = process.env.NODE_ENV === 'production';

// Configure transporter with failover options
const transporter = nodemailer.createTransport({
  service: 'gmail',
  pool: true,
  maxConnections: isProduction ? 5 : 1,
  maxMessages: isProduction ? 100 : Infinity,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: isProduction // Only in production
  }
});

// Enhanced email verification with retry logic
const verifyTransporter = async () => {
  try {
    await transporter.verify();
    console.log('Email server is ready');
  } catch (error) {
    console.error('Email configuration error:', error);
    // Retry after 5 seconds
    setTimeout(verifyTransporter, 5000);
  }
};

verifyTransporter();

// Rate limiting middleware (important for production)
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 1000, // Limit each IP to 100 requests per windowMs in production
  message: 'Too many requests from this IP, please try again later'
});

app.use('/send-email', limiter);

// Enhanced email endpoint with input sanitization
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
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields' 
      });
    }

    // Basic input sanitization
    const sanitize = (str) => str.toString().replace(/<[^>]*>?/gm, '');
    const sanitizedOrderId = sanitize(orderId);

    // Email configuration with improved HTML template
    const mailOptions = {
      from: `"Booking System" <${process.env.EMAIL_USER}>`,
      to: 'booking@hashimconsultancy.org',
      replyTo: userEmail || process.env.EMAIL_USER,
      subject: `New Booking - Order #${sanitizedOrderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">New Booking Details</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Order ID</th>
              <td style="padding: 10px; border: 1px solid #ddd;">${sanitizedOrderId}</td>
            </tr>
            <!-- Other table rows with similar styling -->
          </table>
        </div>
      `,
      attachments: []
    };

    // Add attachment if provided
    if (attachment && attachmentName) {
      if (attachment.length > 5 * 1024 * 1024) { // 5MB limit
        return res.status(400).json({ 
          success: false,
          error: 'Attachment too large (max 5MB)' 
        });
      }
      
      mailOptions.attachments.push({
        filename: sanitize(attachmentName),
        content: attachment,
        encoding: 'base64',
        contentType: attachmentType || 'application/octet-stream'
      });
    }

    // Send email with timeout
    const emailPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email sending timeout')), 30000)
    );

    const info = await Promise.race([emailPromise, timeoutPromise]);
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
      error: isProduction ? 'Internal server error' : error.message
    });
  }
});

// Enhanced health check endpoint
app.get('/health', (req, res) => {
  const healthcheck = {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    memoryUsage: process.memoryUsage()
  };
  res.status(200).json(healthcheck);
});

// Improved error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: isProduction ? null : err.message,
    stack: isProduction ? null : err.stack
  });
});

// Server startup with graceful shutdown
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});