import NodeMediaServer from 'node-media-server';
import { getDB } from './database.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let nms;

export function initRTMPServer(port = 1935) {
  const config = {
    rtmp: {
      port: port,
      chunk_size: 60000,
      gop_cache: true,
      ping: 30,
      ping_timeout: 60
    },
    http: {
      port: 8000,
      allow_origin: '*',
      mediaroot: path.join(__dirname, '..', 'public', 'uploads'),
      api: true
    },
    trans: {
      ffmpeg: '/usr/bin/ffmpeg',
      tasks: []
    },
    https: {
      port: 8443
    }
  };

  nms = new NodeMediaServer(config);

  // Pre-publish event - validate stream key
  nms.on('prePublish', (id, StreamPath, args) => {
    console.log(`[RTMP] Stream starting: ${StreamPath}`);
    
    // Extract stream key from path: /live/STREAM_KEY
    const parts = StreamPath.split('/');
    const streamKey = parts[parts.length - 1];
    const streamName = parts[parts.length - 2] || 'live';

    // Check if stream key is valid
    const db = getDB();
    const stream = db.prepare('SELECT id FROM live_streams WHERE streamKey = ?').get(streamKey);
    
    if (!stream) {
      console.log(`[RTMP] Invalid stream key: ${streamKey}`);
      // Still allow it for flexibility - create a temporary stream
      const newId = uuidv4();
      db.prepare(`
        INSERT INTO live_streams (id, name, streamKey, rtmpUrl, hlsUrl, status, isLive)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(newId, `Stream ${streamName}`, streamKey, 
        `rtmp://localhost:${port}/${streamName}/${streamKey}`,
        `/hls/${streamName}/${streamKey}/index.m3u8`,
        'live', 1
      );
    } else {
      db.prepare('UPDATE live_streams SET isLive = 1, status = ?, startedAt = ? WHERE streamKey = ?')
        .run('live', Date.now(), streamKey);
    }
  });

  // Post-publish event - stream ended
  nms.on('postPublish', (id, StreamPath, args) => {
    console.log(`[RTMP] Stream ended: ${StreamPath}`);
    const parts = StreamPath.split('/');
    const streamKey = parts[parts.length - 1];
    const streamName = parts[parts.length - 2] || 'live';

    const db = getDB();
    const stream = db.prepare('SELECT id FROM live_streams WHERE streamKey = ?').get(streamKey);
    if (stream) {
      const duration = Date.now() - (stream.startedAt || Date.now());
      db.prepare(`
        UPDATE live_streams SET isLive = 0, status = 'offline', uptime = uptime + ?
        WHERE streamKey = ?
      `).run(duration / 1000, streamKey);
    }
  });

  // Connection events
  nms.on('preConnect', (id, args) => {
    console.log(`[RTMP] Client connecting: ${id}`);
  });

  nms.on('postConnect', (id, args) => {
    console.log(`[RTMP] Client connected: ${id}`);
  });

  // Start the server
  nms.run();
  console.log(`✅ RTMP Server running on port ${port}`);
}

export function getNMS() {
  return nms;
}

export function getStreamStats() {
  if (!nms) return { streams: 0, viewers: 0 };
  
  try {
    const sessions = nms.sessions;
    const publishers = sessions.filter(s => s.constructor.name === 'NodeRtmpSession' && s.isStartingPublish);
    const subscribers = sessions.filter(s => s.constructor.name === 'NodeRtmpSession' && s.isStartingPlay);
    return {
      streams: publishers.length,
      viewers: subscribers.length,
      sessions: sessions.length
    };
  } catch (e) {
    return { streams: 0, viewers: 0, sessions: 0 };
  }
}
