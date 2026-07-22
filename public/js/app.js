// Stream Hub - Professional RTMP Platform
// ==========================================

const API = '';
let currentPage = 'dashboard';
let allStreams = [];
let allVideos = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboard();
  setupUploadZone();
  checkHealth();
  // Auto-refresh every 30s
  setInterval(loadDashboard, 30000);
});

// Health Check
async function checkHealth() {
  try {
    const res = await fetch(`${API}/api/health`);
    const data = await res.json();
    if (data.status === 'healthy') {
      document.getElementById('statusDot').className = 'status-dot online';
      document.getElementById('statusText').textContent = 'Online';
    }
  } catch (e) {
    document.getElementById('statusDot').className = 'status-dot offline';
    document.getElementById('statusText').textContent = 'Offline';
  }
}

// Navigation
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  const titles = {
    dashboard: 'Dashboard', streams: 'Live Streams', upload: 'Upload Video',
    videos: 'Video Library', analytics: 'Analytics', restream: 'Multi-Restream', settings: 'Settings'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  currentPage = page;

  if (page === 'streams') loadStreams();
  if (page === 'videos') loadVideos();
  if (page === 'analytics') loadAnalytics();
  if (page === 'restream') loadRestreamTargets();
  if (page === 'settings') loadSettings();
}

// Toggle Sidebar (mobile)
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// Dashboard
async function loadDashboard() {
  try {
    const res = await fetch(`${API}/api/dashboard`);
    const data = await res.json();
    document.getElementById('statLive').textContent = data.overview.liveStreams;
    document.getElementById('statVideos').textContent = data.overview.totalVideos;
    document.getElementById('statViewers').textContent = data.overview.totalViewers;
    document.getElementById('statStorage').textContent = data.overview.totalStorage;

    const indicator = document.getElementById('liveIndicator');
    if (data.overview.liveStreams > 0) {
      indicator.style.display = 'flex';
      document.getElementById('liveBadge').style.display = 'inline';
      document.getElementById('liveBadge').textContent = data.overview.liveStreams;
    } else {
      indicator.style.display = 'none';
      document.getElementById('liveBadge').style.display = 'none';
    }

    // Render live streams on dashboard
    const container = document.getElementById('dashboardStreams');
    if (data.liveStreams.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📡</div><p>No active streams</p><span>Start your first live stream</span></div>';
    } else {
      container.innerHTML = data.liveStreams.map(s => renderStreamItem(s)).join('');
    }

    // System stats
    if (data.system) {
      document.getElementById('cpuBar').style.width = `${Math.min(data.overview.cpu * 100, 100)}%`;
      document.getElementById('cpuValue').textContent = `${Math.round(data.overview.cpu * 100)}%`;
      document.getElementById('memValue').textContent = data.overview.memoryUsed;
      document.getElementById('uptimeValue').textContent = formatUptime(data.overview.uptime);
    }
  } catch (e) { console.log('Dashboard error:', e); }
}

// Streams
async function loadStreams() {
  try {
    const res = await fetch(`${API}/api/streams`);
    const data = await res.json();
    allStreams = data.streams || [];
    renderStreams(allStreams);
  } catch (e) {}
}

function renderStreams(streams) {
  const container = document.getElementById('streamsList');
  if (!streams.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📡</div><p>No streams created yet</p><span>Create your first stream to get started</span></div>';
    return;
  }
  container.innerHTML = streams.map(s => renderStreamItem(s)).join('');
}

function renderStreamItem(s) {
  const isLive = s.isLive === 1 || s.isLive === true;
  return `
    <div class="stream-item ${isLive ? 'is-live' : ''}">
      <div class="stream-preview ${isLive ? 'is-live' : ''}">
        ${isLive ? '🔴' : '⏺️'}
        ${isLive ? '<span style="position:absolute;bottom:4px;left:4px;background:#ef4444;color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700">LIVE</span>' : ''}
      </div>
      <div class="stream-info">
        <div class="stream-name">${s.name}</div>
        <div class="stream-meta">
          <span class="status-badge ${isLive ? 'live' : 'offline'}">${isLive ? '● Live' : '○ Offline'}</span>
          ${isLive ? `<span>${s.viewers || 0} viewers</span>` : ''}
          <span>${s.resolution || '1920x1080'}</span>
        </div>
      </div>
      <div class="stream-actions">
        <button class="btn btn-secondary btn-sm" onclick="showStreamDetails('${s.id}')">Details</button>
        ${isLive ? `<button class="btn btn-danger btn-sm" onclick="stopStream('${s.id}')">Stop</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="deleteStream('${s.id}')">🗑</button>
      </div>
    </div>
  `;
}

function filterStreams(query) {
  const filtered = allStreams.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
  renderStreams(filtered);
}

// Create Stream
function showCreateStream() {
  document.getElementById('streamModal').classList.add('active');
  document.getElementById('streamResult').style.display = 'none';
}

function closeStreamModal() {
  document.getElementById('streamModal').classList.remove('active');
}

async function createStream() {
  const name = document.getElementById('streamName').value;
  const description = document.getElementById('streamDesc').value;
  const chatEnabled = document.getElementById('chatEnabled').checked;
  const recordEnabled = document.getElementById('recordEnabled').checked;

  if (!name) return showToast('Please enter a stream name', 'error');

  try {
    const res = await fetch(`${API}/api/streams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, chatEnabled, recordEnabled })
    });
    const data = await res.json();
    if (data.success) {
      const s = data.stream;
      document.getElementById('resultRtmp').textContent = s.rtmpUrlExternal;
      document.getElementById('resultKey').textContent = s.streamKey;
      document.getElementById('resultHls').textContent = `${window.location.origin}${s.hlsUrl}`;
      document.getElementById('resultEmbed').textContent = `${window.location.origin}${s.embedUrl}`;
      document.getElementById('streamResult').style.display = 'block';
      showToast('Stream created successfully!', 'success');
      loadStreams();
      loadDashboard();
    }
  } catch (e) { showToast('Failed to create stream', 'error'); }
}

function copyAllStreamInfo() {
  const rtmp = document.getElementById('resultRtmp').textContent;
  const key = document.getElementById('resultKey').textContent;
  navigator.clipboard.writeText(`RTMP: ${rtmp}\nKey: ${key}`);
  showToast('Copied to clipboard!', 'success');
}

async function showStreamDetails(id) {
  try {
    const res = await fetch(`${API}/api/streams/${id}`);
    const data = await res.json();
    const s = data;
    const info = `Stream: ${s.name}\nRTMP: ${s.rtmpUrl}\nKey: ${s.streamKey}\nHLS: ${window.location.origin}${s.hlsUrl}\nEmbed: ${window.location.origin}${s.embedUrl}`;
    
    // Show in a modal-like way
    document.getElementById('streamModal').classList.add('active');
    document.getElementById('streamResult').style.display = 'block';
    document.getElementById('resultRtmp').textContent = s.rtmpUrl;
    document.getElementById('resultKey').textContent = s.streamKey;
    document.getElementById('resultHls').textContent = `${window.location.origin}${s.hlsUrl}`;
    document.getElementById('resultEmbed').textContent = `${window.location.origin}${s.embedUrl}`;
  } catch (e) {}
}

async function stopStream(id) {
  await fetch(`${API}/api/streams/${id}/stop`, { method: 'POST' });
  showToast('Stream stopped', 'success');
  loadStreams();
  loadDashboard();
}

async function deleteStream(id) {
  if (!confirm('Delete this stream?')) return;
  await fetch(`${API}/api/streams/${id}`, { method: 'DELETE' });
  showToast('Stream deleted', 'success');
  loadStreams();
  loadDashboard();
}

// Upload
function setupUploadZone() {
  const zone = document.getElementById('uploadZone');
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      uploadFile(file);
    }
  });
  zone.addEventListener('click', e => {
    if (e.target.closest('.upload-progress')) return;
    document.getElementById('fileInput').click();
  });
}

function handleUpload(event) {
  const file = event.target.files[0];
  if (file) uploadFile(file);
}

function uploadFile(file) {
  const formData = new FormData();
  formData.append('video', file);
  const title = document.getElementById('uploadTitle')?.value || '';
  if (title) formData.append('title', title);

  const progress = document.getElementById('uploadProgress');
  const fill = document.getElementById('progressFill');
  const percent = document.getElementById('uploadPercent');
  const fileName = document.getElementById('uploadFileName');
  const speed = document.getElementById('uploadSpeed');
  const eta = document.getElementById('uploadETA');

  progress.style.display = 'block';
  fileName.textContent = file.name;

  const xhr = new XMLHttpRequest();
  const startTime = Date.now();

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = (e.loaded / e.total) * 100;
      fill.style.width = `${pct}%`;
      percent.textContent = `${Math.round(pct)}%`;
      const elapsed = (Date.now() - startTime) / 1000;
      const speedMB = (e.loaded / 1024 / 1024) / elapsed;
      speed.textContent = `${speedMB.toFixed(1)} MB/s`;
      const remaining = (e.total - e.loaded) / (speedMB * 1024 * 1024);
      eta.textContent = remaining > 0 ? `~${Math.ceil(remaining)}s remaining` : 'Almost done...';
    }
  };

  xhr.onload = () => {
    if (xhr.status === 200) {
      showToast('Video uploaded successfully!', 'success');
      fill.style.width = '100%';
      percent.textContent = '100%';
      speed.textContent = 'Complete';
      eta.textContent = '';
      setTimeout(() => {
        progress.style.display = 'none';
        fill.style.width = '0%';
      }, 2000);
      loadDashboard();
    } else {
      showToast('Upload failed', 'error');
      progress.style.display = 'none';
    }
  };

  xhr.open('POST', `${API}/api/upload`);
  xhr.send(formData);
}

// Videos
async function loadVideos() {
  try {
    const res = await fetch(`${API}/api/videos`);
    const data = await res.json();
    allVideos = data.videos || [];
    renderVideos(allVideos);
  } catch (e) {}
}

function renderVideos(videos) {
  const container = document.getElementById('videosGrid');
  if (!videos.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🎬</div><p>No videos uploaded yet</p><span>Upload your first video to get started</span></div>';
    return;
  }
  container.innerHTML = videos.map(v => `
    <div class="video-card" onclick="playVideo('${v.id}', 'vod')">
      <div class="video-thumb">
        ${v.thumbnail ? `<img src="${v.thumbnail}" alt="${v.title}" loading="lazy">` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:36px;color:var(--text-muted)">🎬</div>'}
        <span class="video-duration">${formatDuration(v.duration)}</span>
      </div>
      <div class="video-info">
        <div class="video-title">${v.title}</div>
        <div class="video-meta">
          <span>${v.views || 0} views</span>
          <span>${v.resolution || ''}</span>
          <span>${new Date(v.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  `).join('');
}

async function searchVideos(query) {
  if (!query) { loadVideos(); return; }
  try {
    const res = await fetch(`${API}/api/videos?search=${encodeURIComponent(query)}`);
    const data = await res.json();
    renderVideos(data.videos || []);
  } catch (e) {}
}

async function playVideo(id, type) {
  let src = '';
  let title = '';
  let info = '';

  if (type === 'vod') {
    const video = allVideos.find(v => v.id === id);
    src = video?.url || `/uploads/videos/${id}`;
    title = video?.title || 'Video';
    info = `${video?.views || 0} views • ${video?.resolution || ''} • ${formatDuration(video?.duration)}`;
  } else {
    // Live stream
    const stream = allStreams.find(s => s.id === id);
    src = `/hls/live/${stream?.streamKey}/index.m3u8`;
    title = stream?.name || 'Live';
    info = `${stream?.viewers || 0} viewers • ${stream?.resolution || ''}`;
  }

  const modal = document.getElementById('playerModal');
  const player = document.getElementById('videoPlayer');
  const details = document.getElementById('playerDetails');
  player.src = src;
  details.innerHTML = `<strong>${title}</strong><br><span style="color:var(--text-muted)">${info}</span>`;
  modal.classList.add('active');
  player.play().catch(() => {});
}

function closePlayer() {
  const modal = document.getElementById('playerModal');
  const player = document.getElementById('videoPlayer');
  player.pause();
  player.src = '';
  modal.classList.remove('active');
}

// Analytics
async function loadAnalytics() {
  try {
    const res = await fetch(`${API}/api/dashboard`);
    const data = await res.json();
    document.getElementById('analyticsUptime').textContent = formatUptime(data.overview.uptime);
    document.getElementById('analyticsPeak').textContent = data.overview.totalViewers;
    document.getElementById('analyticsWatchTime').textContent = `${Math.round(data.overview.uptime / 3600)}h`;

    const container = document.getElementById('analyticsList');
    if (data.liveStreams.length) {
      container.innerHTML = data.liveStreams.map((s, i) => `
        <div class="stream-item">
          <div class="stream-preview">${s.isLive ? '🔴' : '⏺️'}</div>
          <div class="stream-info">
            <div class="stream-name">${s.name}</div>
            <div class="stream-meta">
              <span>${s.viewers || 0} viewers</span>
              <span>${s.bitrate || 0} kbps</span>
              <span>${s.resolution || '1920x1080'}</span>
            </div>
          </div>
          <div class="stream-actions">
            <button class="btn btn-secondary btn-sm" onclick="playVideo('${s.id}', 'live')">Watch</button>
          </div>
        </div>
      `).join('');
    }
  } catch (e) {}
}

// Multi-Restream
async function loadRestreamTargets() {
  try {
    const res = await fetch(`${API}/api/streams`);
    const data = await res.json();
    const container = document.getElementById('restreamTargets');
    const streams = data.streams || [];

    let html = '';
    for (const s of streams) {
      html += `<div class="stream-item">
        <div class="stream-info">
          <div class="stream-name">${s.name}</div>
          <div class="stream-meta"><span>${s.restreamTargets?.length || 0} targets</span></div>
        </div>
        <div class="stream-actions">
          <button class="btn btn-primary btn-sm" onclick="addTarget('${s.id}')">Add Target</button>
        </div>
      </div>`;
    }
    container.innerHTML = html || '<div class="empty-state"><div class="empty-icon">🌐</div><p>No streams with restream targets</p><span>Create a stream first, then add targets</span></div>';
  } catch (e) {}
}

async function addTarget(streamId) {
  const platform = prompt('Platform name (YouTube, Twitch, Facebook, etc.):');
  if (!platform) return;
  const name = prompt('Target name:');
  if (!name) return;
  const rtmpUrl = prompt('RTMP URL (e.g., rtmp://a.rtmp.youtube.com/live2):');
  if (!rtmpUrl) return;
  const streamKey = prompt('Stream Key:');
  if (!streamKey) return;

  try {
    await fetch(`${API}/api/streams/${streamId}/targets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, name, rtmpUrl, streamKey })
    });
    showToast('Restream target added!', 'success');
    loadRestreamTargets();
  } catch (e) { showToast('Failed to add target', 'error'); }
}

// Settings
async function loadSettings() {
  try {
    const res = await fetch(`${API}/api/dashboard`);
    const data = await res.json();
    if (data.system) {
      document.getElementById('nodeVersion').textContent = data.system.nodeVersion;
    }
  } catch (e) {}
}

// Copy Code
function copyCode(btn) {
  const code = btn.parentElement.querySelector('code');
  navigator.clipboard.writeText(code.textContent);
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy', 2000);
}

// Toast
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Helpers
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
}

function formatUptime(seconds) {
  if (!seconds) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
