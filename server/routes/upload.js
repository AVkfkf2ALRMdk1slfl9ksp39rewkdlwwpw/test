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
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5GB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.ts', '.m3u8'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Invalid file format'));
  }
});

export function setupUploadRoutes(app) {
  // Upload video
  app.post('/api/upload', upload.single('video'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

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
      execSync(`ffmpeg -i "${filepath}" -ss 00:00:05 -vframes 1 -q:v 2 "${path.join(thumbDir, thumbFilename)}" 2>/dev/null`);
      thumbnail = `/uploads/thumbnails/${thumbFilename}`;
    } catch (e) {
      console.log('Thumbnail generation failed:', e.message);
    }

    // Get video info
    let info = {};
    try {
      const ffprobeOutput = execSync(`ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height,codec_name,bit_rate -of json "${filepath}" 2>/dev/null`, { encoding: 'utf8' });
      const parsed = JSON.parse(ffprobeOutput);
      const stream = parsed.streams?.[0] || {};
      info = {
        duration: parseFloat(parsed.format?.duration || 0),
        filesize: parseInt(parsed.format?.size || file.size),
        resolution: `${stream.width || 1920}x${stream.height || 1080}`,
        bitrate: parseInt(stream.bit_rate || 0),
        format: ext
      };
    } catch (e) {
      console.log('Video info failed:', e.message);
      info = { filesize: file.size, format: ext };
    }

    // Save to database
    const stmt = db.prepare(`
      INSERT INTO videos (id, title, filename, filesize, duration, format, resolution, bitrate, thumbnail, status, streamKey)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      req.body.title || path.basename(file.originalname, path.extname(file.originalname)),
      filename,
      info.filesize,
      info.duration || 0,
      info.format,
      info.resolution || '1920x1080',
      info.bitrate || 0,
      thumbnail,
      'ready',
      ''
    );

    res.json({
      success: true,
      video: {
        id,
        title: req.body.title || path.basename(file.originalname, path.extname(file.originalname)),
        filename,
        ...info,
        thumbnail,
        uploadUrl: `/uploads/videos/${filename}`,
        streamUrl: `/api/video/${id}/stream`,
        embedUrl: `/embed/${id}`,
        createdAt: Date.now()
      }
    });
  });

  // Multipart upload for large files
  app.post('/api/upload/chunk', upload.single('chunk'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No chunk' });
    
    const { fileId, chunkIndex, totalChunks, filename } = req.body;
    
    if (chunkIndex >= totalChunks - 1) {
      // All chunks received, file is complete
      res.json({ success: true, complete: true, fileId });
    } else {
      res.json({ success: true, complete: false, fileId, chunkIndex: parseInt(chunkIndex) });
    }
  });
}
