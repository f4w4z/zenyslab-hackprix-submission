/**
 * Echo – Decision Blind Spot Detector
 * Express API server — connects to MongoDB Atlas via URI and exposes a REST API
 * for the Expo mobile app to consume (no native driver needed on the client).
 *
 * Usage:
 *   cd server
 *   npm install
 *   npm run dev      # development (node --watch)
 *   npm start        # production
 *
 * Required env variable (root .env or server/.env):
 *   MONGODB_URI=mongodb+srv://...
 *
 * Optional:
 *   PORT=3000
 *   MONGODB_DATABASE=echo
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const { MongoClient } = require('mongodb');

const simulationsRouter = require('./routes/simulations');
const solanaRouter = require('./routes/solana');
const proxyRouter = require('./routes/proxy');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = process.env.PORT ?? 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DATABASE ?? 'echo';

if (!MONGODB_URI) {
  console.error(
    '\n[Echo API] [ERROR] MONGODB_URI is not set.\n' +
    '  Make sure your root .env contains MONGODB_URI=mongodb+srv://...\n'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();

// Security headers
app.use(helmet());

// Rate limiting: max 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Restrict CORS to localhost in dev
app.use(cors({
  origin: ['http://localhost:8081', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '1mb' }));

// Prevent NoSQL injection
app.use(mongoSanitize());

// Health check — useful for verifying the server is alive from the Expo app
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', database: DB_NAME });
});

// Mount routes
app.use('/api/simulations', simulationsRouter);
app.use('/api/solana', solanaRouter);
app.use('/api/proxy', proxyRouter);

// ---------------------------------------------------------------------------
// MongoDB connection + server boot
// ---------------------------------------------------------------------------
async function main() {
  console.log('[Echo API] Connecting to MongoDB…');

  const client = new MongoClient(MONGODB_URI, {
    // These settings prevent connection issues on free-tier Atlas clusters
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  });

  await client.connect();

  const db = client.db(DB_NAME);

  // Make the db instance available to all route handlers via req.app.locals
  app.locals.db = db;

  console.log(`[Echo API] [SUCCESS] Connected to MongoDB database "${DB_NAME}"`);

  app.listen(PORT, () => {
    console.log(`[Echo API] Server running at http://localhost:${PORT}`);
    console.log(`[Echo API]     GET    http://localhost:${PORT}/api/simulations`);
    console.log(`[Echo API]     POST   http://localhost:${PORT}/api/simulations`);
    console.log(`[Echo API]     DELETE http://localhost:${PORT}/api/simulations/:id`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n[Echo API] ${signal} received — closing MongoDB connection…`);
    await client.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[Echo API] [ERROR] Failed to start:', err.message);
  process.exit(1);
});
