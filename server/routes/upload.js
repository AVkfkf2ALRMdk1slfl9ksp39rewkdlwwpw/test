import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { getDB } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'videos');
const thumbDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'thumbnails');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.ts', '.m3u8', '.ogg'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Invalid format'));
  }
});

export function setupUploadRoutes(app) {
  // Upload video
  app.post('/api/upload', upload.single('video'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });

    const db = getDB();
    const id = uuidv4();
    const file = req.file;
    const ext = path.extname(file.originalname).replace('.', '');
    const filename = file.filename;
    const filepath = path.join(uploadDir, filename);

    // Generate thumbnail
    let thumbnail = '';
    try {
      const thumbFilename = `${path.basename(filename, path.extname(filename))}.jpg`;
      execSync(`ffmpeg -i "${filepath}" -ss 00:00:03 -vframes 1 -q:v 2 "${path.join(thumbDir, thumbFilename)}" 2>/dev/null`);
      thumbnail = `/uploads/thumbnails/${thumbFilename}`;
    } catch (e) {}

    // Get video info
    let info = { filesize: file.size, format: ext };
    try {
      const ffprobe = execSync(`ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height,codec_name,bit_rate -of json "${filepath}"`, { encoding: 'utf8' });
      const parsed = JSON.parse(ffprobe);
      const stream = parsed.streams?.[0] || {};
      info = {
        duration: parseFloat(parsed.format?.duration || 0),
        filesize: parseInt(parsed.format?.size || file.size),
        resolution: `${stream.width || 1920}x${stream.height || 1080}`,
        bitrate: parseInt(stream.bit_rate || 0),
        format: ext
      };
    } catch (e) {}

    db.prepare(`
      INSERT INTO videos (id, title, filename, filesize, duration, format, resolution, bitrate, thumbnail)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.body.title || path.basename(file.originalname, path.extname(file.originalname)),
      filename, info.filesize, info.duration || 0, info.format,
      info.resolution || '1920x1080', info.bitrate || 0, thumbnail
    );

    res.json({
      success: true,
      video: {
        id, title: req.body.title || path.basename(file.originalname, path.extname(file.originalname)),
        filename, ...info, thumbnail,
        url: `/uploads/videos/${filename}`,
        streamUrl: `/api/vod/${id}/stream`,
        hlsUrl: `/api/vod/${id}/hls/master.m3u8`,
        embedUrl: `/embed/vod/${id}`
      }
    });
  });

  // Get all videos
  app.get('/api/videos', (req, res) => {
    const db = getDB();
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    if (search) {
      const videos = db.prepare('SELECT * FROM videos WHERE title LIKE ? ORDER BY createdAt DESC LIMIT ? OFFSET ?')
        .all(`%${search}%`, parseInt(limit), parseInt(offset));
      const total = db.prepare('SELECT COUNT(*) as total FROM videos WHERE title LIKE ?').get(`%${search}%`).total;
      return res.json({ videos: videos.map(v => ({ ...v, url: `/uploads/videos/${v.filename}`, streamUrl: `/api/vod/${v.id}/stream`, embedUrl: `/embed/vod/${v.id}` })), pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } });
    }

    const videos = db.prepare('SELECT * FROM videos ORDER BY createdAt DESC LIMIT ? OFFSET ?').all(parseInt(limit), parseInt(offset));
    const total = db.prepare('SELECT COUNT(*) as total FROM videos').get().total;
    res.json({ videos: videos.map(v => ({ ...v, url: `/uploads/videos/${v.filename}`, streamUrl: `/api/vod/${v.id}/stream`, embedUrl: `/embed/vod/${v.id}` })), pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  });

  // Stream VOD video (range requests)
  app.get('/api/vod/:id/stream', (req, res) => {
    const db = getDB();
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
    if (!video) return res.status(404).json({ error: 'Not found' });

    const videoPath = path.join(uploadDir, video.filename);
    const fs = require('fs');
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      });
      fs.createReadStream(videoPath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': 'video/mp4' });
      fs.createReadStream(videoPath).pipe(res);
    }
  });

  // VOD HLS streaming
  app.get('/api/vod/:id/hls/master.m3u8', (req, res) => {
    const db = getDB();
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
    if (!video) return res.status(404).json({ error: 'Not found' });

    const videoPath = path.join(uploadDir, video.filename);
    const hlsDir = path.join(uploadDir, 'hls', video.id);
    const fs = require('fs');

    if (!fs.existsSync(path.join(hlsDir, 'master.m3u8'))) {
      fs.mkdirSync(hlsDir, { recursive: true });
      try {
        execSync(`ffmpeg -i "${videoPath}" -codec:v libx264 -codec:a aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${hlsDir}/segment_%03d.ts" "${hlsDir}/master.m3u8" 2>/dev/null`);
      } catch (e) {
        console.log('HLS generation failed:', e.message);
      }
    }

    if (fs.existsSync(path.join(hlsDir, 'master.m3u8'))) {
      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      res.sendFile(path.join(hlsDir, 'master.m3u8'));
    } else {
      res.status(500).json({ error: 'HLS not available' });
    }
  });

  // HLS segments
  app.get('/api/vod/:id/hls/:segment', (req, res) => {
    const db = getDB();
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
    if (!video) return res.status(404).json({ error: 'Not found' });

    const hlsDir = path.join(uploadDir, 'hls', video.id);
    const segmentPath = path.join(hlsDir, req.params.segment);
    const fs = require('fs');

    if (fs.existsSync(segmentPath)) {
      const ext = path.extname(segmentPath);
      res.set('Content-Type', ext === '.m3u8' ? 'application/vnd.apple.mpegurl' : 'video/mp2t');
      res.sendFile(segmentPath);
    } else {
      res.status(404).json({ error: 'Segment not found' });
    }
  });

  // Delete video
  app.delete('/api/videos/:id', (req, res) => {
    const db = getDB();
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
    if (!video) return res.status(404).json({ error: 'Not found' });

    const fs = require('fs');
    const videoPath = path.join(uploadDir, video.filename);
    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
    if (video.thumbnail) {
      const thumbPath = path.join(__dirname, '..', '..', 'public', video.thumbnail);
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    }
    // Delete HLS
    const hlsDir = path.join(uploadDir, 'hls', video.id);
    if (fs.existsSync(hlsDir)) fs.rmSync(hlsDir, { recursive: true });

    db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });
}
