import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../database.js';

export function setupStreamRoutes(app) {
  // Create new stream
  app.post('/api/streams', (req, res) => {
    const db = getDB();
    const id = uuidv4();
    const streamKey = uuidv4().replace(/-/g, '').substring(0, 32);
    const { name, description, chatEnabled = true, recordEnabled = false, restreamTargets = [] } = req.body;

    const streamName = `stream-${id.substring(0, 8)}`;

    db.prepare(`
      INSERT INTO live_streams (id, name, description, streamKey, rtmpUrl, hlsUrl, chatEnabled, recordEnabled, restreamTargets)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name || 'New Stream', description || '', streamKey,
      `rtmp://localhost:1935/live/${streamKey}`,
      `/hls/live/${streamKey}/index.m3u8`,
      chatEnabled ? 1 : 0,
      recordEnabled ? 1 : 0,
      JSON.stringify(restreamTargets)
    );

    // Add restream targets
    for (const target of restreamTargets) {
      db.prepare(`
        INSERT INTO restream_targets (id, streamId, platform, name, rtmpUrl, streamKey)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), id, target.platform, target.name, target.rtmpUrl, target.streamKey);
    }

    res.json({
      success: true,
      stream: {
        id,
        name: name || 'New Stream',
        description: description || '',
        streamKey,
        streamName,
        rtmpUrl: `rtmp://localhost:1935/live/${streamKey}`,
        rtmpUrlExternal: `rtmp://0.0.0.0:1935/live/${streamKey}`,
        hlsUrl: `/hls/live/${streamKey}/index.m3u8`,
        embedUrl: `/embed/${id}`,
        chatEnabled: !!chatEnabled,
        recordEnabled: !!recordEnabled,
        status: 'offline'
      }
    });
  });

  // Get all streams
  app.get('/api/streams', (req, res) => {
    const db = getDB();
    const streams = db.prepare('SELECT * FROM live_streams ORDER BY createdAt DESC').all();

    res.json({
      streams: streams.map(s => ({
        ...s,
        restreamTargets: JSON.parse(s.restreamTargets || '[]'),
        embedUrl: `/embed/${s.id}`,
        playUrl: `/hls/live/${s.streamKey}/index.m3u8`
      }))
    });
  });

  // Get single stream
  app.get('/api/streams/:id', (req, res) => {
    const db = getDB();
    const stream = db.prepare('SELECT * FROM live_streams WHERE id = ?').get(req.params.id);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    const targets = db.prepare('SELECT * FROM restream_targets WHERE streamId = ?').all(req.params.id);

    res.json({
      ...stream,
      restreamTargets: targets,
      embedUrl: `/embed/${stream.id}`,
      playUrl: `/hls/live/${stream.streamKey}/index.m3u8`
    });
  });

  // Update stream
  app.put('/api/streams/:id', (req, res) => {
    const db = getDB();
    const stream = db.prepare('SELECT * FROM live_streams WHERE id = ?').get(req.params.id);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    const { name, description, chatEnabled, recordEnabled } = req.body;
    db.prepare(`
      UPDATE live_streams SET name = ?, description = ?, chatEnabled = ?, recordEnabled = ?
      WHERE id = ?
    `).run(
      name || stream.name,
      description !== undefined ? description : stream.description,
      chatEnabled !== undefined ? (chatEnabled ? 1 : 0) : stream.chatEnabled,
      recordEnabled !== undefined ? (recordEnabled ? 1 : 0) : stream.recordEnabled,
      req.params.id
    );

    res.json({ success: true });
  });

  // Delete stream
  app.delete('/api/streams/:id', (req, res) => {
    const db = getDB();
    db.prepare('DELETE FROM restream_targets WHERE streamId = ?').run(req.params.id);
    db.prepare('DELETE FROM live_streams WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Force stop stream
  app.post('/api/streams/:id/stop', (req, res) => {
    const db = getDB();
    const stream = db.prepare('SELECT * FROM live_streams WHERE id = ?').get(req.params.id);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    db.prepare('UPDATE live_streams SET isLive = 0, status = ? WHERE id = ?')
      .run('offline', req.params.id);

    res.json({ success: true, message: 'Stream stopped' });
  });

  // Add restream target
  app.post('/api/streams/:id/targets', (req, res) => {
    const db = getDB();
    const stream = db.prepare('SELECT id FROM live_streams WHERE id = ?').get(req.params.id);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    const { platform, name, rtmpUrl, streamKey } = req.body;
    const targetId = uuidv4();

    db.prepare(`
      INSERT INTO restream_targets (id, streamId, platform, name, rtmpUrl, streamKey)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(targetId, req.params.id, platform, name, rtmpUrl, streamKey);

    res.json({ success: true, target: { id: targetId, platform, name, rtmpUrl } });
  });

  // Remove restream target
  app.delete('/api/streams/:id/targets/:targetId', (req, res) => {
    const db = getDB();
    db.prepare('DELETE FROM restream_targets WHERE id = ? AND streamId = ?')
      .run(req.params.targetId, req.params.id);
    res.json({ success: true });
  });

  // Get stream stats
  app.get('/api/streams/:id/stats', (req, res) => {
    const db = getDB();
    const stream = db.prepare('SELECT * FROM live_streams WHERE id = ?').get(req.params.id);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    const events = db.prepare(`
      SELECT timestamp, viewers, bitrate FROM analytics 
      WHERE streamId = ? ORDER BY timestamp DESC LIMIT 100
    `).all(req.params.id);

    res.json({
      stream: {
        id: stream.id,
        name: stream.name,
        isLive: !!stream.isLive,
        viewers: stream.viewers,
        peakViewers: stream.peakViewers,
        uptime: stream.uptime,
        bitrate: stream.bitrate,
        resolution: stream.resolution
      },
      history: events
    });
  });
}
