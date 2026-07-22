import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'data', 'stream-hub.db');

let db;

export function initDB() {
  const fs = require('fs');
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
  
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      role TEXT DEFAULT 'admin',
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Live streams
  db.exec(`
    CREATE TABLE IF NOT EXISTS live_streams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      streamKey TEXT NOT NULL UNIQUE,
      isLive INTEGER DEFAULT 0,
      viewers INTEGER DEFAULT 0,
      peakViewers INTEGER DEFAULT 0,
      uptime INTEGER DEFAULT 0,
      bitrate INTEGER DEFAULT 0,
      resolution TEXT DEFAULT '1920x1080',
      fps INTEGER DEFAULT 30,
      codec TEXT DEFAULT 'h264',
      rtmpUrl TEXT DEFAULT '',
      hlsUrl TEXT DEFAULT '',
      startedAt INTEGER DEFAULT 0,
      totalWatchTime INTEGER DEFAULT 0,
      chatEnabled INTEGER DEFAULT 1,
      recordEnabled INTEGER DEFAULT 0,
      restreamTargets TEXT DEFAULT '[]',
      thumbnail TEXT DEFAULT '',
      status TEXT DEFAULT 'offline',
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Restream targets (multi-platform)
  db.exec(`
    CREATE TABLE IF NOT EXISTS restream_targets (
      id TEXT PRIMARY KEY,
      streamId TEXT NOT NULL,
      platform TEXT NOT NULL,
      name TEXT NOT NULL,
      rtmpUrl TEXT NOT NULL,
      streamKey TEXT NOT NULL,
      isEnabled INTEGER DEFAULT 1,
      isConnecting INTEGER DEFAULT 0,
      isConnected INTEGER DEFAULT 0,
      bytesSent INTEGER DEFAULT 0,
      lastError TEXT DEFAULT '',
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (streamId) REFERENCES live_streams(id) ON DELETE CASCADE
    )
  `);

  // Video recordings
  db.exec(`
    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY,
      streamId TEXT,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      filesize INTEGER DEFAULT 0,
      duration REAL DEFAULT 0,
      resolution TEXT DEFAULT '1920x1080',
      bitrate INTEGER DEFAULT 0,
      thumbnail TEXT DEFAULT '',
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Uploaded VOD videos
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      filename TEXT NOT NULL,
      filesize INTEGER DEFAULT 0,
      duration REAL DEFAULT 0,
      resolution TEXT DEFAULT '1920x1080',
      bitrate INTEGER DEFAULT 0,
      thumbnail TEXT DEFAULT '',
      views INTEGER DEFAULT 0,
      status TEXT DEFAULT 'ready',
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Analytics events
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      streamId TEXT,
      event TEXT,
      viewers INTEGER DEFAULT 0,
      bitrate INTEGER DEFAULT 0,
      timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Server settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Create default admin user
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin', 10);
    db.prepare('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)')
      .run(require('uuid').v4(), 'admin', hash, 'admin');
  }

  // Default settings
  const settings = [
    ['serverName', 'Stream Hub'],
    ['maxBitrate', '8000'],
    ['maxResolution', '1920x1080'],
    ['autoRecord', 'false'],
    ['transcodeEnabled', 'false'],
    ['hlsSegmentDuration', '10'],
    ['maxViewers', '0'],
    ['theme', 'dark']
  ];
  for (const [key, value] of settings) {
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }

  console.log('✅ Database initialized successfully');
}

export function getDB() {
  return db;
}
