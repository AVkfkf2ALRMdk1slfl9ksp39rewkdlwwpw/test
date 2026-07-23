import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'data', 'xtream.db');

let db;

export function initDB() {
  const fs = require('fs');
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  // Panel Admin Users
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

  // IPTV Categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'live',
      parentId TEXT,
      icon TEXT DEFAULT '',
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Live Streams (Channels)
  db.exec(`
    CREATE TABLE IF NOT EXISTS live_streams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      categoryId TEXT,
      streamIcon TEXT DEFAULT '',
      streamUrl TEXT NOT NULL,
      streamType TEXT DEFAULT 'm3u8',
      streamSource TEXT DEFAULT '',
      status INTEGER DEFAULT 1,
      epgId TEXT DEFAULT '',
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // VOD Movies
  db.exec(`
    CREATE TABLE IF NOT EXISTS movies (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      categoryId TEXT,
      filename TEXT DEFAULT '',
      filesize INTEGER DEFAULT 0,
      duration REAL DEFAULT 0,
      container TEXT DEFAULT 'mp4',
      year TEXT DEFAULT '',
      rating TEXT DEFAULT '',
      poster TEXT DEFAULT '',
      plot TEXT DEFAULT '',
      genre TEXT DEFAULT '',
      director TEXT DEFAULT '',
      actors TEXT DEFAULT '',
      releaseDate TEXT DEFAULT '',
      streamUrl TEXT DEFAULT '',
      status INTEGER DEFAULT 1,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Series / TV Shows
  db.exec(`
    CREATE TABLE IF NOT EXISTS series (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      categoryId TEXT,
      cover TEXT DEFAULT '',
      plot TEXT DEFAULT '',
      genre TEXT DEFAULT '',
      rating TEXT DEFAULT '',
      year TEXT DEFAULT '',
      status INTEGER DEFAULT 1,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Series Episodes
  db.exec(`
    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      seriesId TEXT NOT NULL,
      title TEXT NOT NULL,
      episodeNum INTEGER DEFAULT 1,
      seasonNum INTEGER DEFAULT 1,
      filename TEXT DEFAULT '',
      duration REAL DEFAULT 0,
      container TEXT DEFAULT 'mp4',
      streamUrl TEXT DEFAULT '',
      status INTEGER DEFAULT 1,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (seriesId) REFERENCES series(id) ON DELETE CASCADE
    )
  `);

  // API Credentials (for IPTV clients like Xtream Codes)
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_credentials (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      isActive INTEGER DEFAULT 1,
      expireDate INTEGER DEFAULT 0,
      maxConnections INTEGER DEFAULT 1,
      allowedIps TEXT DEFAULT '',
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Servers (for load balancing)
  db.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      hostname TEXT NOT NULL,
      port INTEGER DEFAULT 3000,
      rtmpPort INTEGER DEFAULT 1935,
      httpsPort INTEGER DEFAULT 8443,
      timezone TEXT DEFAULT 'UTC',
      status INTEGER DEFAULT 1,
      maxClients INTEGER DEFAULT 100,
      activeClients INTEGER DEFAULT 0,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // EPG (Electronic Program Guide)
  db.exec(`
    CREATE TABLE IF NOT EXISTS epg (
      id TEXT PRIMARY KEY,
      streamId TEXT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      start INTEGER NOT NULL,
      stop INTEGER NOT NULL,
      icon TEXT DEFAULT '',
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Analytics / Activity Log
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      action TEXT,
      ip TEXT,
      userAgent TEXT,
      timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Create default admin
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin', 10);
    db.prepare('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), 'admin', hash, 'admin');
  }

  // Default settings
  const defaults = [
    ['panel_name', 'Xtream UI'],
    ['panel_url', ''],
    ['max_connections', '1'],
    ['allowed_formats', 'm3u8,mp4,mkv'],
    ['transcode_enabled', '0'],
    ['epg_refresh', '12'],
    ['log_retention', '30'],
    ['theme', 'dark']
  ];
  for (const [key, value] of defaults) {
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }

  // Default server
  const serverExists = db.prepare('SELECT id FROM servers LIMIT 1').get();
  if (!serverExists) {
    db.prepare('INSERT INTO servers (id, hostname, port, maxClients) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), 'localhost', 3000, 100);
  }

  console.log('✅ Xtream UI Database initialized');
}

export function getDB() {
  return db;
}
