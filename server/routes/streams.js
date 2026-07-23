import express from 'express';
import { getDB } from '../database.js';

export function setupStreamRoutes(app) {
  // Proxy/Redirect live stream
  app.get('/live/:id', (req, res) => {
    const db = getDB();
    const stream = db.prepare('SELECT * FROM live_streams WHERE id = ? AND status = 1').get(req.params.id);
    if (!stream) return res.status(404).send('Stream not found');
    if (stream.streamUrl) return res.redirect(stream.streamUrl);
    res.status(404).send('Stream URL not available');
  });

  // Proxy movie
  app.get('/movie/:id', (req, res) => {
    const db = getDB();
    const movie = db.prepare('SELECT * FROM movies WHERE id = ? AND status = 1').get(req.params.id);
    if (!movie) return res.status(404).send('Movie not found');
    if (movie.streamUrl) return res.redirect(movie.streamUrl);
    res.status(404).send('Movie URL not available');
  });

  // Proxy series episode
  app.get('/series/:id', (req, res) => {
    const db = getDB();
    const episode = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.id);
    if (!episode) return res.status(404).send('Episode not found');
    if (episode.streamUrl) return res.redirect(episode.streamUrl);
    res.status(404).send('Episode URL not available');
  });

  // Generate M3U playlist
  app.get('/get.php', (req, res) => {
    const db = getDB();
    const { type, username, password, output } = req.query;

    if (username && password) {
      const cred = db.prepare('SELECT * FROM api_credentials WHERE username = ? AND password = ? AND isActive = 1').get(username, password);
      if (!cred) return res.status(401).send('# Unauthorized');
    }

    if (type === 'm3u' || type === 'm3u_plus') {
      const streams = db.prepare('SELECT * FROM live_streams WHERE status = 1').all();
      const categories = db.prepare('SELECT * FROM categories WHERE type = \'live\'').all();
      let m3u = '#EXTM3U\n';
      const catMap = {};
      categories.forEach(c => catMap[c.id] = c.name);

      for (const stream of streams) {
        const catName = catMap[stream.categoryId] || 'Uncategorized';
        const logo = stream.streamIcon ? ` tvg-logo="${stream.streamIcon}"` : '';
        const tvgId = stream.epgId ? ` tvg-id="${stream.epgId}"` : '';
        m3u += `#EXTINF:-1${tvgId}${logo} group-title="${catName}",${stream.name}\n`;
        m3u += `${stream.streamUrl}\n`;
      }

      if (output !== 'ts') {
        const movies = db.prepare('SELECT * FROM movies WHERE status = 1').all();
        for (const movie of movies) {
          m3u += `#EXTINF:-1 group-title="Movies",${movie.title}\n`;
          m3u += `${movie.streamUrl}\n`;
        }
      }

      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      res.set('Content-Disposition', 'attachment; filename="playlist.m3u"');
      res.send(m3u);
    } else {
      res.send('# Xtream UI Playlist\n');
    }
  });

  // XMLTV EPG
  app.get('/xmltv.php', (req, res) => {
    const db = getDB();
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n';
    const streams = db.prepare('SELECT * FROM live_streams WHERE status = 1 AND epgId != \'\'').all();
    for (const stream of streams) {
      xml += `  <channel id="${stream.epgId}"><display-name>${stream.name}</display-name></channel>\n`;
    }
    const epgs = db.prepare('SELECT * FROM epg WHERE start > ? ORDER BY start', [Date.now() - 86400000]).all();
    for (const epg of epgs) {
      const start = new Date(epg.start * 1000).toISOString();
      const stop = new Date(epg.stop * 1000).toISOString();
      xml += `  <programme start="${start}" stop="${stop}" channel="${epg.streamId}"><title>${epg.title}</title>`;
      if (epg.description) xml += `<desc>${epg.description}</desc>`;
      if (epg.icon) xml += `<icon src="${epg.icon}"/>`;
      xml += `</programme>\n`;
    }
    xml += '</tv>';
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  });
}
