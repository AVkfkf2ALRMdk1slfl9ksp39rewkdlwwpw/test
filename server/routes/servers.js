import express from 'express';
import { getDB } from '../database.js';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from './auth.js';

export function setupServerRoutes(app) {
  // List servers
  app.get('/api/panel/servers', authenticateToken, (req, res) => {
    const db = getDB();
    const servers = db.prepare('SELECT * FROM servers ORDER BY createdAt DESC').all();
    res.json({ servers });
  });

  // Add server
  app.post('/api/panel/servers', authenticateToken, (req, res) => {
    const { hostname, port, rtmpPort, httpsPort, timezone, maxClients } = req.body;
    const db = getDB();
    const id = uuidv4();
    db.prepare('INSERT INTO servers (id, hostname, port, rtmpPort, httpsPort, timezone, maxClients) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, hostname, port || 3000, rtmpPort || 1935, httpsPort || 8443, timezone || 'UTC', maxClients || 100);
    res.json({ success: true, server: { id, hostname, port, rtmpPort, httpsPort, timezone, maxClients } });
  });

  // Update server
  app.put('/api/panel/servers/:id', authenticateToken, (req, res) => {
    const { hostname, port, rtmpPort, httpsPort, timezone, maxClients, status } = req.body;
    const db = getDB();
    db.prepare('UPDATE servers SET hostname=?, port=?, rtmpPort=?, httpsPort=?, timezone=?, maxClients=?, status=? WHERE id=?')
      .run(hostname, port, rtmpPort, httpsPort, timezone, maxClients, status !== undefined ? status : 1, req.params.id);
    res.json({ success: true });
  });

  // Delete server
  app.delete('/api/panel/servers/:id', authenticateToken, (req, res) => {
    const db = getDB();
    db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Server status
  app.get('/api/panel/servers/status', authenticateToken, (req, res) => {
    res.json({
      status: 'online',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid
    });
  });
}
