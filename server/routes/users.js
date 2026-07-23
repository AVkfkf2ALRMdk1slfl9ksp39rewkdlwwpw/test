import express from 'express';
import { getDB } from '../database.js';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from './auth.js';

export function setupUserRoutes(app) {
  // List IPTV users
  app.get('/api/panel/iptv-users', authenticateToken, (req, res) => {
    const db = getDB();
    const users = db.prepare('SELECT * FROM api_credentials ORDER BY createdAt DESC').all();
    res.json({ users });
  });

  // Add IPTV user
  app.post('/api/panel/iptv-users', authenticateToken, (req, res) => {
    const { username, password, expireDate, maxConnections, allowedIps } = req.body;
    const db = getDB();
    const exists = db.prepare('SELECT id FROM api_credentials WHERE username = ?').get(username);
    if (exists) return res.status(400).json({ error: 'Username already exists' });
    const id = uuidv4();
    db.prepare('INSERT INTO api_credentials (id, username, password, expireDate, maxConnections, allowedIps) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, username, password, expireDate || 0, maxConnections || 1, allowedIps || '');
    res.json({ success: true, user: { id, username, expireDate, maxConnections, allowedIps } });
  });

  // Update IPTV user
  app.put('/api/panel/iptv-users/:id', authenticateToken, (req, res) => {
    const { username, password, isActive, expireDate, maxConnections, allowedIps } = req.body;
    const db = getDB();
    db.prepare('UPDATE api_credentials SET username=?, password=?, isActive=?, expireDate=?, maxConnections=?, allowedIps=? WHERE id=?')
      .run(username, password, isActive !== undefined ? isActive : 1, expireDate || 0, maxConnections || 1, allowedIps || '', req.params.id);
    res.json({ success: true });
  });

  // Delete IPTV user
  app.delete('/api/panel/iptv-users/:id', authenticateToken, (req, res) => {
    const db = getDB();
    db.prepare('DELETE FROM api_credentials WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Reset IPTV user password
  app.patch('/api/panel/iptv-users/:id/reset', authenticateToken, (req, res) => {
    const db = getDB();
    const newPass = uuidv4().substring(0, 12);
    db.prepare('UPDATE api_credentials SET password = ? WHERE id = ?').run(newPass, req.params.id);
    res.json({ success: true, newPassword: newPass });
  });
}
