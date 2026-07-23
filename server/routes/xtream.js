import express from 'express';
import { getDB } from '../database.js';

// Xtream Codes API compatibility
export function setupXtreamRoutes(app) {
  // Player API entry point
  app.get('/player_api.php', (req, res) => {
    const db = getDB();
    const { username, password, action } = req.query;

    // Authenticate
    const cred = db.prepare('SELECT * FROM api_credentials WHERE username = ? AND password = ? AND isActive = 1').get(username, password);
    if (!cred) return res.status(401).json({ user_info: { auth: false, status: 'Expired' }, server_info: {} });

    logActivity(db, username, 'api_access', req.ip);

    // User info
    if (!action) {
      return res.json({
        user_info: {
          auth: true,
          status: 'Active',
          username,
          exp_date: cred.expireDate || '0',
          is_trial: '0',
          active_cons: 0,
          created_at: cred.createdAt,
          max_connections: cred.maxConnections,
          allowed_output_formats: ['m3u8', 'ts', 'rtmp']
        },
        server_info: {
          url: req.hostname,
          port: req.socket.localPort,
          https_port: '',
          server_protocol: 'http',
          rtmp_port: '1935',
          timezone: 'UTC',
          timestamp_now: Date.now(),
          time_now: new Date().toISOString()
        }
      });
    }

    switch (action) {
      case 'get_live_categories':
        return res.json(db.prepare('SELECT id, name, icon FROM categories WHERE type = \'live\'').all());

      case 'get_vod_categories':
        return res.json(db.prepare('SELECT id, name, icon FROM categories WHERE type = \'vod\'').all());

      case 'get_series_categories':
        return res.json(db.prepare('SELECT id, name, icon FROM categories WHERE type = \'series\'').all());

      case 'get_live_streams':
        const liveCat = req.query.category_id;
        let liveQuery = 'SELECT id, name, categoryId, streamIcon, status FROM live_streams WHERE status = 1';
        if (liveCat) liveQuery += ' AND categoryId = ' + db.prepare('').db ? liveCat : liveCat;
        liveQuery = db.prepare(`SELECT id, name, categoryId as category_id, streamIcon as stream_icon, status FROM live_streams WHERE status = 1${liveCat ? ' AND categoryId = ?' : ''}`);
        return res.json(liveCat ? liveQuery.all(liveCat) : liveQuery.all());

      case 'get_vod_streams':
        const vodCat = req.query.category_id;
        const vodQuery = db.prepare(`SELECT id, title, categoryId as category_id, poster as cover, year, rating, genre, container FROM movies WHERE status = 1${vodCat ? ' AND categoryId = ?' : ''}`);
        return res.json(vodCat ? vodQuery.all(vodCat) : vodQuery.all());

      case 'get_series':
        const serCat = req.query.category_id;
        const serQuery = db.prepare(`SELECT id, title, categoryId as category_id, cover, year, rating, genre, plot FROM series WHERE status = 1${serCat ? ' AND categoryId = ?' : ''}`);
        return res.json(serCat ? serQuery.all(serCat) : serQuery.all());

      case 'get_series_info':
        const seriesId = req.query.series_id;
        const seriesInfo = db.prepare('SELECT * FROM series WHERE id = ?').get(seriesId);
        if (!seriesInfo) return res.json([]);
        const episodes = db.prepare('SELECT id, title, episodeNum as episode_num, seasonNum as season, streamUrl as custom_sid, duration FROM episodes WHERE seriesId = ?').all(seriesId);
        return res.json([seriesInfo, episodes]);

      case 'get_vod_info':
        const movieId = req.query.vod_id;
        const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(movieId);
        return res.json(movie || []);

      case 'get_short_epg':
        const liveStreamId = req.query.stream_id;
        const epgs = db.prepare('SELECT * FROM epg WHERE streamId = ? AND start > ? ORDER BY start LIMIT 10', [liveStreamId, Date.now() - 86400000]).all();
        return res.json(epgs);

      case 'view':
        // Log view
        logActivity(db, username, 'view_' + (req.query.type || ''), req.ip);
        return res.json({});

      default:
        return res.json({});
    }
  });

  // XMLTV EPG endpoint
  app.get('/xmltv.php', (req, res) => {
    const db = getDB();
    const { username, password } = req.query;
    if (username && password) {
      const cred = db.prepare('SELECT id FROM api_credentials WHERE username = ? AND password = ? AND isActive = 1').get(username, password);
      if (!cred) return res.status(401).send('Unauthorized');
    }
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n';
    const streams = db.prepare('SELECT * FROM live_streams WHERE status = 1 AND epgId != \'\'').all();
    for (const s of streams) {
      xml += `<channel id="${s.epgId}"><display-name>${s.name}</display-name></channel>\n`;
    }
    xml += '</tv>\n';
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  });
}

function logActivity(db, username, action, ip) {
  try {
    db.prepare('INSERT INTO activity_log (username, action, ip) VALUES (?, ?, ?)').run(username, action, ip || '');
  } catch (e) {}
}
