import express from 'express';
import { getDB } from '../database.js';

export function setupDashboardRoutes(app) {
  app.get('/watch/live/:id', (req, res) => {
    const db = getDB();
    const stream = db.prepare('SELECT ls.*, c.name as categoryName FROM live_streams ls LEFT JOIN categories c ON ls.categoryId = c.id WHERE ls.id = ? AND ls.status = 1').get(req.params.id);
    if (!stream) return res.status(404).send('Stream not found');
    res.send(`<!DOCTYPE html><html><head><title>${stream.name}</title><style>body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh}video{max-width:100%;max-height:100vh}</style></head><body><video id="player" controls autoplay><source src="${stream.streamUrl}" type="application/vnd.apple.mpegurl"></video></body></html>`);
  });

  app.get('/watch/movie/:id', (req, res) => {
    const db = getDB();
    const movie = db.prepare('SELECT * FROM movies WHERE id = ? AND status = 1').get(req.params.id);
    if (!movie) return res.status(404).send('Movie not found');
    res.send(`<!DOCTYPE html><html><head><title>${movie.title}</title><style>body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh}video{max-width:100%;max-height:100vh}</style></head><body><video id="player" controls><source src="${movie.streamUrl}" type="video/mp4"></video></body></html>`);
  });
}
