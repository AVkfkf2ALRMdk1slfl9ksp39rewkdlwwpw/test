import express from 'express';
import { getDB } from '../database.js';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from './auth.js';

export function setupAPICredentialsRoutes(app) {
  // List API credentials
  app.get('/api/panel/api-credentials', authenticateToken, (req, res) => {
    const db = getDB();
    const creds = db.prepare('SELECT * FROM api_credentials ORDER BY createdAt DESC').all();
    res.json({ credentials: creds });
  });

  // Add API credential
  app.post('/api/panel/api-credentials', authenticateToken, (req, res) => {
    const { username, password, expireDate, maxConnections, allowedIps } = req.body;
    const db = getDB();
    const exists = db.prepare('SELECT id FROM api_credentials WHERE username = ?').get(username);
    if (exists) return res.status(400).json({ error: 'Username already exists' });
    const id = uuidv4();
    db.prepare('INSERT INTO api_credentials (id, username, password, expireDate, maxConnections, allowedIps) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, username, password, expireDate || 0, maxConnections || 1, allowedIps || '');
    res.json({ success: true, credential: { id, username, expireDate, maxConnections, allowedIps } });
  });

  // Update API credential
  app.put('/api/panel/api-credentials/:id', authenticateToken, (req, res) => {
    const { username, password, isActive, expireDate, maxConnections, allowedIps } = req.body;
    const db = getDB();
    db.prepare('UPDATE api_credentials SET username=?, password=?, isActive=?, expireDate=?, maxConnections=?, allowedIps=? WHERE id=?')
      .run(username, password, isActive !== undefined ? isActive : 1, expireDate || 0, maxConnections || 1, allowedIps || '', req.params.id);
    res.json({ success: true });
  });

  // Delete API credential
  app.delete('/api/panel/api-credentials/:id', authenticateToken, (req, res) => {
    const db = getDB();
    db.prepare('DELETE FROM api_credentials WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });
}
