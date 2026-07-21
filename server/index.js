import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB } from './database.js';
import { setupUploadRoutes } from './routes/upload.js';
import { setupVideoRoutes } from './routes/video.js';
import { setupStreamRoutes } from './routes/stream.js';
import { setupLiveRoutes } from './routes/live.js';
import { setupAPIRoutes } from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Initialize database
initDB();

// Setup routes
setupUploadRoutes(app);
setupVideoRoutes(app);
setupStreamRoutes(app);
setupLiveRoutes(app);
setupAPIRoutes(app);

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
const server = createServer(app);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Cloud Stream Server running on port ${PORT}`);
  console.log(`📺 Dashboard: http://localhost:${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
});

export default app;
