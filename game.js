const COLS = 10;
const ROWS = 20;
const CELL = 30;
const PREVIEW = 24;

const boardCanvas = document.querySelector("#board");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.querySelector("#next");
const nextCtx = nextCanvas.getContext("2d");
const holdCanvas = document.querySelector("#hold");
const holdCtx = holdCanvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const linesEl = document.querySelector("#lines");
const levelEl = document.querySelector("#level");
const bestEl = document.querySelector("#best");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");

const COLORS = {
  I: "#4fd1ff",
  J: "#5b7cfa",
  L: "#ff9f43",
  O: "#f5c84c",
  S: "#42d392",
  T: "#b875ff",
  Z: "#ff6b6b",
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

const POINTS = [0, 100, 300, 500, 800];
const state = {
  grid: makeGrid(),
  piece: null,
  next: null,
  hold: null,
  canHold: true,
  score: 0,
  lines: 0,
  level: 1,
  best: Number(localStorage.getItem("dropBlocksBest") || 0),
  dropCounter: 0,
  dropInterval: 900,
  lastTime: 0,
  frameId: null,
  running: false,
  paused: false,
  over: false,
};

bestEl.textContent = state.best.toLocaleString();
drawScene();

function makeGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneShape(shape) {
  return shape.map((row) => row.slice());
}

function randomType() {
  const types = Object.keys(SHAPES);
  return types[Math.floor(Math.random() * types.length)];
}

function createPiece(type = randomType()) {
  return {
    type,
    shape: cloneShape(SHAPES[type]),
    x: Math.floor(COLS / 2) - Math.ceil(SHAPES[type][0].length / 2),
    y: -1,
  };
}

function startGame() {
  if (state.frameId) {
    cancelAnimationFrame(state.frameId);
  }
  state.grid = makeGrid();
  state.piece = createPiece();
  state.next = createPiece();
  state.hold = null;
  state.canHold = true;
  state.score = 0;
  state.lines = 0;
  state.level = 1;
  state.dropCounter = 0;
  state.dropInterval = 900;
  state.lastTime = 0;
  state.frameId = null;
  state.running = true;
  state.paused = false;
  state.over = false;
  overlay.classList.remove("is-visible");
  pauseButton.textContent = "Pause";
  updateStats();
  drawScene();
  state.frameId = requestAnimationFrame(update);
}

function update(time = 0) {
  if (!state.running) return;
  const delta = time - state.lastTime;
  state.lastTime = time;

  if (!state.paused && !state.over) {
    state.dropCounter += delta;
    if (state.dropCounter > state.dropInterval) {
      softDrop();
    }
  }

  drawScene();
  if (state.running) {
    state.frameId = requestAnimationFrame(update);
  }
}

function collide(piece, offsetX = 0, offsetY = 0, shape = piece.shape) {
  for (let y = 0; y < shape.length; y += 1) {
    for (let x = 0; x < shape[y].length; x += 1) {
      if (!shape[y][x]) continue;
      const nextX = piece.x + x + offsetX;
      const nextY = piece.y + y + offsetY;

      if (nextX < 0 || nextX >= COLS || nextY >= ROWS) return true;
      if (nextY >= 0 && state.grid[nextY][nextX]) return true;
    }
  }
  return false;
}

function merge() {
  state.piece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      const boardY = state.piece.y + y;
      if (boardY >= 0) {
        state.grid[boardY][state.piece.x + x] = state.piece.type;
      }
    });
  });
}

function clearLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (state.grid[y].every(Boolean)) {
      state.grid.splice(y, 1);
      state.grid.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }

  if (cleared > 0) {
    state.lines += cleared;
    state.level = Math.floor(state.lines / 10) + 1;
    state.score += POINTS[cleared] * state.level;
    state.dropInterval = Math.max(90, 900 - (state.level - 1) * 72);
    updateStats();
  }
}

function spawnNext() {
  state.piece = state.next;
  state.piece.x = Math.floor(COLS / 2) - Math.ceil(state.piece.shape[0].length / 2);
  state.piece.y = -1;
  state.next = createPiece();
  state.canHold = true;

  if (collide(state.piece)) {
    endGame();
  }
}

function softDrop(addPoint = false) {
  if (!state.piece || state.paused || state.over) return false;
  if (!collide(state.piece, 0, 1)) {
    state.piece.y += 1;
    state.dropCounter = 0;
    if (addPoint) {
      state.score += 1;
      updateStats();
    }
    return true;
  }
  merge();
  clearLines();
  spawnNext();
  state.dropCounter = 0;
  return false;
}

function hardDrop() {
  if (!state.piece || state.paused || state.over) return;
  let distance = 0;
  while (!collide(state.piece, 0, 1)) {
    state.piece.y += 1;
    distance += 1;
  }
  state.score += distance * 2;
  softDrop();
  updateStats();
}

function move(direction) {
  if (!state.piece || state.paused || state.over) return;
  if (!collide(state.piece, direction, 0)) {
    state.piece.x += direction;
  }
}

function rotate(shape) {
  return shape[0].map((_, index) => shape.map((row) => row[index]).reverse());
}

function rotatePiece() {
  if (!state.piece || state.paused || state.over) return;
  if (state.piece.type === "O") return;
  const rotated = rotate(state.piece.shape);
  const kicks = [0, -1, 1, -2, 2];

  for (const kick of kicks) {
    if (!collide(state.piece, kick, 0, rotated)) {
      state.piece.x += kick;
      state.piece.shape = rotated;
      return;
    }
  }
}

function holdPiece() {
  if (!state.piece || !state.canHold || state.paused || state.over) return;

  const currentType = state.piece.type;
  if (!state.hold) {
    state.hold = createPiece(currentType);
    spawnNext();
  } else {
    const heldType = state.hold.type;
    state.hold = createPiece(currentType);
    state.piece = createPiece(heldType);
    if (collide(state.piece)) {
      endGame();
    }
  }

  state.canHold = false;
}

function togglePause() {
  if (!state.running || state.over) return;
  state.paused = !state.paused;
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
  overlay.querySelector("h2").textContent = "Paused";
  overlay.querySelector("p").textContent = "ひと息ついたら再開できます。";
  startButton.textContent = "Resume";
  overlay.classList.toggle("is-visible", state.paused);
}

function endGame() {
  state.over = true;
  state.running = false;
  state.frameId = null;
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem("dropBlocksBest", String(state.best));
  }
  updateStats();
  overlay.querySelector("h2").textContent = "Game Over";
  overlay.querySelector("p").textContent = `${state.score.toLocaleString()}点。もう一回いきますか。`;
  startButton.textContent = "Restart";
  overlay.classList.add("is-visible");
}

function updateStats() {
  scoreEl.textContent = state.score.toLocaleString();
  linesEl.textContent = state.lines.toLocaleString();
  levelEl.textContent = state.level.toLocaleString();
  bestEl.textContent = state.best.toLocaleString();
}

function drawCell(ctx, x, y, size, type, alpha = 1) {
  const px = x * size;
  const py = y * size;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS[type];
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.fillRect(px + 3, py + 3, size - 6, Math.max(3, size * 0.18));
  ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
  ctx.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
  ctx.globalAlpha = 1;
}

function drawBoardBackground() {
  boardCtx.fillStyle = "#0b0f14";
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardCtx.strokeStyle = "rgba(255, 255, 255, 0.055)";
  boardCtx.lineWidth = 1;

  for (let x = 1; x < COLS; x += 1) {
    boardCtx.beginPath();
    boardCtx.moveTo(x * CELL + 0.5, 0);
    boardCtx.lineTo(x * CELL + 0.5, ROWS * CELL);
    boardCtx.stroke();
  }

  for (let y = 1; y < ROWS; y += 1) {
    boardCtx.beginPath();
    boardCtx.moveTo(0, y * CELL + 0.5);
    boardCtx.lineTo(COLS * CELL, y * CELL + 0.5);
    boardCtx.stroke();
  }
}

function drawGhost() {
  if (!state.piece || state.over) return;
  const ghost = {
    ...state.piece,
    shape: state.piece.shape,
  };

  while (!collide(ghost, 0, 1)) {
    ghost.y += 1;
  }

  ghost.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      const boardY = ghost.y + y;
      if (value && boardY >= 0) {
        drawCell(boardCtx, ghost.x + x, boardY, CELL, ghost.type, 0.22);
      }
    });
  });
}

function drawPiece(ctx, piece, size, offsetX = 0, offsetY = 0, alpha = 1) {
  if (!piece) return;
  piece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      const boardY = piece.y + y + offsetY;
      if (value && boardY >= 0) {
        drawCell(ctx, piece.x + x + offsetX, boardY, size, piece.type, alpha);
      }
    });
  });
}

function drawPreview(ctx, canvas, piece) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111820";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

  if (!piece) return;
  const shape = piece.shape;
  const width = shape[0].length;
  const height = shape.length;
  const offsetX = Math.floor((canvas.width / PREVIEW - width) / 2);
  const offsetY = Math.floor((canvas.height / PREVIEW - height) / 2);

  shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawCell(ctx, x + offsetX, y + offsetY, PREVIEW, piece.type);
      }
    });
  });
}

function drawScene() {
  drawBoardBackground();
  state.grid.forEach((row, y) => {
    row.forEach((type, x) => {
      if (type) drawCell(boardCtx, x, y, CELL, type);
    });
  });
  drawGhost();
  drawPiece(boardCtx, state.piece, CELL);
  drawPreview(nextCtx, nextCanvas, state.next);
  drawPreview(holdCtx, holdCanvas, state.hold);
}

document.addEventListener("keydown", (event) => {
  const keys = ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "c", "C", "p", "P"];
  if (keys.includes(event.key)) {
    event.preventDefault();
  }

  if (!state.running && event.key !== "p" && event.key !== "P") {
    startGame();
    return;
  }

  switch (event.key) {
    case "ArrowLeft":
      move(-1);
      break;
    case "ArrowRight":
      move(1);
      break;
    case "ArrowDown":
      softDrop(true);
      break;
    case "ArrowUp":
      rotatePiece();
      break;
    case " ":
      hardDrop();
      break;
    case "c":
    case "C":
      holdPiece();
      break;
    case "p":
    case "P":
      togglePause();
      break;
    default:
      break;
  }
  drawScene();
});

startButton.addEventListener("click", () => {
  if (state.paused) {
    togglePause();
    return;
  }
  startGame();
});

pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", startGame);
