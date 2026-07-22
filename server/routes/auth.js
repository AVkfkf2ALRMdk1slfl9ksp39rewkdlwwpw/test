import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDB } from '../database.js';

const JWT_SECRET = 'stream-hub-secret-key-2024';

export function setupAuthRoutes(app) {
  // Login
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
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

    if (!bcrypt.compareSync(oldPassword, user.password)) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);

    res.json({ success: true });
  });
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // For dashboard access, allow without auth but pass guest user
    req.user = { id: 'guest', username: 'guest', role: 'viewer' };
    return next();
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    req.user = { id: 'guest', username: 'guest', role: 'viewer' };
    next();
  }
}
