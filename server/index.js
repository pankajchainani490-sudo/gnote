import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Route imports
import notesRouter from './routes/notes.js';
import tasksRouter from './routes/tasks.js';
import milestonesRouter from './routes/milestones.js';
import syncRouter from './routes/sync.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || 'your-random-secret-key-here';

// Security and utility middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow loading scripts/styles from other sources if needed
}));
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support larger sync payloads
app.use(morgan('dev'));

// API Key Authentication middleware
const authMiddleware = (req, res, next) => {
  const clientKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!clientKey || clientKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
  }
  next();
};

// Ping endpoint to test connection and API key validity
app.get('/api/ping', authMiddleware, (req, res) => {
  res.json({ status: 'ok', message: 'pong', time: new Date().toISOString() });
});

// Register authenticated API routes
app.use('/api/notes', authMiddleware, notesRouter);
app.use('/api/tasks', authMiddleware, tasksRouter);
app.use('/api/milestones', authMiddleware, milestonesRouter);
app.use('/api/sync', authMiddleware, syncRouter);

// Serve static frontend files (from the frontend build output copied into server/public)
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(publicPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NoteFlow Server running on http://0.0.0.0:${PORT}`);
  console.log(`API Auth Key required: ${API_KEY}`);
});
