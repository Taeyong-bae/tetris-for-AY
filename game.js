const CONFIG = {
  cols: 10,
  rows: 20,
  blockSize: 30,
  startDropInterval: 950,
  minDropInterval: 220,
  levelSpeedStep: 70,
  swipeStep: 24,
  hardDropDistance: 130,
  tapDistance: 12,
  tapTime: 220
};

const PIECE_TYPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]]
};

const THEMES = {
  candy: {
    bodyClass: "theme-candy",
    title: "🍬 캔디 블록 놀이터",
    subtitle: "달콤한 블록을 맞춰서 줄을 지워보자!",
    pieceColors: {
      I: "#7dd9ff",
      O: "#ffe178",
      T: "#d8a2ff",
      S: "#89f0b5",
      Z: "#ff9fb0",
      J: "#8ab7ff",
      L: "#ffbf84"
    }
  },
  fruit: {
    bodyClass: "theme-fruit",
    title: "🍓 과일 블록 놀이터",
    subtitle: "상큼한 과일 블록으로 줄을 맞춰보자!",
    pieceColors: {
      I: "#ff8ca1",
      O: "#ffd86b",
      T: "#bfa1ff",
      S: "#83d86d",
      Z: "#ff7c6b",
      J: "#7fc6ff",
      L: "#ffb15a"
    }
  },
  ocean: {
    bodyClass: "theme-ocean",
    title: "🐠 바다친구 블록 놀이터",
    subtitle: "바다친구 블록을 차곡차곡 쌓아보자!",
    pieceColors: {
      I: "#7de0f7",
      O: "#ffe38a",
      T: "#9fd3ff",
      S: "#7fe0c0",
      Z: "#ffa8c3",
      J: "#7fb3ff",
      L: "#ffca7a"
    }
  }
};

class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = createBoard(CONFIG.rows, CONFIG.cols);
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.paused = false;
    this.gameOver = false;
    this.dropInterval = CONFIG.startDropInterval;
    this.dropCounter = 0;
    this.lastTime = 0;
    this.currentPiece = createRandomPiece();
    this.nextPiece = createRandomPiece();
  }
}

function createBoard(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

function randomPieceType() {
  const keys = Object.keys(PIECE_TYPES);
  return keys[Math.floor(Math.random() * keys.length)];
}

function createPiece(type) {
  const chosenType = type || randomPieceType();
  const matrix = PIECE_TYPES[chosenType].map(row => [...row]);
  return {
    type: chosenType,
    matrix,
    x: Math.floor(CONFIG.cols / 2) - Math.ceil(matrix[0].length / 2),
    y: 0
  };
}

function createRandomPiece() {
  return createPiece(randomPieceType());
}

function rotateMatrix(matrix) {
  const height = matrix.length;
  const width = matrix[0].length;
  const result = Array.from({ length: width }, () => Array(height).fill(0));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      result[x][height - 1 - y] = matrix[y][x];
    }
  }
  return result;
}

function collides(board, piece) {
  for (let y = 0; y < piece.matrix.length; y++) {
    for (let x = 0; x < piece.matrix[y].length; x++) {
      if (!piece.matrix[y][x]) continue;

      const boardX = piece.x + x;
      const boardY = piece.y + y;

      if (boardX < 0 || boardX >= CONFIG.cols || boardY >= CONFIG.rows) {
        return true;
      }

      if (boardY >= 0 && board[boardY][boardX]) {
        return true;
      }
    }
  }
  return false;
}

function mergePiece(board, piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;

      const targetY = piece.y + y;
      const targetX = piece.x + x;

      if (targetY >= 0) {
        board[targetY][targetX] = {
          type: piece.type
        };
      }
    });
  });
}

function clearCompleteLines(state) {
  let cleared = 0;

  outer:
  for (let y = CONFIG.rows - 1; y >= 0; y--) {
    for (let x = 0; x < CONFIG.cols; x++) {
      if (!state.board[y][x]) {
        continue outer;
      }
    }

    state.board.splice(y, 1);
    state.board.unshift(Array(CONFIG.cols).fill(null));
    cleared++;
    y++;
  }

  if (cleared > 0) {
    const scoreTable = { 1: 100, 2: 300, 3: 500, 4: 800 };
    state.score += (scoreTable[cleared] || 0) * state.level;
    state.lines += cleared;
    state.level = Math.floor(state.lines / 8) + 1;
    state.dropInterval = Math.max(
      CONFIG.minDropInterval,
      CONFIG.startDropInterval - (state.level - 1) * CONFIG.levelSpeedStep
    );
  }
}

class ThemeBlocksGame {
  constructor() {
    this.state = new GameState();
    this.themeKey = "candy";

    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.nextCanvas = document.getElementById("nextCanvas");
    this.nextCtx = this.nextCanvas.getContext("2d");

    this.scoreValue = document.getElementById("scoreValue");
    this.levelValue = document.getElementById("levelValue");
    this.linesValue = document.getElementById("linesValue");
    this.pauseButton = document.getElementById("pauseButton");
    this.titleEl = document.getElementById("gameTitle");
    this.subtitleEl = document.getElementById("gameSubtitle");
    this.themeSelect = document.getElementById("themeSelect");

    this.touch = {
      startX: 0,
      startY: 0,
      startTime: 0,
      horizontalStep: 0,
      verticalStep: 0
    };

    this.ctx.scale(CONFIG.blockSize, CONFIG.blockSize);

    this.applyTheme(this.themeKey);
    this.bindEvents();
    this.updateHud();
    this.render();
    requestAnimationFrame(this.loop.bind(this));
  }

  get currentTheme() {
    return THEMES[this.themeKey];
  }

  bindEvents() {
    document.addEventListener("keydown", (event) => this.handleKeydown(event));

    bindPress(document.getElementById("leftButton"), () => this.movePiece(-1), true);
    bindPress(document.getElementById("rightButton"), () => this.movePiece(1), true);
    bindPress(document.getElementById("downButton"), () => this.softDrop(), true);
    bindPress(document.getElementById("rotateButton"), () => this.rotatePiece());
    bindPress(document.getElementById("dropButton"), () => this.hardDrop());

    document.getElementById("restartButton").addEventListener("click", () => this.restart());
    document.getElementById("pauseButton").addEventListener("click", () => this.togglePause());
    this.themeSelect.addEventListener("change", (event) => this.applyTheme(event.target.value));

    this.canvas.addEventListener("touchstart", (event) => this.handleTouchStart(event), { passive: true });
    this.canvas.addEventListener("touchmove", (event) => this.handleTouchMove(event), { passive: false });
    this.canvas.addEventListener("touchend", (event) => this.handleTouchEnd(event), { passive: true });
  }

  applyTheme(themeKey) {
    this.themeKey = THEMES[themeKey] ? themeKey : "candy";
    const theme = this.currentTheme;

    document.body.classList.remove("theme-candy", "theme-fruit", "theme-ocean");
    document.body.classList.add(theme.bodyClass);

    this.titleEl.textContent = theme.title;
    this.subtitleEl.textContent = theme.subtitle;
    this.themeSelect.value = this.themeKey;

    this.updateHud();
    this.render();
  }

  pieceColor(type) {
    return this.currentTheme.pieceColors[type];
  }

  handleKeydown(event) {
    if (event.key === "ArrowLeft") this.movePiece(-1);
    else if (event.key === "ArrowRight") this.movePiece(1);
    else if (event.key === "ArrowDown") this.softDrop();
    else if (event.key === "ArrowUp") this.rotatePiece();
    else if (event.code === "Space") {
      event.preventDefault();
      this.hardDrop();
    } else if (event.key.toLowerCase() === "p") {
      this.togglePause();
    }
  }

  handleTouchStart(event) {
    if (this.state.paused || this.state.gameOver) return;

    const touch = event.changedTouches[0];
    this.touch.startX = touch.clientX;
    this.touch.startY = touch.clientY;
    this.touch.startTime = Date.now();
    this.touch.horizontalStep = 0;
    this.touch.verticalStep = 0;
  }

  handleTouchMove(event) {
    if (this.state.paused || this.state.gameOver) return;

    event.preventDefault();
    const touch = event.changedTouches[0];
    const dx = touch.clientX - this.touch.startX;
    const dy = touch.clientY - this.touch.startY;

    const horizontalStep = Math.trunc(dx / CONFIG.swipeStep);
    const verticalStep = Math.trunc(dy / CONFIG.swipeStep);

    while (horizontalStep > this.touch.horizontalStep) {
      this.movePiece(1);
      this.touch.horizontalStep++;
    }

    while (horizontalStep < this.touch.horizontalStep) {
      this.movePiece(-1);
      this.touch.horizontalStep--;
    }

    while (verticalStep > this.touch.verticalStep) {
      this.softDrop();
      this.touch.verticalStep++;
    }
  }

  handleTouchEnd(event) {
    if (this.state.paused || this.state.gameOver) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - this.touch.startX;
    const dy = touch.clientY - this.touch.startY;
    const elapsed = Date.now() - this.touch.startTime;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx <= CONFIG.tapDistance && absDy <= CONFIG.tapDistance && elapsed <= CONFIG.tapTime) {
      this.rotatePiece();
      return;
    }

    if (dy < -36 && absDy > absDx) {
      this.rotatePiece();
      return;
    }

    if (dy > CONFIG.hardDropDistance && absDy > absDx) {
      this.hardDrop();
    }
  }

  loop(time = 0) {
    const deltaTime = time - this.state.lastTime;
    this.state.lastTime = time;

    if (!this.state.paused && !this.state.gameOver) {
      this.state.dropCounter += deltaTime;
      if (this.state.dropCounter > this.state.dropInterval) {
        this.softDrop();
      }
    }

    this.render();
    requestAnimationFrame(this.loop.bind(this));
  }

  restart() {
    this.state.reset();
    this.updateHud();
    this.render();
  }

  togglePause() {
    if (this.state.gameOver) return;
    this.state.paused = !this.state.paused;
    this.pauseButton.textContent = this.state.paused ? "▶️ 다시 하기" : "⏸ 잠깐 멈추기";
  }

  movePiece(direction) {
    if (this.state.paused || this.state.gameOver) return;

    this.state.currentPiece.x += direction;
    if (collides(this.state.board, this.state.currentPiece)) {
      this.state.currentPiece.x -= direction;
    }
  }

  rotatePiece() {
    if (this.state.paused || this.state.gameOver) return;

    const originalMatrix = this.state.currentPiece.matrix;
    const originalX = this.state.currentPiece.x;
    const rotated = rotateMatrix(originalMatrix);
    const kicks = [0, -1, 1, -2, 2];

    for (const kick of kicks) {
      this.state.currentPiece.matrix = rotated;
      this.state.currentPiece.x = originalX + kick;

      if (!collides(this.state.board, this.state.currentPiece)) {
        return;
      }
    }

    this.state.currentPiece.matrix = originalMatrix;
    this.state.currentPiece.x = originalX;
  }

  softDrop() {
    if (this.state.paused || this.state.gameOver) return;

    this.state.currentPiece.y++;
    if (collides(this.state.board, this.state.currentPiece)) {
      this.state.currentPiece.y--;
      this.lockPiece();
      return;
    }

    this.state.dropCounter = 0;
  }

  hardDrop() {
    if (this.state.paused || this.state.gameOver) return;

    const ghost = this.getGhostPiece();
    this.state.currentPiece.y = ghost.y;
    this.lockPiece();
  }

  lockPiece() {
    mergePiece(this.state.board, this.state.currentPiece);
    clearCompleteLines(this.state);
    this.spawnNextPiece();
    this.state.dropCounter = 0;
    this.updateHud();
  }

  spawnNextPiece() {
    this.state.currentPiece = createPiece(this.state.nextPiece.type);
    this.state.nextPiece = createRandomPiece();

    if (collides(this.state.board, this.state.currentPiece)) {
      this.state.gameOver = true;
    }
  }

  getGhostPiece() {
    const ghost = {
      type: this.state.currentPiece.type,
      matrix: this.state.currentPiece.matrix.map(row => [...row]),
      x: this.state.currentPiece.x,
      y: this.state.currentPiece.y
    };

    while (!collides(this.state.board, ghost)) {
      ghost.y++;
    }
    ghost.y--;

    return ghost;
  }

  updateHud() {
    this.scoreValue.textContent = this.state.score;
    this.levelValue.textContent = this.state.level;
    this.linesValue.textContent = this.state.lines;
    this.drawNextPreview();
  }

  drawCell(x, y, fillStyle, outlineStyle = "#ffffff") {
    this.ctx.fillStyle = fillStyle;
    this.ctx.fillRect(x, y, 1, 1);
    this.ctx.strokeStyle = outlineStyle;
    this.ctx.lineWidth = 0.06;
    this.ctx.strokeRect(x, y, 1, 1);
  }

  drawGhostCell(x, y, color) {
    this.ctx.save();
    this.ctx.globalAlpha = 0.23;
    this.drawCell(x, y, color, color);
    this.ctx.restore();
  }

  renderBoard() {
    const style = getComputedStyle(document.body);
    const boardBg = style.getPropertyValue("--board-bg").trim() || "#fff4fb";
    const gridColor = style.getPropertyValue("--grid").trim() || "#f1d9eb";

    this.ctx.fillStyle = boardBg;
    this.ctx.fillRect(0, 0, CONFIG.cols, CONFIG.rows);

    for (let y = 0; y < CONFIG.rows; y++) {
      for (let x = 0; x < CONFIG.cols; x++) {
        const cell = this.state.board[y][x];
        if (cell) {
          this.drawCell(x, y, this.pieceColor(cell.type), "#f8fbff");
        } else {
          this.ctx.strokeStyle = gridColor;
          this.ctx.lineWidth = 0.03;
          this.ctx.strokeRect(x, y, 1, 1);
        }
      }
    }
  }

  renderPiece(piece, ghost = false) {
    for (let y = 0; y < piece.matrix.length; y++) {
      for (let x = 0; x < piece.matrix[y].length; x++) {
        if (!piece.matrix[y][x]) continue;

        const drawX = piece.x + x;
        const drawY = piece.y + y;
        const color = this.pieceColor(piece.type);

        if (ghost) {
          this.drawGhostCell(drawX, drawY, color);
        } else {
          this.drawCell(drawX, drawY, color, "#ffffff");
        }
      }
    }
  }

  drawNextPreview() {
    const style = getComputedStyle(document.body);
    const previewBg = style.getPropertyValue("--preview-bg").trim() || "#fff8fb";

    this.nextCtx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
    this.nextCtx.fillStyle = previewBg;
    this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);

    const matrix = this.state.nextPiece.matrix;
    const previewSize = 24;
    const width = matrix[0].length * previewSize;
    const height = matrix.length * previewSize;
    const offsetX = (this.nextCanvas.width - width) / 2;
    const offsetY = (this.nextCanvas.height - height) / 2;

    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (!matrix[y][x]) continue;
        this.nextCtx.fillStyle = this.pieceColor(this.state.nextPiece.type);
        this.nextCtx.fillRect(offsetX + x * previewSize, offsetY + y * previewSize, previewSize, previewSize);
        this.nextCtx.strokeStyle = "#ffffff";
        this.nextCtx.lineWidth = 2;
        this.nextCtx.strokeRect(offsetX + x * previewSize, offsetY + y * previewSize, previewSize, previewSize);
      }
    }
  }

  renderOverlay(title, message) {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    this.ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = "#35507d";
    this.ctx.textAlign = "center";
    this.ctx.font = "bold 30px Arial";
    this.ctx.fillText(title, this.canvas.width / 2, this.canvas.height / 2 - 10);

    this.ctx.font = "18px Arial";
    this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2 + 28);
    this.ctx.restore();
  }

  render() {
    this.renderBoard();
    this.renderPiece(this.getGhostPiece(), true);
    this.renderPiece(this.state.currentPiece, false);

    if (this.state.paused && !this.state.gameOver) {
      this.renderOverlay("잠깐 쉬는 시간", "다시 하기 버튼을 눌러보자!");
    }

    if (this.state.gameOver) {
      this.renderOverlay("놀이 끝!", "다시 시작하고 한 번 더 도전!");
    }
  }
}

function bindPress(element, handler, repeat = false) {
  let intervalId = null;
  let timeoutId = null;

  const start = (event) => {
    event.preventDefault();
    handler();

    if (repeat) {
      timeoutId = setTimeout(() => {
        intervalId = setInterval(handler, 100);
      }, 220);
    }
  };

  const stop = () => {
    clearTimeout(timeoutId);
    clearInterval(intervalId);
    timeoutId = null;
    intervalId = null;
  };

  element.addEventListener("touchstart", start, { passive: false });
  element.addEventListener("touchend", stop);
  element.addEventListener("touchcancel", stop);
  element.addEventListener("mousedown", start);
  element.addEventListener("mouseup", stop);
  element.addEventListener("mouseleave", stop);
}

window.addEventListener("load", () => {
  new ThemeBlocksGame();
});
