import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'data.db');

let db;

export function initDB() {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Videos table
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      filename TEXT NOT NULL,
      filesize INTEGER DEFAULT 0,
      duration REAL DEFAULT 0,
      format TEXT DEFAULT 'mp4',
      resolution TEXT DEFAULT '1920x1080',
      bitrate INTEGER DEFAULT 0,
      thumbnail TEXT DEFAULT '',
      status TEXT DEFAULT 'ready',
      views INTEGER DEFAULT 0,
      isLive INTEGER DEFAULT 0,
      streamKey TEXT DEFAULT '',
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Live streams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS live_streams (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      streamKey TEXT NOT NULL UNIQUE,
      rtmpUrl TEXT DEFAULT '',
      isLive INTEGER DEFAULT 0,
      viewers INTEGER DEFAULT 0,
      maxViewers INTEGER DEFAULT 0,
      duration INTEGER DEFAULT 0,
      thumbnail TEXT DEFAULT '',
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      endedAt INTEGER DEFAULT 0
    )
  `);

  // Analytics table
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      videoId TEXT,
      event TEXT,
      timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      metadata TEXT DEFAULT '{}'
    )
  `);

  console.log('✅ Database initialized');
}

export function getDB() {
  return db;
}
