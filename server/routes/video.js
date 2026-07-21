import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDB } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const videoDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'videos');

export function setupVideoRoutes(app) {
  // List all videos
  app.get('/api/videos', (req, res) => {
    const db = getDB();
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    if (search) {
      const stmt = db.prepare(`SELECT * FROM videos WHERE title LIKE ? ORDER BY createdAt DESC LIMIT ? OFFSET ?`);
      const videos = stmt.all(`%${search}%`, parseInt(limit), parseInt(offset));
      const count = db.prepare(`SELECT COUNT(*) as total FROM videos WHERE title LIKE ?`).get(`%${search}%`).total;
      return res.json({ videos, pagination: { page: parseInt(page), limit: parseInt(limit), total: count, pages: Math.ceil(count / limit) } });
    }

    const stmt = db.prepare(`SELECT * FROM videos ORDER BY createdAt DESC LIMIT ? OFFSET ?`);
    const videos = stmt.all(parseInt(limit), parseInt(offset));
    const count = db.prepare('SELECT COUNT(*) as total FROM videos').get().total;

    res.json({
      videos: videos.map(v => ({ ...v, uploadUrl: `/uploads/videos/${v.filename}`, streamUrl: `/api/video/${v.id}/stream`, embedUrl: `/embed/${v.id}` })),
      pagination: { page: parseInt(page), limit: parseInt(limit), total: count, pages: Math.ceil(count / limit) }
    });
  });

  // Get video by ID
  app.get('/api/video/:id', (req, res) => {
    const db = getDB();
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    // Increment views
    db.prepare('UPDATE videos SET views = views + 1 WHERE id = ?').run(req.params.id);

    res.json({
      ...video,
      uploadUrl: `/uploads/videos/${video.filename}`,
      streamUrl: `/api/video/${video.id}/stream`,
      embedUrl: `/embed/${video.id}`
    });
  });

  // Stream video (range requests support)
  app.get('/api/video/:id/stream', (req, res) => {
    const db = getDB();
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const videoPath = path.join(videoDir, video.filename);
    const stat = require('fs').statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = require('fs').createReadStream(videoPath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      });
      require('fs').createReadStream(videoPath).pipe(res);
    }
  });

  // Delete video
  app.delete('/api/video/:id', (req, res) => {
    const db = getDB();
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    // Delete file
    const fs = require('fs');
    const videoPath = path.join(videoDir, video.filename);
    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
    if (video.thumbnail) {
      const thumbPath = path.join(__dirname, '..', '..', 'public', video.thumbnail);
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    }

    db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Embed page
  app.get('/embed/:id', (req, res) => {
    const db = getDB();
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
    if (!video) return res.status(404).send('Video not found');

    res.send(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${video.title}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;display:flex;align-items:center;justify-content:center;height:100vh}video{width:100%;max-width:1280px}</style></head>
<body>
<video src="/api/video/${video.id}/stream" controls autoplay></video>
</body></html>`);
  });
}
