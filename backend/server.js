const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const swaggerUi = require('swagger-ui-express');

dotenv.config();

const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const notificationRoutes = require('./src/routes/notifications');
const teamRoutes = require('./src/routes/teams');
const errorHandler = require('./src/middleware/errorHandler');
const rateLimiter = require('./src/middleware/rateLimiter');
const socketHandler = require('./src/socket/socketHandler');
const swaggerSpec = require('./src/config/swagger');

const app = express();
const server = http.createServer(app);

const corsOrigin = process.env.NODE_ENV === 'production'
  ? process.env.FRONTEND_URL
  : true;

const io = socketIo(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  socketHandler(io, socket);
});

app.use(helmet());
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

app.get('/api-docs.json', (req, res) => {
  res.json(swaggerSpec);
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customSiteTitle: 'IT Team Notification API'
}));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/teams', teamRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API documentation: http://localhost:${PORT}/api-docs`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

module.exports = app;
