import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB } from './database.js';
import { setupAuthRoutes } from './routes/auth.js';
import { setupPanelRoutes } from './routes/panel.js';
import { setupStreamRoutes } from './routes/streams.js';
import { setupUserRoutes } from './routes/users.js';
import { setupAPICredentialsRoutes } from './routes/api-credentials.js';
import { setupServerRoutes } from './routes/servers.js';
import { setupXtreamRoutes } from './routes/xtream.js';
import { setupDashboardRoutes } from './routes/dashboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// Initialize database
initDB();

// API Routes
setupAuthRoutes(app);
setupPanelRoutes(app);
setupStreamRoutes(app);
setupUserRoutes(app);
setupAPICredentialsRoutes(app);
setupServerRoutes(app);

// Xtream Codes API (for IPTV clients)
setupXtreamRoutes(app);

// Dashboard routes (embed pages)
setupDashboardRoutes(app);

// SPA fallback
app.get('*', (req, res) => {
  const ext = path.extname(req.path);
  if (!ext && !req.path.startsWith('/api/') && !req.path.startsWith('/get/') && !req.path.startsWith('/player_api.php') && !req.path.startsWith('/xmltv.php') && !req.path.startsWith('/hls/') && !req.path.startsWith('/uploads/')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('  📺 Xtream UI - IPTV Panel v1.0');
  console.log('========================================');
  console.log(`  🌐 Panel:     http://0.0.0.0:${PORT}`);
  console.log(`  📡 Xtream API: http://0.0.0.0:${PORT}/player_api.php`);
  console.log(`  📋 XMLTV:      http://0.0.0.0:${PORT}/xmltv.php`);
  console.log('========================================');
});

export default app;
