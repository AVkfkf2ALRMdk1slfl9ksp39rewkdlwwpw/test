import express from 'express';
import { exec, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDB } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const videoDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'videos');

export function setupStreamRoutes(app) {
  // HLS Streaming endpoint
  app.get('/api/video/:id/hls/master.m3u8', (req, res) => {
    const db = getDB();
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const videoPath = path.join(videoDir, video.filename);
    const hlsDir = path.join(videoDir, 'hls', video.id);

    // Check if HLS already generated
    const fs = require('fs');
    const masterPlaylist = path.join(hlsDir, 'master.m3u8');

    if (fs.existsSync(masterPlaylist)) {
      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      return res.sendFile(masterPlaylist);
    }

    // Generate HLS on the fly
    try {
      fs.mkdirSync(hlsDir, { recursive: true });
      execSync = require('child_process').execSync;
      execSync(`ffmpeg -i "${videoPath}" -codec:v libx264 -codec:a aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${hlsDir}/segment_%03d.ts" "${hlsDir}/master.m3u8" 2>/dev/null`);

      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      return res.sendFile(masterPlaylist);
    } catch (e) {
      console.log('HLS generation failed:', e.message);
      res.status(500).json({ error: 'HLS generation failed' });
    }
  });

  // HLS segment delivery
  app.get('/api/video/:id/hls/*', (req, res) => {
    const db = getDB();
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const hlsDir = path.join(videoDir, 'hls', video.id);
    const segmentPath = path.join(hlsDir, req.params[0]);

    const fs = require('fs');
    if (fs.existsSync(segmentPath)) {
      const ext = path.extname(segmentPath);
      const contentType = ext === '.m3u8' ? 'application/vnd.apple.mpegurl' : 'video/mp2t';
      res.set('Content-Type', contentType);
      return res.sendFile(segmentPath);
    }

    res.status(404).json({ error: 'Segment not found' });
  });

  // Video info for player
  app.get('/api/video/:id/info', (req, res) => {
    const db = getDB();
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    res.json({
      id: video.id,
      title: video.title,
      duration: video.duration,
      resolution: video.resolution,
      bitrate: video.bitrate,
      thumbnail: video.thumbnail,
      formats: {
        mp4: `/api/video/${video.id}/stream`,
        hls: `/api/video/${video.id}/hls/master.m3u8`
      }
    });
  });
}
