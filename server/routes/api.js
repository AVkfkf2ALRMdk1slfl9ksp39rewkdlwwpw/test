import express from 'express';
import { getDB } from '../database.js';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupAPIRoutes(app) {
  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      version: '2.0.0',
      platform: 'stream-hub',
      timestamp: new Date().toISOString()
    });
  });

  // Dashboard overview
  app.get('/api/dashboard', (req, res) => {
    const db = getDB();

    const liveCount = db.prepare('SELECT COUNT(*) as total FROM live_streams WHERE isLive = 1').get().total;
    const totalStreams = db.prepare('SELECT COUNT(*) as total FROM live_streams').get().total;
    const totalVideos = db.prepare('SELECT COUNT(*) as total FROM videos').get().total;
    const totalStorage = db.prepare('SELECT COALESCE(SUM(filesize), 0) as total FROM videos').get().total;
    const totalViewers = db.prepare('SELECT COALESCE(SUM(viewers), 0) as total FROM live_streams WHERE isLive = 1').get().total;

    const liveStreams = db.prepare('SELECT * FROM live_streams ORDER BY createdAt DESC LIMIT 10').all();
    const recentVideos = db.prepare('SELECT * FROM videos ORDER BY createdAt DESC LIMIT 5').all();

    const memory = process.memoryUsage();
    const cpuUsage = os.loadavg();

    res.json({
      overview: {
        liveStreams: liveCount,
        totalStreams,
        totalVideos,
        totalStorage: formatBytes(totalStorage),
        totalViewers,
        uptime: process.uptime(),
        cpu: cpuUsage[0],
        memoryUsed: formatBytes(memory.heapUsed),
        memoryTotal: formatBytes(memory.heapTotal)
      },
      liveStreams: liveStreams.map(s => ({
        id: s.id, name: s.name, isLive: !!s.isLive,
        viewers: s.viewers, bitrate: s.bitrate,
        resolution: s.resolution, status: s.status
      })),
      recentVideos: recentVideos.map(v => ({
        id: v.id, title: v.title, views: v.views,
        resolution: v.resolution, duration: v.duration,
        thumbnail: v.thumbnail
      })),
      system: {
        os: os.platform(),
        arch: os.arch(),
        cpuModel: os.cpus()[0]?.model || 'Unknown',
        totalMemory: formatBytes(os.totalmem()),
        freeMemory: formatBytes(os.freemem()),
        nodeVersion: process.version
      }
    });
  });

  // Global stats
  app.get('/api/stats', (req, res) => {
    const db = getDB();
    const videoCount = db.prepare('SELECT COUNT(*) as total FROM videos').get().total;
    const liveCount = db.prepare('SELECT COUNT(*) as total FROM live_streams WHERE isLive = 1').get().total;
    const totalViews = db.prepare('SELECT COALESCE(SUM(views), 0) as total FROM videos').get().total;
    const totalStorage = db.prepare('SELECT COALESCE(SUM(filesize), 0) as total FROM videos').get().total;

    res.json({
      totalVideos: videoCount,
      liveStreams: liveCount,
      totalViews,
      totalStorage: formatBytes(totalStorage),
      uptime: process.uptime(),
      version: '2.0.0'
    });
  });

  // Settings
  app.get('/api/settings', (req, res) => {
    const db = getDB();
    const settings = db.prepare('SELECT * FROM settings').all();
    const result = {};
    for (const s of settings) result[s.key] = s.value;
    res.json({ settings: result });
  });

  app.put('/api/settings', (req, res) => {
    const db = getDB();
    const { key, value } = req.body;
    if (key && value !== undefined) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
    }
    res.json({ success: true });
  });

  // Search
  app.get('/api/search', (req, res) => {
    const db = getDB();
    const { q, type = 'all' } = req.query;
    if (!q) return res.json({ results: [] });

    const results = [];
    if (type === 'all' || type === 'streams') {
      const streams = db.prepare('SELECT id, name, status, isLive FROM live_streams WHERE name LIKE ?')
        .all(`%${q}%`);
      results.push(...streams.map(s => ({ type: 'stream', ...s })));
    }
    if (type === 'all' || type === 'videos') {
      const videos = db.prepare('SELECT id, title, views, thumbnail FROM videos WHERE title LIKE ?')
        .all(`%${q}%`);
      results.push(...videos.map(v => ({ type: 'video', ...v })));
    }

    res.json({ results, query: q });
  });

  // API info
  app.get('/api/info', (req, res) => {
    res.json({
      name: 'Stream Hub',
      version: '2.0.0',
      description: 'Professional RTMP Streaming & Multi-Platform Restreaming Platform',
      features: [
        'RTMP Server with Auto-HLS',
        'Multi-Platform Restreaming (YouTube, Twitch, Facebook, Custom)',
        'VOD Upload & Management',
        'Auto Thumbnail Generation',
        'Adaptive Bitrate HLS Streaming',
        'Live Recording',
        'Real-time Analytics',
        'Chat Support',
        'Embed Player',
        'REST API'
      ],
      endpoints: {
        streams: 'GET/POST /api/streams',
        upload: 'POST /api/upload',
        videos: 'GET /api/videos',
        search: 'GET /api/search?q=query',
        dashboard: 'GET /api/dashboard',
        health: 'GET /api/health',
        settings: 'GET/PUT /api/settings'
      }
    });
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
