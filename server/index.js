import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB } from './database.js';
import { initRTMPServer } from './rtmp-server.js';
import { setupAuthRoutes } from './routes/auth.js';
import { setupStreamRoutes } from './routes/streams.js';
import { setupUploadRoutes } from './routes/upload.js';
import { setupAPIRoutes } from './routes/api.js';
import { setupDashboardRoutes } from './routes/dashboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const RTMP_PORT = process.env.RTMP_PORT || 1935;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// Initialize
initDB();
initRTMPServer(RTMP_PORT);

// Routes
setupAuthRoutes(app);
setupStreamRoutes(app);
setupUploadRoutes(app);
setupAPIRoutes(app);
setupDashboardRoutes(app);

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/hls/') && !req.path.startsWith('/rtmp/') && !req.path.startsWith('/uploads/')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

// Start HTTP server
app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('  🚀 Stream Hub - RTMP Platform v2.0');
  console.log('========================================');
  console.log(`  📺 Dashboard:  http://0.0.0.0:${PORT}`);
  console.log(`  📡 RTMP:       rtmp://0.0.0.0:${RTMP_PORT}/live`);
  console.log(`  📊 HLS:        http://0.0.0.0:${PORT}/hls/`);
  console.log(`  🔑 API:        http://0.0.0.0:${PORT}/api`);
  console.log('========================================');
});

export default app;
