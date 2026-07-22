import express from 'express';
import { getDB } from '../database.js';

export function setupDashboardRoutes(app) {
  // Embed live stream
  app.get('/embed/:id', (req, res) => {
    const db = getDB();
    const stream = db.prepare('SELECT * FROM live_streams WHERE id = ?').get(req.params.id);
    if (!stream) return res.status(404).send('<h1>Stream not found</h1>');

    res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${stream.name} - LIVE</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0f;display:flex;align-items:center;justify-content:center;height:100vh}
.player{width:100%;max-width:1280px}.live-badge{position:fixed;top:16px;left:16px;background:#ef4444;color:#fff;padding:4px 12px;border-radius:4px;font-weight:700;font-size:13px;display:flex;align-items:center;gap:6px;z-index:10}
.dot{width:8px;height:8px;background:#fff;border-radius:50%;animation:pulse 1.5s infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
video{width:100%;border-radius:8px;outline:none}</style></head>
<body>
${stream.isLive ? '<div class="live-badge"><span class="dot"></span>LIVE</div>' : ''}
<div class="player"><video src="/hls/live/${stream.streamKey}/index.m3u8" controls autoplay playsinline></video></div>
</body></html>`);
  });

  // Embed VOD video
  app.get('/embed/vod/:id', (req, res) => {
    const db = getDB();
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
    if (!video) return res.status(404).send('<h1>Video not found</h1>');

    res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${video.title}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0f;display:flex;align-items:center;justify-content:center;height:100vh}
video{width:100%;max-width:1280px;border-radius:8px;outline:none}</style></head>
<body><video src="/uploads/videos/${video.filename}" controls autoplay></video></body></html>`);
  });
}
