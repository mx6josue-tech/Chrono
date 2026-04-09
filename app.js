'use strict';

// ======================================================================
// DOM REFERENCES
// ======================================================================
const app             = document.getElementById('app');
const timeDisplay     = document.getElementById('time-display');
const btnPlayPause    = document.getElementById('btn-playpause');
const btnSettings     = document.getElementById('btn-settings');
const settingsModal   = document.getElementById('settings-modal');
const colorSwatches   = document.querySelectorAll('.swatch');
const customColorInput= document.getElementById('custom-color-input');
const brightnessSlider= document.getElementById('brightness-slider');
const brightnessLabel = document.getElementById('brightness-label');
const btnReset        = document.getElementById('btn-reset');
const btnClose        = document.getElementById('btn-close');
const toastEl         = document.getElementById('toast');
const portraitWarning = document.getElementById('portrait-warning');
const playpauseIcon   = document.getElementById('playpause-icon');
const bgUpload        = document.getElementById('bg-upload');
const btnClearBg      = document.getElementById('btn-clear-bg');

// ======================================================================
// STATE
// ======================================================================
const state = {
  isRunning:   false,
  startTime:   0,      // Date.now() at last play (adjusted for prior elapsed)
  elapsedMs:   0,      // Elapsed ms while paused
  color:       localStorage.getItem('neon-color')  || '#00ffff',
  brightness:  parseInt(localStorage.getItem('brightness') || '100', 10),
  wakeLock:    null,
  tickTimer:   null,
  // Double-tap reset confirmation
  resetPending: false,
  resetTimer:   null,
};

// ======================================================================
// TIMER  — Date.now()-based for suspension accuracy
// ======================================================================
function getElapsedMs() {
  return state.isRunning ? Date.now() - state.startTime : state.elapsedMs;
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return pad2(hours) + ':' + pad2(minutes) + ':' + pad2(seconds);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function tick() {
  timeDisplay.textContent = formatTime(getElapsedMs());
}

function startTimer() {
  if (state.isRunning) return;
  state.isRunning = true;
  state.startTime = Date.now() - state.elapsedMs;
  state.tickTimer = setInterval(tick, 1000);
  tick();
  updatePlayPauseBtn();
  acquireWakeLock();
  haptic([10]);
}

function pauseTimer() {
  if (!state.isRunning) return;
  state.isRunning = false;
  state.elapsedMs = Date.now() - state.startTime;
  clearInterval(state.tickTimer);
  tick();
  updatePlayPauseBtn();
  dropWakeLock();
  haptic([10, 30, 10]);
}

function resetTimer() {
  clearInterval(state.tickTimer);
  state.isRunning = false;
  state.elapsedMs = 0;
  state.startTime = 0;
  tick();
  updatePlayPauseBtn();
  dropWakeLock();
}

function toggleTimer() {
  state.isRunning ? pauseTimer() : startTimer();
}

// ======================================================================
// WAKE LOCK
// ======================================================================
async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    state.wakeLock = await navigator.wakeLock.request('screen');
    state.wakeLock.addEventListener('release', () => {
      state.wakeLock = null;
      // Re-acquire automatically if still running
      if (state.isRunning) acquireWakeLock();
    });
  } catch (err) {
    // Fails silently (e.g. battery saver mode, page not visible)
    console.warn('Wake Lock:', err.name, err.message);
  }
}

function dropWakeLock() {
  if (state.wakeLock) {
    state.wakeLock.release().catch(() => {});
    state.wakeLock = null;
  }
}

// Re-acquire when app returns to foreground
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.isRunning) {
    tick();            // Immediately sync display (covers suspensions)
    acquireWakeLock();
  }
});

// ======================================================================
// COLOR
// ======================================================================
function isValidColor(color) {
  return /^#[0-9A-F]{6}$/i.test(color);
}

function applyColor(color, persist = true) {
  if (!isValidColor(color)) {
    console.warn('Color inválido rechazado:', color);
    return;
  }
  state.color = color;
  document.documentElement.style.setProperty('--neon', color);

  // Sync slider track color
  syncSliderTrack();

  // Highlight matching swatch
  colorSwatches.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === color);
  });

  if (persist) localStorage.setItem('neon-color', color);
}

// ======================================================================
// BRIGHTNESS (simulated via CSS filter on #app)
// ======================================================================
function applyBrightness(value, persist = true) {
  state.brightness = value;
  brightnessLabel.textContent = value;
  brightnessSlider.value = value;
  app.style.filter = value < 100 ? `brightness(${value}%)` : '';
  syncSliderTrack();
  if (persist) localStorage.setItem('brightness', value);
}

// ======================================================================
// BACKGROUND IMAGE
// ======================================================================
function applyBackgroundImage(blob) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = e.target.result;
    document.documentElement.style.setProperty('--bg-image', `url(${data})`);
    try {
      localStorage.setItem('bg-image', data);
    } catch {
      showToast('Imagen guardada solo en sesión (storage lleno)');
      return;
    }
    showToast('Fondo actualizado ✓');
    haptic([5]);
  };
  reader.onerror = () => showToast('Error al leer la imagen');
  reader.readAsDataURL(blob);
}

function clearBackgroundImage() {
  document.documentElement.style.setProperty('--bg-image', 'none');
  localStorage.removeItem('bg-image');
  showToast('Fondo eliminado');
  haptic([5]);
}

function restoreBackgroundImage() {
  const saved = localStorage.getItem('bg-image');
  if (saved && /^data:image\/(jpeg|png|webp|gif);base64,/.test(saved)) {
    document.documentElement.style.setProperty('--bg-image', `url(${saved})`);
  } else if (saved) {
    // Dato inválido o corrompido — limpiar silenciosamente
    localStorage.removeItem('bg-image');
  }
}

function syncSliderTrack() {
  // Drive the slider's colored fill via a CSS custom property
  const min = parseInt(brightnessSlider.min, 10);
  const max = parseInt(brightnessSlider.max, 10);
  const val = parseInt(brightnessSlider.value, 10);
  const pct = ((val - min) / (max - min)) * 100;
  brightnessSlider.style.setProperty('--slider-fill', pct + '%');
}

// ======================================================================
// UI STATE
// ======================================================================
function updatePlayPauseBtn() {
  playpauseIcon.textContent = state.isRunning ? '⏸' : '▶';
  btnPlayPause.setAttribute('aria-label', state.isRunning ? 'Pausar' : 'Iniciar');
}

// ======================================================================
// FONT SIZING — fills ~70 % of the viewport
// ======================================================================
function fitStopwatch() {
  // Measure text dimensions at a known font size using a hidden probe element
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = [
    'position:fixed',
    'top:-9999px',
    'left:-9999px',
    'white-space:nowrap',
    'font:600 100px -apple-system,"SF Pro Display","Helvetica Neue",Helvetica,sans-serif',
    'letter-spacing:-0.03em',
    'font-variant-numeric:tabular-nums',
  ].join(';');
  probe.textContent = '00:00:00';
  document.body.appendChild(probe);

  const probeW = probe.offsetWidth  || 240;
  const probeH = probe.offsetHeight || 120;
  document.body.removeChild(probe);

  const targetW = window.innerWidth  * 0.70;
  const targetH = window.innerHeight * 0.72;

  const scale = Math.min(targetW / probeW, targetH / probeH);
  timeDisplay.style.fontSize = Math.floor(100 * scale) + 'px';
}

// ======================================================================
// SETTINGS MODAL
// ======================================================================
function openSettings() {
  settingsModal.classList.add('visible');
  settingsModal.setAttribute('aria-hidden', 'false');
}

function closeSettings() {
  settingsModal.classList.remove('visible');
  settingsModal.setAttribute('aria-hidden', 'true');
}

// ======================================================================
// TOAST
// ======================================================================
let _toastTimer = null;

function showToast(msg, duration = 2600) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}

// ======================================================================
// HAPTIC FEEDBACK
// ======================================================================
function haptic(pattern = [10]) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

// ======================================================================
// DOUBLE-TAP TO RESET (with 2-step toast confirmation)
// ======================================================================
(function setupDoubleTap() {
  let tapCount  = 0;
  let tapTimer  = null;

  timeDisplay.addEventListener('touchend', (e) => {
    // Ignore while modal is open
    if (settingsModal.classList.contains('visible')) return;
    e.preventDefault();

    tapCount++;
    if (tapCount === 1) {
      tapTimer = setTimeout(() => { tapCount = 0; }, 320);
    } else if (tapCount >= 2) {
      clearTimeout(tapTimer);
      tapCount = 0;
      handleDoubleTap();
    }
  }, { passive: false });
}());

function handleDoubleTap() {
  if (state.resetPending) {
    clearTimeout(state.resetTimer);
    state.resetPending = false;
    resetTimer();
    showToast('Reiniciado ✓');
    haptic([10, 60, 10]);
  } else {
    state.resetPending = true;
    showToast('Toca dos veces para reiniciar');
    state.resetTimer = setTimeout(() => {
      state.resetPending = false;
    }, 3000);
  }
}

// ======================================================================
// ORIENTATION CHECK
// ======================================================================
function checkOrientation() {
  const isPortrait = window.innerHeight > window.innerWidth;
  portraitWarning.style.display = isPortrait ? 'flex' : 'none';
  if (!isPortrait) fitStopwatch();
}

// ======================================================================
// SERVICE WORKER REGISTRATION
// ======================================================================
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(err => {
    console.warn('SW registration failed:', err);
  });
}

// ======================================================================
// EVENT LISTENERS
// ======================================================================
function setupEvents() {
  btnPlayPause.addEventListener('click', toggleTimer);
  btnSettings.addEventListener('click', openSettings);
  btnClose.addEventListener('click', closeSettings);

  // Close on backdrop tap
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  // Color swatches
  colorSwatches.forEach(btn => {
    btn.addEventListener('click', () => {
      applyColor(btn.dataset.color);
      customColorInput.value = btn.dataset.color;
      haptic([5]);
    });
  });

  // Custom color picker
  customColorInput.addEventListener('input', () => {
    applyColor(customColorInput.value);
  });

  // Brightness slider
  brightnessSlider.addEventListener('input', () => {
    applyBrightness(parseInt(brightnessSlider.value, 10));
  });

  // Reset button inside settings
  btnReset.addEventListener('click', () => {
    resetTimer();
    closeSettings();
    showToast('Reiniciado ✓');
    haptic([10, 60, 10]);
  });

  // Background image upload
  bgUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      showToast('Solo PNG, JPG, WebP o GIF');
      bgUpload.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Imagen muy grande (máx. 5 MB)');
      bgUpload.value = '';
      return;
    }
    applyBackgroundImage(file);
    bgUpload.value = '';
  });

  btnClearBg.addEventListener('click', clearBackgroundImage);

  // Orientation
  window.addEventListener('resize', () => checkOrientation());
  window.addEventListener('orientationchange', () => {
    setTimeout(checkOrientation, 120); // iOS needs a brief delay
  });
}

// ======================================================================
// INIT
// ======================================================================
function init() {
  registerSW();

  // Restore preferences
  brightnessSlider.value = state.brightness;
  customColorInput.value = state.color;
  applyColor(state.color, false);
  applyBrightness(state.brightness, false);

  // Render initial time
  tick();
  fitStopwatch();
  checkOrientation();

  setupEvents();
  restoreBackgroundImage();
}

document.addEventListener('DOMContentLoaded', init);
