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
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  // Dashboard stats
  app.get('/api/stats', (req, res) => {
    const db = getDB();

    const videoCount = db.prepare('SELECT COUNT(*) as total FROM videos').get().total;
    const liveCount = db.prepare('SELECT COUNT(*) as total FROM live_streams WHERE isLive = 1').get().total;
    const totalViews = db.prepare('SELECT COALESCE(SUM(views), 0) as total FROM videos').get().total;
    const totalStorage = db.prepare('SELECT COALESCE(SUM(filesize), 0) as total FROM videos').get().total;

    const recentVideos = db.prepare('SELECT * FROM videos ORDER BY createdAt DESC LIMIT 5').all();
    const recentStreams = db.prepare('SELECT * FROM live_streams ORDER BY createdAt DESC LIMIT 5').all();

    res.json({
      overview: {
        totalVideos: videoCount,
        liveStreams: liveCount,
        totalViews: totalViews,
        totalStorage: formatBytes(totalStorage)
      },
      recentVideos: recentVideos.map(v => ({
        id: v.id,
        title: v.title,
        views: v.views,
        thumbnail: v.thumbnail,
        createdAt: v.createdAt
      })),
      recentStreams: recentStreams,
      system: {
        memory: {
          used: `${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`,
          total: `${Math.round(os.totalmem() / 1024 / 1024)} MB`
        },
        uptime: process.uptime(),
        cpu: os.cpus()[0]?.model || 'Unknown'
      }
    });
  });

  // Analytics
  app.get('/api/analytics', (req, res) => {
    const db = getDB();
    const { videoId, period = '7d' } = req.query;

    if (videoId) {
      const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(videoId);
      if (!video) return res.status(404).json({ error: 'Video not found' });

      const events = db.prepare('SELECT * FROM analytics WHERE videoId = ? ORDER BY timestamp DESC LIMIT 100').all(videoId);
      const dailyViews = db.prepare(`
        SELECT DATE(timestamp / 1000, 'unixepoch') as date, COUNT(*) as views
        FROM analytics WHERE videoId = ? AND timestamp > ?
        GROUP BY date ORDER BY date
      `).all(videoId, Date.now() - 7 * 24 * 60 * 60 * 1000);

      return res.json({ videoId, totalViews: video.views, dailyViews, recentEvents: events });
    }

    // Global analytics
    const topVideos = db.prepare('SELECT id, title, views, thumbnail FROM videos ORDER BY views DESC LIMIT 10').all();
    const totalViews = db.prepare('SELECT COALESCE(SUM(views), 0) as total FROM videos').get().total;

    res.json({
      totalViews,
      topVideos: topVideos.map(v => ({ ...v, embedUrl: `/embed/${v.id}` }))
    });
  });

  // Search
  app.get('/api/search', (req, res) => {
    const db = getDB();
    const { q } = req.query;
    if (!q) return res.json({ videos: [] });

    const videos = db.prepare('SELECT * FROM videos WHERE title LIKE ? OR description LIKE ? ORDER BY views DESC LIMIT 20')
      .all(`%${q}%`, `%${q}%`);

    res.json({
      videos: videos.map(v => ({
        id: v.id,
        title: v.title,
        description: v.description,
        views: v.views,
        thumbnail: v.thumbnail,
        duration: v.duration,
        resolution: v.resolution,
        embedUrl: `/embed/${v.id}`
      }))
    });
  });

  // Server info
  app.get('/api/server', (req, res) => {
    const db = getDB();
    const videoCount = db.prepare('SELECT COUNT(*) as total FROM videos').get().total;
    const storageUsed = db.prepare('SELECT COALESCE(SUM(filesize), 0) as total FROM videos').get().total;

    const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'videos');
    let dirSize = storageUsed;
    try {
      const fs = require('fs');
      const files = fs.readdirSync(uploadDir);
      dirSize = files.reduce((acc, f) => {
        const stat = fs.statSync(path.join(uploadDir, f));
        return acc + stat.size;
      }, 0);
    } catch (e) {}

    res.json({
      name: 'Cloud Stream',
      version: '1.0.0',
      features: {
        videoUpload: true,
        liveStreaming: true,
        hlsStreaming: true,
        transcoding: true,
        embedPlayer: true,
        analytics: true,
        searchAndDiscovery: true,
        cdn: false
      },
      stats: {
        totalVideos: videoCount,
        storageUsed: formatBytes(dirSize),
        maxUploadSize: '5 GB'
      },
      endpoints: {
        upload: '/api/upload',
        videos: '/api/videos',
        live: '/api/live',
        search: '/api/search',
        embed: '/embed/{id}',
        stream: '/api/video/{id}/stream',
        hls: '/api/video/{id}/hls/master.m3u8'
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
