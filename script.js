 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/script.js b/script.js
new file mode 100644
index 0000000000000000000000000000000000000000..afbdb2b4a055ce72206a1f50e4dfe0217ffebcee
--- /dev/null
+++ b/script.js
@@ -0,0 +1,476 @@
+const canvas = document.getElementById("playfield");
+const ctx = canvas.getContext("2d");
+
+const scoreLabel = document.getElementById("score");
+const comboLabel = document.getElementById("combo");
+const accuracyLabel = document.getElementById("accuracy");
+const startButton = document.getElementById("start-button");
+const resultDialog = document.getElementById("result-dialog");
+const restartButton = document.getElementById("restart-button");
+const resultScore = document.getElementById("result-score");
+const resultAccuracy = document.getElementById("result-accuracy");
+const resultCombo = document.getElementById("result-combo");
+const audioInput = document.getElementById("audio-file");
+const audioStatus = document.getElementById("audio-status");
+
+const AudioContextClass = window.AudioContext || window.webkitAudioContext;
+
+const LANES = ["d", "f", "j", "k"];
+const LANE_WIDTH = 100;
+const LANE_GAP = 10;
+const NOTE_HEIGHT = 28;
+const HIT_LINE_Y = canvas.height - 100;
+const SCROLL_SPEED = 360; // pixels / seconde
+const LOOKAHEAD = 2.5; // secondes
+
+const TIMING_WINDOWS = {
+  perfect: 55,
+  great: 95,
+  good: 140,
+};
+const SCORE_VALUES = { perfect: 300, great: 150, good: 60 };
+
+const laneColors = getComputedStyle(document.documentElement)
+  .getPropertyValue("--lane-colors")
+  .split(",")
+  .map((color) => color.trim());
+
+const laneStates = new Map(LANES.map((key) => [key, { pressed: false, flashUntil: 0 }]));
+
+const state = {
+  startTime: 0,
+  activeNotes: [],
+  pendingNotes: [],
+  animationFrame: 0,
+  running: false,
+  score: 0,
+  combo: 0,
+  bestCombo: 0,
+  totalNotes: 0,
+  successfulHits: 0,
+  lastJudgement: null,
+  lastJudgementTime: 0,
+};
+
+const audioState = {
+  context: null,
+  buffer: null,
+  source: null,
+  startTime: 0,
+  name: "",
+};
+
+class Note {
+  constructor(lane, time) {
+    this.lane = lane;
+    this.time = time;
+    this.hit = false;
+    this.missed = false;
+  }
+
+  get x() {
+    const laneIndex = LANES.indexOf(this.lane);
+    const totalWidth = LANES.length * LANE_WIDTH + (LANES.length - 1) * LANE_GAP;
+    const startX = (canvas.width - totalWidth) / 2;
+    return startX + laneIndex * (LANE_WIDTH + LANE_GAP);
+  }
+
+  get y() {
+    const elapsed = getElapsed();
+    const timeUntilHit = this.time - elapsed;
+    return HIT_LINE_Y - timeUntilHit * SCROLL_SPEED;
+  }
+}
+
+function getElapsed() {
+  return (performance.now() - state.startTime) / 1000;
+}
+
+function createDemoChart() {
+  const bpm = 120;
+  const beat = 60 / bpm;
+  const chart = [];
+  const patterns = [
+    ["d", "j"],
+    ["f"],
+    ["k"],
+    ["d", "f"],
+    ["j", "k"],
+    ["f"],
+    ["d"],
+    ["k"],
+  ];
+
+  for (let measure = 0; measure < 16; measure++) {
+    const baseTime = measure * 4 * beat;
+    for (let step = 0; step < 8; step++) {
+      const pattern = patterns[(measure + step) % patterns.length];
+      const time = baseTime + step * (beat / 2);
+      for (const lane of pattern) {
+        chart.push(new Note(lane, time));
+      }
+    }
+  }
+
+  chart.sort((a, b) => a.time - b.time);
+  return chart;
+}
+
+function resetGame() {
+  cancelAnimationFrame(state.animationFrame);
+  stopAudio();
+  state.pendingNotes = createDemoChart();
+  state.activeNotes = [];
+  state.startTime = 0;
+  state.running = false;
+  state.score = 0;
+  state.combo = 0;
+  state.bestCombo = 0;
+  state.totalNotes = state.pendingNotes.length;
+  state.successfulHits = 0;
+  state.lastJudgement = null;
+  state.lastJudgementTime = 0;
+  updateHud();
+  clearCanvas();
+}
+
+async function startGame() {
+  if (state.running) return;
+  if (resultDialog.open) resultDialog.close();
+  resetGame();
+  laneStates.forEach((lane) => {
+    lane.pressed = false;
+    lane.flashUntil = 0;
+  });
+  if (audioState.buffer) {
+    try {
+      await playAudio();
+      updateAudioStatus(
+        audioState.name ? `Lecture : ${audioState.name}` : "Lecture en cours"
+      );
+    } catch (error) {
+      console.error("Impossible de démarrer l'audio", error);
+      updateAudioStatus("Erreur lors de la lecture de l'audio");
+    }
+  }
+  state.running = true;
+  state.startTime = performance.now();
+  state.animationFrame = requestAnimationFrame(loop);
+}
+
+function loop() {
+  if (!state.running) return;
+  spawnNotes();
+  updateNotes();
+  render();
+  removeMissedNotes();
+
+  if (state.pendingNotes.length === 0 && state.activeNotes.length === 0) {
+    endGame();
+    return;
+  }
+
+  state.animationFrame = requestAnimationFrame(loop);
+}
+
+function spawnNotes() {
+  const elapsed = getElapsed();
+  while (state.pendingNotes.length && state.pendingNotes[0].time - elapsed <= LOOKAHEAD) {
+    state.activeNotes.push(state.pendingNotes.shift());
+  }
+}
+
+function updateNotes() {
+  const now = performance.now();
+  for (const laneState of laneStates.values()) {
+    if (laneState.flashUntil && laneState.flashUntil < now) {
+      laneState.flashUntil = 0;
+    }
+  }
+}
+
+function removeMissedNotes() {
+  const elapsed = getElapsed();
+  const missWindow = TIMING_WINDOWS.good / 1000 + 0.1;
+  state.activeNotes = state.activeNotes.filter((note) => {
+    if (note.hit) return false;
+    if (note.missed) return false;
+
+    const diff = elapsed - note.time;
+    if (diff > missWindow) {
+      note.missed = true;
+      state.combo = 0;
+      state.lastJudgement = "Raté";
+      state.lastJudgementTime = performance.now();
+      return false;
+    }
+    return true;
+  });
+}
+
+function render() {
+  clearCanvas();
+  drawLanes();
+  drawNotes();
+  drawJudgement();
+}
+
+function clearCanvas() {
+  ctx.clearRect(0, 0, canvas.width, canvas.height);
+}
+
+function drawLanes() {
+  const totalWidth = LANES.length * LANE_WIDTH + (LANES.length - 1) * LANE_GAP;
+  const startX = (canvas.width - totalWidth) / 2;
+
+  LANES.forEach((lane, index) => {
+    const x = startX + index * (LANE_WIDTH + LANE_GAP);
+    const laneState = laneStates.get(lane);
+    const flashProgress = laneState.flashUntil
+      ? Math.max(0, (laneState.flashUntil - performance.now()) / 120)
+      : 0;
+
+    const gradient = ctx.createLinearGradient(x, 0, x + LANE_WIDTH, 0);
+    gradient.addColorStop(0, laneColors[index % laneColors.length] + "33");
+    gradient.addColorStop(0.5, laneColors[index % laneColors.length] + "55");
+    gradient.addColorStop(1, laneColors[index % laneColors.length] + "33");
+
+    ctx.fillStyle = gradient;
+    ctx.fillRect(x, 0, LANE_WIDTH, canvas.height);
+
+    if (flashProgress > 0) {
+      ctx.fillStyle = `rgba(255, 255, 255, ${flashProgress.toFixed(2)})`;
+      ctx.fillRect(x, HIT_LINE_Y - 60, LANE_WIDTH, 120);
+    }
+
+    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
+    ctx.lineWidth = 2;
+    ctx.strokeRect(x, 0, LANE_WIDTH, canvas.height);
+  });
+
+  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
+  ctx.fillRect(
+    (canvas.width - totalWidth) / 2,
+    HIT_LINE_Y,
+    totalWidth,
+    4
+  );
+}
+
+function drawNotes() {
+  for (const note of state.activeNotes) {
+    const y = note.y;
+    if (y > canvas.height || y + NOTE_HEIGHT < 0) continue;
+    const laneIndex = LANES.indexOf(note.lane);
+    const color = laneColors[laneIndex % laneColors.length];
+    const x = note.x;
+
+    ctx.fillStyle = color;
+    ctx.shadowColor = color;
+    ctx.shadowBlur = 12;
+    ctx.fillRect(x + 12, y, LANE_WIDTH - 24, NOTE_HEIGHT);
+    ctx.shadowBlur = 0;
+  }
+}
+
+function drawJudgement() {
+  if (!state.lastJudgement) return;
+  const timeSince = performance.now() - state.lastJudgementTime;
+  if (timeSince > 700) return;
+  const opacity = 1 - timeSince / 700;
+  ctx.save();
+  ctx.globalAlpha = opacity;
+  ctx.fillStyle = "white";
+  ctx.font = "bold 36px 'Fira Sans', sans-serif";
+  ctx.textAlign = "center";
+  ctx.fillText(state.lastJudgement, canvas.width / 2, HIT_LINE_Y - 120);
+  ctx.restore();
+}
+
+function handleHit(lane) {
+  if (!state.running) return;
+  const elapsed = getElapsed();
+  const laneNotes = state.activeNotes.filter((note) => note.lane === lane && !note.hit);
+  if (laneNotes.length === 0) {
+    registerMiss();
+    return;
+  }
+
+  const note = laneNotes.reduce((closest, current) => {
+    const diffCurrent = Math.abs((current.time - elapsed) * 1000);
+    const diffClosest = Math.abs((closest.time - elapsed) * 1000);
+    return diffCurrent < diffClosest ? current : closest;
+  });
+
+  const timeDiffMs = (elapsed - note.time) * 1000;
+  const absDiff = Math.abs(timeDiffMs);
+
+  if (absDiff <= TIMING_WINDOWS.perfect) {
+    registerHit(note, "Parfait !");
+    addScore("perfect");
+  } else if (absDiff <= TIMING_WINDOWS.great) {
+    registerHit(note, "Super !");
+    addScore("great");
+  } else if (absDiff <= TIMING_WINDOWS.good) {
+    registerHit(note, "Bien");
+    addScore("good");
+  } else {
+    registerMiss();
+    return;
+  }
+
+  note.hit = true;
+  state.activeNotes = state.activeNotes.filter((n) => n !== note);
+  laneStates.get(lane).flashUntil = performance.now() + 120;
+  updateHud();
+}
+
+function registerHit(note, judgement) {
+  state.successfulHits += 1;
+  state.combo += 1;
+  state.bestCombo = Math.max(state.bestCombo, state.combo);
+  state.lastJudgement = judgement;
+  state.lastJudgementTime = performance.now();
+  note.hit = true;
+}
+
+function addScore(window) {
+  state.score += SCORE_VALUES[window];
+}
+
+function registerMiss() {
+  state.combo = 0;
+  state.lastJudgement = "Raté";
+  state.lastJudgementTime = performance.now();
+}
+
+function updateHud() {
+  scoreLabel.textContent = state.score.toString();
+  comboLabel.textContent = state.combo.toString();
+  const accuracy = state.totalNotes
+    ? Math.round((state.successfulHits / state.totalNotes) * 100)
+    : 100;
+  accuracyLabel.textContent = `${accuracy}%`;
+}
+
+function endGame() {
+  state.running = false;
+  cancelAnimationFrame(state.animationFrame);
+  stopAudio();
+  if (audioState.name) {
+    updateAudioStatus(`Prêt : ${audioState.name}`);
+  }
+  updateHud();
+  const accuracy = state.totalNotes
+    ? Math.round((state.successfulHits / state.totalNotes) * 100)
+    : 100;
+  resultScore.textContent = `Score final : ${state.score}`;
+  resultAccuracy.textContent = `Précision : ${accuracy}%`;
+  resultCombo.textContent = `Meilleur combo : ${state.bestCombo}`;
+  resultDialog.showModal();
+}
+
+function handleKeydown(event) {
+  const key = event.key.toLowerCase();
+  if (!LANES.includes(key)) return;
+  event.preventDefault();
+  handleHit(key);
+}
+
+function handleKeyup(event) {
+  const key = event.key.toLowerCase();
+  if (!LANES.includes(key)) return;
+  event.preventDefault();
+  laneStates.get(key).pressed = false;
+}
+
+startButton.addEventListener("click", startGame);
+restartButton.addEventListener("click", startGame);
+window.addEventListener("keydown", handleKeydown);
+window.addEventListener("keyup", handleKeyup);
+
+if (audioInput) {
+  audioInput.addEventListener("change", handleAudioSelection);
+}
+
+resetGame();
+
+function ensureAudioContext() {
+  if (!AudioContextClass) {
+    throw new Error("AudioContext non pris en charge par ce navigateur");
+  }
+  if (!audioState.context) {
+    audioState.context = new AudioContextClass();
+  }
+  return audioState.context;
+}
+
+function stopAudio() {
+  if (audioState.source) {
+    try {
+      audioState.source.stop();
+    } catch (error) {
+      console.warn("Erreur lors de l'arrêt de l'audio", error);
+    }
+    audioState.source.disconnect();
+    audioState.source = null;
+  }
+}
+
+async function handleAudioSelection(event) {
+  const file = event.target.files?.[0];
+  stopAudio();
+  if (!file) {
+    audioState.buffer = null;
+    audioState.name = "";
+    updateAudioStatus("Aucun fichier chargé");
+    return;
+  }
+
+  updateAudioStatus("Chargement...");
+
+  try {
+    const context = ensureAudioContext();
+    const arrayBuffer = await file.arrayBuffer();
+    const buffer = await decodeAudioBuffer(context, arrayBuffer);
+    audioState.buffer = buffer;
+    audioState.name = file.name;
+    updateAudioStatus(`Prêt : ${file.name}`);
+  } catch (error) {
+    console.error("Erreur de chargement de l'audio", error);
+    audioState.buffer = null;
+    audioState.name = "";
+    updateAudioStatus("Échec du chargement du fichier audio");
+  }
+}
+
+async function playAudio() {
+  if (!audioState.buffer) return;
+  const context = ensureAudioContext();
+  stopAudio();
+  if (context.state === "suspended") {
+    await context.resume();
+  }
+
+  const source = context.createBufferSource();
+  source.buffer = audioState.buffer;
+  source.connect(context.destination);
+  source.start();
+  audioState.source = source;
+  audioState.startTime = context.currentTime;
+}
+
+function decodeAudioBuffer(context, arrayBuffer) {
+  if (context.decodeAudioData.length === 1) {
+    return context.decodeAudioData(arrayBuffer);
+  }
+  return new Promise((resolve, reject) => {
+    context.decodeAudioData(arrayBuffer, resolve, reject);
+  });
+}
+
+function updateAudioStatus(message) {
+  if (audioStatus) {
+    audioStatus.textContent = message;
+  }
+}
 
EOF
)
