const GAME_CONFIG = {
  defaultTime: 45,
  badShotCoefficient: 2,
  levels: [
    { name: 'Level 1: Warm Up', targetSize: 50, moveInterval: 0, goodShotCoefficient: 1 },
    { name: 'Level 2: Quick Aim', targetSize: 38, moveInterval: 1000, goodShotCoefficient: 2 },
    { name: 'Level 3: Snap Shot', targetSize: 28, moveInterval: 650, goodShotCoefficient: 3 }
  ]
};

const ui = {
  game: document.getElementById('game'),
  menu: document.getElementById('menu'),
  hud: document.getElementById('hud'),
  levelSelect: document.getElementById('levelSelect'),
  timeSelect: document.getElementById('timeSelect'),
  soundToggle: document.getElementById('soundToggle'),
  time: document.getElementById('time'),
  status: document.getElementById('status'),
  startBtn: document.getElementById('startBtn')
};

const gameState = {
  goodShots: 0,
  badShots: 0,
  timeLeft: GAME_CONFIG.defaultTime,
  levelIndex: 0,
  running: false,
  muted: false,
  countdownTimerId: null,
  moveTimerId: null,
  target: null,
  audioContext: null
};

function computeScore() {
  const level = GAME_CONFIG.levels[gameState.levelIndex];
  const goodPart = gameState.goodShots * level.goodShotCoefficient;
  const badPart = gameState.badShots * GAME_CONFIG.badShotCoefficient;
  return goodPart - badPart;
}

function clearTimers() {
  clearInterval(gameState.countdownTimerId);
  clearInterval(gameState.moveTimerId);
  gameState.countdownTimerId = null;
  gameState.moveTimerId = null;
}

function updateStats() {
  ui.time.textContent = String(gameState.timeLeft);
}

function setStatus(message) {
  ui.status.textContent = message;
}

function createAudioContextIfNeeded() {
  if (!gameState.audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) gameState.audioContext = new Ctx();
  }
}

function playTone(freq, durationMs, type, volume) {
  if (gameState.muted || !gameState.audioContext) return;

  const now = gameState.audioContext.currentTime;
  const oscillator = gameState.audioContext.createOscillator();
  const gain = gameState.audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

  oscillator.connect(gain);
  gain.connect(gameState.audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + durationMs / 1000 + 0.02);
}

function playHitSound() {
  playTone(660, 90, 'triangle', 0.08);
}

function playMissSound() {
  playTone(220, 120, 'sawtooth', 0.04);
}

function playLevelUpSound() {
  playTone(520, 120, 'square', 0.05);
  setTimeout(() => playTone(780, 140, 'square', 0.05), 120);
}

function playGameOverSound() {
  playTone(440, 100, 'triangle', 0.05);
  setTimeout(() => playTone(330, 110, 'triangle', 0.05), 110);
  setTimeout(() => playTone(220, 130, 'triangle', 0.05), 230);
}

function randomPosition(size) {
  const x = Math.random() * (ui.game.clientWidth - size);
  const y = Math.random() * (ui.game.clientHeight - size);
  return { x, y };
}

function positionTarget() {
  if (!gameState.target) return;

  const level = GAME_CONFIG.levels[gameState.levelIndex];
  const size = level.targetSize;
  const pos = randomPosition(size);

  gameState.target.style.width = size + 'px';
  gameState.target.style.height = size + 'px';
  gameState.target.style.left = pos.x + 'px';
  gameState.target.style.top = pos.y + 'px';
}

function ensureTarget() {
  if (gameState.target) return;

  const target = document.createElement('div');
  target.className = 'target';
  target.addEventListener('click', (event) => {
    if (!gameState.running) return;
    event.stopPropagation();

    gameState.goodShots += 1;
    updateStats();
    playHitSound();
    positionTarget();
  });

  gameState.target = target;
  ui.game.appendChild(target);
}

function applyLevel(newLevelIndex) {
  gameState.levelIndex = newLevelIndex;

  const level = GAME_CONFIG.levels[newLevelIndex];
  setStatus(level.name + ' ready.');
  positionTarget();

  clearInterval(gameState.moveTimerId);
  gameState.moveTimerId = null;

  if (level.moveInterval > 0) {
    gameState.moveTimerId = setInterval(positionTarget, level.moveInterval);
  }

  updateStats();
}

function requestFullscreenIfPossible() {
  const elem = document.documentElement;
  if (!document.fullscreenElement && elem.requestFullscreen) {
    return elem.requestFullscreen().catch(() => {
      setStatus('Fullscreen was blocked. You can allow it and try again.');
    });
  }

  return Promise.resolve();
}

function endGame() {
  gameState.running = false;
  clearTimers();
  playGameOverSound();

  const score = computeScore();

  const level = GAME_CONFIG.levels[gameState.levelIndex];
  const finalMessage =
    'Final score: ' + score +
    ' (Good: ' + gameState.goodShots + ' x ' + level.goodShotCoefficient +
    ' - Bad: ' + gameState.badShots + ' x ' + GAME_CONFIG.badShotCoefficient + ')';

  document.body.classList.remove('game-active');
  ui.game.innerHTML = '';
  gameState.target = null;
  setStatus(finalMessage);
  alert('Time up! ' + finalMessage);
}

async function startGame() {
  createAudioContextIfNeeded();
  if (gameState.audioContext && gameState.audioContext.state === 'suspended') {
    gameState.audioContext.resume();
  }

  const selectedLevel = Number(ui.levelSelect.value);
  const selectedTime = Number(ui.timeSelect.value);

  gameState.goodShots = 0;
  gameState.badShots = 0;
  gameState.timeLeft = selectedTime;
  gameState.levelIndex = selectedLevel;
  gameState.running = true;
  gameState.muted = !ui.soundToggle.checked;

  clearTimers();
  document.body.classList.add('game-active');
  ui.game.innerHTML = '';
  gameState.target = null;

  await requestFullscreenIfPossible();

  ensureTarget();
  applyLevel(selectedLevel);
  updateStats();

  gameState.countdownTimerId = setInterval(() => {
    gameState.timeLeft -= 1;

    if (gameState.timeLeft <= 0) {
      gameState.timeLeft = 0;
      updateStats();
      endGame();
      return;
    }

    updateStats();
  }, 1000);
}

ui.startBtn.addEventListener('click', startGame);

ui.game.addEventListener('click', () => {
  if (!gameState.running) return;
  gameState.badShots += 1;
  updateStats();
  playMissSound();
});
