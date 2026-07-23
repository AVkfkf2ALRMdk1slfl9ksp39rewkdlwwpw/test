import express from 'express';
import { getDB } from '../database.js';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from './auth.js';

export function setupPanelRoutes(app) {
  // ===== CATEGORIES =====
  
  // List categories
  app.get('/api/panel/categories', authenticateToken, (req, res) => {
    const db = getDB();
    const { type } = req.query;
    const where = type ? 'WHERE type = ?' : '';
    const categories = db.prepare(`SELECT * FROM categories ${where} ORDER BY name ASC`).all(type || '');
    res.json({ categories });
  });

  // Add category
  app.post('/api/panel/categories', authenticateToken, (req, res) => {
    const { name, type, parentId, icon } = req.body;
    const db = getDB();
    const id = uuidv4();
    db.prepare('INSERT INTO categories (id, name, type, parentId, icon) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, type || 'live', parentId || null, icon || '');
    res.json({ success: true, category: { id, name, type, parentId, icon } });
  });

  // Update category
  app.put('/api/panel/categories/:id', authenticateToken, (req, res) => {
    const { name, type, icon } = req.body;
    const db = getDB();
    db.prepare('UPDATE categories SET name = ?, type = ?, icon = ? WHERE id = ?').run(name, type, icon, req.params.id);
    res.json({ success: true });
  });

  // Delete category
  app.delete('/api/panel/categories/:id', authenticateToken, (req, res) => {
    const db = getDB();
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // ===== LIVE STREAMS =====

  // List live streams
  app.get('/api/panel/streams', authenticateToken, (req, res) => {
    const db = getDB();
    const { categoryId, search } = req.query;
    let query = `SELECT ls.*, c.name as categoryName FROM live_streams ls LEFT JOIN categories c ON ls.categoryId = c.id WHERE ls.status != -1`;
    const params = [];
    if (categoryId) { query += ' AND ls.categoryId = ?'; params.push(categoryId); }
    if (search) { query += ' AND ls.name LIKE ?'; params.push(`%${search}%`); }
    query += ' ORDER BY ls.createdAt DESC';
    const streams = db.prepare(query).all(...params);
    res.json({ streams });
  });

  // Add live stream
  app.post('/api/panel/streams', authenticateToken, (req, res) => {
    const { name, categoryId, streamUrl, streamIcon, streamType, epgId } = req.body;
    const db = getDB();
    const id = uuidv4();
    db.prepare('INSERT INTO live_streams (id, name, categoryId, streamUrl, streamIcon, streamType, epgId) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, name, categoryId, streamUrl, streamIcon || '', streamType || 'm3u8', epgId || '');
    res.json({ success: true, stream: { id, name, categoryId, streamUrl, streamIcon, streamType, epgId } });
  });

  // Update live stream
  app.put('/api/panel/streams/:id', authenticateToken, (req, res) => {
    const { name, categoryId, streamUrl, streamIcon, streamType, epgId, status } = req.body;
    const db = getDB();
    db.prepare('UPDATE live_streams SET name=?, categoryId=?, streamUrl=?, streamIcon=?, streamType=?, epgId=?, status=? WHERE id=?')
      .run(name, categoryId, streamUrl, streamIcon, streamType, epgId, status !== undefined ? status : 1, req.params.id);
    res.json({ success: true });
  });

  // Delete live stream
  app.delete('/api/panel/streams/:id', authenticateToken, (req, res) => {
    const db = getDB();
    db.prepare('DELETE FROM live_streams WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Toggle stream status
  app.patch('/api/panel/streams/:id/status', authenticateToken, (req, res) => {
    const { status } = req.body;
    const db = getDB();
    db.prepare('UPDATE live_streams SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ success: true });
  });

  // ===== MOVIES (VOD) =====

  // List movies
  app.get('/api/panel/movies', authenticateToken, (req, res) => {
    const db = getDB();
    const { categoryId, search } = req.query;
    let query = `SELECT m.*, c.name as categoryName FROM movies m LEFT JOIN categories c ON m.categoryId = c.id WHERE m.status != -1`;
    const params = [];
    if (categoryId) { query += ' AND m.categoryId = ?'; params.push(categoryId); }
    if (search) { query += ' AND m.title LIKE ?'; params.push(`%${search}%`); }
    query += ' ORDER BY m.createdAt DESC';
    const movies = db.prepare(query).all(...params);
    res.json({ movies });
  });

  // Add movie
  app.post('/api/panel/movies', authenticateToken, (req, res) => {
    const { title, categoryId, streamUrl, poster, plot, genre, year, rating, director, actors } = req.body;
    const db = getDB();
    const id = uuidv4();
    db.prepare('INSERT INTO movies (id, title, categoryId, streamUrl, poster, plot, genre, year, rating, director, actors) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, title, categoryId, streamUrl || '', poster || '', plot || '', genre || '', year || '', rating || '', director || '', actors || '');
    res.json({ success: true, movie: { id, title, categoryId } });
  });

  // Update movie
  app.put('/api/panel/movies/:id', authenticateToken, (req, res) => {
    const { title, categoryId, streamUrl, poster, plot, genre, year, rating, director, actors, status } = req.body;
    const db = getDB();
    db.prepare('UPDATE movies SET title=?, categoryId=?, streamUrl=?, poster=?, plot=?, genre=?, year=?, rating=?, director=?, actors=?, status=? WHERE id=?')
      .run(title, categoryId, streamUrl, poster, plot, genre, year, rating, director, actors, status !== undefined ? status : 1, req.params.id);
    res.json({ success: true });
  });

  // Delete movie
  app.delete('/api/panel/movies/:id', authenticateToken, (req, res) => {
    const db = getDB();
    db.prepare('DELETE FROM movies WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // ===== SERIES =====

  // List series
  app.get('/api/panel/series', authenticateToken, (req, res) => {
    const db = getDB();
    const { categoryId, search } = req.query;
    let query = `SELECT s.*, c.name as categoryName FROM series s LEFT JOIN categories c ON s.categoryId = c.id WHERE s.status != -1`;
    const params = [];
    if (categoryId) { query += ' AND s.categoryId = ?'; params.push(categoryId); }
    if (search) { query += ' AND s.title LIKE ?'; params.push(`%${search}%`); }
    query += ' ORDER BY s.createdAt DESC';
    const series = db.prepare(query).all(...params);
    // Add episode count
    for (const s of series) {
      const epCount = db.prepare('SELECT COUNT(*) as count FROM episodes WHERE seriesId = ?').get(s.id);
      s.episodeCount = epCount.count;
    }
    res.json({ series });
  });

  // Add series
  app.post('/api/panel/series', authenticateToken, (req, res) => {
    const { title, categoryId, cover, plot, genre, year, rating } = req.body;
    const db = getDB();
    const id = uuidv4();
    db.prepare('INSERT INTO series (id, title, categoryId, cover, plot, genre, year, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, title, categoryId, cover || '', plot || '', genre || '', year || '', rating || '');
    res.json({ success: true, series: { id, title, categoryId } });
  });

  // Delete series
  app.delete('/api/panel/series/:id', authenticateToken, (req, res) => {
    const db = getDB();
    db.prepare('DELETE FROM series WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM episodes WHERE seriesId = ?').run(req.params.id);
    res.json({ success: true });
  });

  // ===== EPISODES =====

  // List episodes for a series
  app.get('/api/panel/series/:seriesId/episodes', authenticateToken, (req, res) => {
    const db = getDB();
    const episodes = db.prepare('SELECT * FROM episodes WHERE seriesId = ? ORDER BY seasonNum, episodeNum').all(req.params.seriesId);
    res.json({ episodes });
  });

  // Add episode
  app.post('/api/panel/series/:seriesId/episodes', authenticateToken, (req, res) => {
    const { title, episodeNum, seasonNum, streamUrl, duration } = req.body;
    const db = getDB();
    const id = uuidv4();
    db.prepare('INSERT INTO episodes (id, seriesId, title, episodeNum, seasonNum, streamUrl, duration) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, req.params.seriesId, title, episodeNum || 1, seasonNum || 1, streamUrl || '', duration || 0);
    res.json({ success: true, episode: { id, title, episodeNum, seasonNum } });
  });

  // Delete episode
  app.delete('/api/panel/episodes/:id', authenticateToken, (req, res) => {
    const db = getDB();
    db.prepare('DELETE FROM episodes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // ===== STATISTICS =====

  // Dashboard stats
  app.get('/api/panel/stats', authenticateToken, (req, res) => {
    const db = getDB();
    const stats = {
      liveStreams: db.prepare('SELECT COUNT(*) as count FROM live_streams WHERE status = 1').get().count,
      movies: db.prepare('SELECT COUNT(*) as count FROM movies WHERE status = 1').get().count,
      series: db.prepare('SELECT COUNT(*) as count FROM series WHERE status = 1').get().count,
      categories: db.prepare('SELECT COUNT(*) as count FROM categories').get().count,
      apiUsers: db.prepare('SELECT COUNT(*) as count FROM api_credentials WHERE isActive = 1').get().count,
      servers: db.prepare('SELECT COUNT(*) as count FROM servers WHERE status = 1').get().count,
      totalStorage: 0
    };
    res.json({ stats });
  });

  // ===== SETTINGS =====

  // Get settings
  app.get('/api/panel/settings', authenticateToken, (req, res) => {
    const db = getDB();
    const settings = db.prepare('SELECT * FROM settings').all();
    res.json({ settings });
  });

  // Update settings
  app.put('/api/panel/settings', authenticateToken, (req, res) => {
    const db = getDB();
    const settings = req.body;
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, strftime(\'%s\', \'now\') * 1000)');
    for (const [key, value] of Object.entries(settings)) {
      stmt.run(key, String(value));
    }
    res.json({ success: true });
  });

  // ===== ACTIVITY LOG =====

  app.get('/api/panel/activity', authenticateToken, (req, res) => {
    const db = getDB();
    const logs = db.prepare('SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT 100').all();
    res.json({ logs });
  });
}
