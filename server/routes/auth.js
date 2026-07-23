import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDB } from '../database.js';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = 'xtream-ui-secret-2024';

export function setupAuthRoutes(app) {
  // Login
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    logActivity(db, username, 'login', req.ip);
    res.json({ success: true, token, user: { id: user.id, username: user.username, role: user.role } });
  });

  // Get current user
  app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
  });

  // Change password
  app.post('/api/auth/password', authenticateToken, (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(oldPassword, user.password)) return res.status(400).json({ error: 'Current password is incorrect' });
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), req.user.id);
    res.json({ success: true });
  });

  // Add panel user
  app.post('/api/auth/users', authenticateToken, (req, res) => {
    const { username, password, email, role } = req.body;
    const db = getDB();
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) return res.status(400).json({ error: 'Username already exists' });
    const id = uuidv4();
    db.prepare('INSERT INTO users (id, username, password, email, role) VALUES (?, ?, ?, ?, ?)')
      .run(id, username, bcrypt.hashSync(password, 10), email || '', role || 'admin');
    res.json({ success: true, user: { id, username, email, role } });
  });

  // List panel users
  app.get('/api/auth/users', authenticateToken, (req, res) => {
    const db = getDB();
    const users = db.prepare('SELECT id, username, email, role, createdAt FROM users ORDER BY createdAt DESC').all();
    res.json({ users });
  });

  // Delete panel user
  app.delete('/api/auth/users/:id', authenticateToken, (req, res) => {
    const db = getDB();
    db.prepare('DELETE FROM users WHERE id = ? AND username != ?').run(req.params.id, 'admin');
    res.json({ success: true });
  });
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function logActivity(db, username, action, ip) {
  try {
    db.prepare('INSERT INTO activity_log (username, action, ip) VALUES (?, ?, ?)').run(username, action, ip || '');
  } catch (e) {}
}
