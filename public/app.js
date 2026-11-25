const video = document.getElementById('camera');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const captureBtn = document.getElementById('captureBtn');
const intervalSelect = document.getElementById('interval');
const placeholder = document.getElementById('placeholder');
const notice = document.getElementById('notice');
let stream = null;
let timer = null;
let busy = false;
let totalDetections = 0;
let frameNumber = 0;
let lastPredictions = [];
let inferenceWidth = 960;
let inferenceHeight = 540;

function setStatus(status, foot) {
  document.getElementById('systemStatus').textContent = status;
  document.getElementById('statusFoot').textContent = foot;
}
function updateClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString('id-ID', { hour12: false });
}
setInterval(updateClock, 1000); updateClock();

function findPredictions(data) {
  const found = [];
  const seen = new Set();
  function walk(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 7 || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach(v => walk(v, depth + 1));
      return;
    }
    if (Array.isArray(value.predictions)) {
      value.predictions.forEach(p => {
        if (p && typeof p === 'object' && (p.x !== undefined || p.bounding_box || p.points)) found.push(p);
      });
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== 'predictions') walk(child, depth + 1);
    }
  }
  walk(data);
  return found;
}
function getBox(p) {
  if (p.bounding_box && typeof p.bounding_box === 'object') {
    const b = p.bounding_box;
    return { x: Number(b.x ?? b.left ?? 0), y: Number(b.y ?? b.top ?? 0), w: Number(b.width ?? b.w ?? 0), h: Number(b.height ?? b.h ?? 0) };
  }
  if (Array.isArray(p.points) && p.points.length >= 2) {
    const xs = p.points.map(q => Number(q.x)), ys = p.points.map(q => Number(q.y));
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  return { x: Number(p.x ?? 0), y: Number(p.y ?? 0), w: Number(p.width ?? p.w ?? 0), h: Number(p.height ?? p.h ?? 0) };
}
function drawPredictions(predictions) {
  const vw = inferenceWidth || video.videoWidth, vh = inferenceHeight || video.videoHeight;
  if (!vw || !vh) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  const scale = Math.min(rect.width / vw, rect.height / vh);
  const drawW = vw * scale, drawH = vh * scale;
  const offsetX = (rect.width - drawW) / 2, offsetY = (rect.height - drawH) / 2;
  predictions.forEach((p, i) => {
    const b = getBox(p);
    if (!(b.w > 0 && b.h > 0)) return;
    // Roboflow object detection coordinates are center-based x/y with width/height.
    const x1 = offsetX + (b.x - b.w / 2) * scale;
    const y1 = offsetY + (b.y - b.h / 2) * scale;
    const w = b.w * scale, h = b.h * scale;
    const label = String(p.class || p.class_name || p.label || 'object');
    const confidence = Number(p.confidence ?? p.score ?? 0);
    const color = ['#54ddd0', '#82a4ff', '#ffbd69', '#e68bff'][i % 4];
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(x1, y1, w, h);
    const text = `${label} ${(confidence * 100).toFixed(1)}%`;
    ctx.font = '600 11px Manrope, sans-serif';
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = color; ctx.fillRect(x1, Math.max(0, y1 - 23), tw + 12, 21);
    ctx.fillStyle = '#07111f'; ctx.fillText(text, x1 + 6, Math.max(14, y1 - 8));
  });
}
function renderResults(predictions) {
  const list = document.getElementById('resultsList');
  document.getElementById('currentObjects').textContent = predictions.length;
  document.getElementById('resultCount').textContent = `${predictions.length} RESULTS`;
  if (!predictions.length) {
    list.innerHTML = '<div class="empty-state"><div>⌕</div><b>No objects detected</b><span>No prediction returned for the latest frame.</span></div>';
    return;
  }
  list.innerHTML = predictions.map((p, i) => {
    const name = String(p.class || p.class_name || p.label || 'Object');
    const conf = Number(p.confidence ?? p.score ?? 0);
    const pct = (conf * 100).toFixed(1);
    const box = getBox(p);
    return `<div class="detection-row"><div class="detection-color" style="background:${['#54ddd0','#82a4ff','#ffbd69','#e68bff'][i%4]}"></div><div class="detection-main"><b>${escapeHtml(name)}</b><small>BOX ${Math.round(box.w)} × ${Math.round(box.h)} PX · #${String(i+1).padStart(2,'0')}</small></div><div class="confidence">${pct}%</div></div>`;
  }).join('');
}
function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
async function detectFrame() {
  if (busy || !stream || video.readyState < 2) return;
  busy = true; frameNumber++;
  try {
    const capture = document.createElement('canvas');
    const maxWidth = 960;
    const ratio = Math.min(1, maxWidth / video.videoWidth);
    capture.width = Math.round(video.videoWidth * ratio);
    capture.height = Math.round(video.videoHeight * ratio);
    inferenceWidth = capture.width; inferenceHeight = capture.height;
    capture.getContext('2d').drawImage(video, 0, 0, capture.width, capture.height);
    const image = capture.toDataURL('image/jpeg', 0.78);
    const started = performance.now();
    const response = await fetch('/api/detect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || data.details?.message || `HTTP ${response.status}`);
    const latency = Math.round(performance.now() - started);
    const predictions = findPredictions(data);
    totalDetections += predictions.length;
    lastPredictions = predictions;
    drawPredictions(predictions);
    renderResults(predictions);
    document.getElementById('totalDetections').textContent = totalDetections;
    document.getElementById('latency').textContent = latency;
    document.getElementById('frameInfo').textContent = `FRAME ${String(frameNumber).padStart(5,'0')}  /  ${predictions.length} OBJECTS`;
    setStatus('RUNNING', 'Inference request completed');
    notice.textContent = `Inference active. Frame ${frameNumber} processed; ${predictions.length} object(s) returned.`;
  } catch (error) {
    console.error(error);
    notice.textContent = `Detection error: ${error.message}. Check API key, workflow slug, and Roboflow workflow input configuration.`;
    setStatus('ERROR', 'Inference request failed');
  } finally { busy = false; }
}
async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Browser tidak mendukung akses kamera. Gunakan HTTPS dan browser modern.');
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }, audio: false });
    video.srcObject = stream;
    await video.play();
    placeholder.style.display = 'none';
    startBtn.disabled = true; stopBtn.disabled = false; captureBtn.disabled = false;
    document.getElementById('livePill').textContent = 'LIVE';
    document.getElementById('livePill').classList.add('on');
    document.getElementById('apiStatus').textContent = 'Camera stream active';
    setStatus('STARTING', 'Waiting for first inference');
    canvas.style.display = 'block';
    notice.textContent = 'Camera connected. Sending frames to Roboflow workflow.';
    await detectFrame();
    timer = setInterval(detectFrame, Number(intervalSelect.value));
  } catch (error) {
    notice.textContent = `Camera error: ${error.message}`;
    setStatus('ERROR', 'Camera initialization failed');
  }
}
function stopCamera() {
  if (timer) clearInterval(timer); timer = null;
  if (stream) stream.getTracks().forEach(track => track.stop()); stream = null;
  video.pause(); video.srcObject = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  placeholder.style.display = 'flex';
  startBtn.disabled = false; stopBtn.disabled = true; captureBtn.disabled = true;
  document.getElementById('livePill').textContent = 'OFFLINE';
  document.getElementById('livePill').classList.remove('on');
  document.getElementById('apiStatus').textContent = 'Ready for session';
  document.getElementById('frameInfo').textContent = 'WAITING FOR INPUT';
  setStatus('IDLE', 'Camera is not active');
  notice.textContent = 'Camera stopped. Start the camera to resume detection.';
}
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
captureBtn.addEventListener('click', () => {
  if (!video.videoWidth) return;
  const shot = document.createElement('canvas'); shot.width = video.videoWidth; shot.height = video.videoHeight;
  shot.getContext('2d').drawImage(video, 0, 0);
  const link = document.createElement('a'); link.download = `yolo26-capture-${Date.now()}.jpg`; link.href = shot.toDataURL('image/jpeg', .92); link.click();
});
intervalSelect.addEventListener('change', () => {
  if (timer) { clearInterval(timer); timer = setInterval(detectFrame, Number(intervalSelect.value)); }
});
window.addEventListener('beforeunload', () => { if (stream) stream.getTracks().forEach(t => t.stop()); });
