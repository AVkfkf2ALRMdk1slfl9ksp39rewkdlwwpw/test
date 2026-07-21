import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../database.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec, spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const liveDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'live');

// Active live streams (in-memory)
const activeStreams = new Map();

export function setupLiveRoutes(app) {
  // Create new live stream
  app.post('/api/live', (req, res) => {
    const db = getDB();
    const id = uuidv4();
    const streamKey = uuidv4().replace(/-/g, '');
    const { title, description } = req.body;

    db.prepare(`
      INSERT INTO live_streams (id, title, description, streamKey)
      VALUES (?, ?, ?, ?)
    `).run(id, title || 'Live Stream', description || '', streamKey);

    res.json({
      success: true,
      stream: {
        id,
        title: title || 'Live Stream',
        description: description || '',
        streamKey,
        rtmpUrl: `rtmp://localhost/live/${streamKey}`,
        hlsUrl: `/api/live/${id}/stream.m3u8`,
        embedUrl: `/embed/live/${id}`
      }
    });
  });

  // Get all live streams
  app.get('/api/live', (req, res) => {
    const db = getDB();
    const streams = db.prepare('SELECT * FROM live_streams ORDER BY createdAt DESC').all();
    res.json({
      streams: streams.map(s => ({
        ...s,
        isLive: activeStreams.has(s.id),
        hlsUrl: `/api/live/${s.id}/stream.m3u8`,
        embedUrl: `/embed/live/${s.id}`
      }))
    });
  });

  // Get live stream details
  app.get('/api/live/:id', (req, res) => {
    const db = getDB();
    const stream = db.prepare('SELECT * FROM live_streams WHERE id = ?').get(req.params.id);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    res.json({
      ...stream,
      isLive: activeStreams.has(stream.id),
      viewers: activeStreams.get(stream.id)?.viewers || 0,
      hlsUrl: `/api/live/${stream.id}/stream.m3u8`,
      embedUrl: `/embed/live/${stream.id}`
    });
  });

  // Start streaming (RTMP ingest)
  app.post('/api/live/:id/start', (req, res) => {
    const db = getDB();
    const stream = db.prepare('SELECT * FROM live_streams WHERE id = ?').get(req.params.id);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    // In a real deployment, we'd start an RTMP server (nginx-rtmp or mediassrtp)
    // For Railway, we simulate HLS output
    const hlsDir = path.join(liveDir, stream.id);
    const fs = require('fs');
    fs.mkdirSync(hlsDir, { recursive: true });

    // Create a basic master playlist
    const masterPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720,CODECS="avc1.64001f,mp4a.40.2"
stream_720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=854x480,CODECS="avc1.64001f,mp4a.40.2"
stream_480p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=700000,RESOLUTION=640x360,CODECS="avc1.64001f,mp4a.40.2"
stream_360p.m3u8`;

    fs.writeFileSync(path.join(hlsDir, 'master.m3u8'), masterPlaylist);

    activeStreams.set(stream.id, {
      viewers: 0,
      startedAt: Date.now(),
      bitrate: 0,
      fps: 30
    });

    db.prepare('UPDATE live_streams SET isLive = 1 WHERE id = ?').run(stream.id);

    res.json({
      success: true,
      message: 'Live stream started',
      stream: {
        id: stream.id,
        isLive: true,
        viewers: 0,
        hlsUrl: `/api/live/${stream.id}/stream.m3u8`
      }
    });
  });

  // Stop streaming
  app.post('/api/live/:id/stop', (req, res) => {
    const db = getDB();
    const stream = db.prepare('SELECT * FROM live_streams WHERE id = ?').get(req.params.id);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    activeStreams.delete(stream.id);
    db.prepare('UPDATE live_streams SET isLive = 0, endedAt = ? WHERE id = ?').run(Date.now(), stream.id);

    res.json({ success: true, message: 'Live stream stopped' });
  });

  // Live stream HLS
  app.get('/api/live/:id/stream.m3u8', (req, res) => {
    const db = getDB();
    const stream = db.prepare('SELECT * FROM live_streams WHERE id = ?').get(req.params.id);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    const hlsDir = path.join(liveDir, stream.id);
    const masterPath = path.join(hlsDir, 'master.m3u8');
    const fs = require('fs');

    if (!fs.existsSync(masterPath)) {
      return res.status(404).json({ error: 'Stream not active' });
    }

    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.set('Cache-Control', 'no-cache');
    return res.sendFile(masterPath);
  });

  // Live stream embed
  app.get('/embed/live/:id', (req, res) => {
    const db = getDB();
    const stream = db.prepare('SELECT * FROM live_streams WHERE id = ?').get(req.params.id);
    if (!stream) return res.status(404).send('Stream not found');

    res.send(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${stream.title} - LIVE</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;display:flex;align-items:center;justify-content:center;height:100vh}
.live-badge{position:fixed;top:20px;left:20px;background:#e53e3e;color:#fff;padding:6px 12px;border-radius:4px;font-weight:bold;z-index:10}
video{width:100%;max-width:1280px}</style></head>
<body>
<div class="live-badge">● LIVE</div>
<video src="/api/live/${stream.id}/stream.m3u8" controls autoplay></video>
</body></html>`);
  });

  // Delete live stream
  app.delete('/api/live/:id', (req, res) => {
    const db = getDB();
    activeStreams.delete(req.params.id);
    db.prepare('DELETE FROM live_streams WHERE id = ?').run(req.params.id);

    // Clean up files
    const fs = require('fs');
    const hlsDir = path.join(liveDir, req.params.id);
    if (fs.existsSync(hlsDir)) fs.rmSync(hlsDir, { recursive: true });

    res.json({ success: true });
  });
}
