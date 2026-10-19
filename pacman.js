const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const livesElement = document.getElementById("lives");
const messageElement = document.getElementById("message");
const restartButton = document.getElementById("restart");

const TILE = 28;
const ROWS = 21;
const COLS = 19;


const PACMAN_SPEED = 150;
const GHOST_SPEED = 400;
const START_DELAY = 3000;

canvas.width = COLS * TILE;
canvas.height = ROWS * TILE;

const originalMap = [
    "XXXXXXXXXXXXXXXXXXX",
    "X........X........X",
    "X.XX.XXX.X.XXX.XX.X",
    "X.................X",
    "X.XX.X.XXXXX.X.XX.X",
    "X....X.......X....X",
    "XXXX.XXXX.XXXX.XXXX",
    "XOO..........OOO.XX",
    "XXXX.X.XXrXX.X.XXXX",
    "O.......bpo.......O",
    "XXXX.X.XXXXX...XXXX",
    "XOOO............OOOX",
    "XXXX.X.XXXXX.X.XXXX",
    "X........X........X",
    "X.XX.XXX.X.XXX.XX.X",
    "X..X....P....X....X",
    "XX.X.X.XXXXX.X...XX",
    "X....X...X...X....X",
    "X.XXXXXX.X.XXXXXX.X",
    "X.................X",
    "XXXXXXXXXXXXXXXXXXX"
];

const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
};

const opposite = {
    up: "down",
    down: "up",
    left: "right",
    right: "left"
};

let map;
let pacman;
let ghosts;
let score;
let lives;
let gameOver;
let started;
let animationId;

let lastTime;
let pacmanTimer;
let ghostTimer;
let startTime;
let mouthPhase;

function resetGame() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        stopMusic();
        musicNote = 0;
    }

    map = originalMap.map(row => row.split(""));

    score = 0;
    lives = 3;
    gameOver = false;
    started = false;

    lastTime = 0;
    pacmanTimer = 0;
    ghostTimer = 0;
    startTime = 0;
    mouthPhase = 0;

    pacman = {
        x: 8,
        y: 15,
        startX: 8,
        startY: 15,
        direction: "left",
        nextDirection: null,
        moving: false
    };

    ghosts = [
        {
            x: 8, y: 9,
            startX: 8, startY: 9,
            color: "#35aaff",
            direction: "left",
            personality: "random"
        },
        {
            x: 9, y: 9,
            startX: 9, startY: 9,
            color: "#7ad6e4",
            direction: "up",
            personality: "chaser"
        },
        {
            x: 10, y: 9,
            startX: 10, startY: 9,
            color: "#16969f",
            direction: "right",
            personality: "random"
        },
        {
            x: 9, y: 8,
            startX: 9, startY: 8,
            color: "#0457a0",
            direction: "up",
            personality: "wanderer"
        }
    ];

    
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (map[y][x] !== "X") {
                map[y][x] = ".";
            }
        }
    }

    
    for (const ghost of ghosts) {
        map[ghost.y][ghost.x] = " ";
    }

    map[pacman.y][pacman.x] = " ";

    updateScore();
    messageElement.textContent =
        "Press an arrow key or WASD to start!";

    draw();
    animationId = requestAnimationFrame(gameLoop);
}

function isWall(x, y) {
    if (y < 0 || y >= ROWS) return true;
    if (x < 0 || x >= COLS) return false;

    return map[y][x] === "X";
}

function wrapX(x) {
    if (x < 0) return COLS - 1;
    if (x >= COLS) return 0;
    return x;
}

function movePacman() {
    pacman.moving = false;

    
    if (pacman.nextDirection) {
        const next = directions[pacman.nextDirection];

        if (
            next &&
            !isWall(
                wrapX(pacman.x + next.x),
                pacman.y + next.y
            )
        ) {
            pacman.direction = pacman.nextDirection;
        }
    }

    const dir = directions[pacman.direction];

    if (!dir) return;

    const nx = wrapX(pacman.x + dir.x);
    const ny = pacman.y + dir.y;

    if (!isWall(nx, ny)) {
        pacman.x = nx;
        pacman.y = ny;
        pacman.moving = true;

        eatDot();
    }
}

function eatDot() {
    if (map[pacman.y][pacman.x] !== ".") return;

    map[pacman.y][pacman.x] = " ";
    playChomp()
    score += 10;

    updateScore();

    let dotsLeft = 0;

    for (const row of map) {
        for (const tile of row) {
            if (tile === ".") dotsLeft++;
        }
    }

    if (dotsLeft === 0) {
        gameOver = true;
        messageElement.textContent = "You Win! yipee";
        stopMusic();
        playWin();
    }
}

function getAvailableMoves(ghost) {
    const available = [];

    for (const [name, dir] of Object.entries(directions)) {
        const nx = wrapX(ghost.x + dir.x);
        const ny = ghost.y + dir.y;

        if (isWall(nx, ny)) continue;

        const occupied = ghosts.some(other =>
            other !== ghost &&
            other.x === nx &&
            other.y === ny
        );

        if (occupied) continue;

        available.push({
            name,
            x: nx,
            y: ny
        });
    }

    return available;
}

function distanceToPacman(x, y) {
    const dx = Math.min(
        Math.abs(x - pacman.x),
        COLS - Math.abs(x - pacman.x)
    );

    const dy = Math.abs(y - pacman.y);

    return dx + dy;
}

function chooseGhostMove(ghost, available) {
    if (available.length === 0) return null;

    let choices = available.filter(
        move => move.name !== opposite[ghost.direction]
    );

    if (choices.length === 0) {
        choices = available;
    }

    if (ghost.personality === "wanderer") {
        return choices[Math.floor(Math.random() * choices.length)];
    }

    const chaseChance =
        ghost.personality === "chaser" ? 0.45 : 0.25;

    if (Math.random() < chaseChance) {
        const bestDistance = Math.min(
            ...choices.map(move =>
                distanceToPacman(move.x, move.y)
            )
        );

        const bestMoves = choices.filter(move =>
            distanceToPacman(move.x, move.y) === bestDistance
        );

        
        if (Math.random() < 0.8) {
            return bestMoves[
                Math.floor(Math.random() * bestMoves.length)
            ];
        }
    }

    return choices[Math.floor(Math.random() * choices.length)];
}

function moveGhosts() {
    const shuffled = [...ghosts].sort(
        () => Math.random() - 0.5
    );

    for (const ghost of shuffled) {
        const available = getAvailableMoves(ghost);
        const chosen = chooseGhostMove(ghost, available);

        if (!chosen) continue;

        ghost.x = chosen.x;
        ghost.y = chosen.y;
        ghost.direction = chosen.name;
    }
}

function checkGhostCollision() {
    for (const ghost of ghosts) {
        if (ghost.x === pacman.x && ghost.y === pacman.y) {
            loseLife();
            return;
        }
    }
}

function loseLife() {

    lives--;
    playDeath();
    updateScore();

    if (lives <= 0) {
        gameOver = true;
        messageElement.textContent = "You Lost lol";
        return;
    }

    pacman.x = pacman.startX;
    pacman.y = pacman.startY;
    pacman.direction = "left";
    pacman.nextDirection = null;
    pacman.moving = false;

    for (const ghost of ghosts) {
        ghost.x = ghost.startX;
        ghost.y = ghost.startY;
    }

    pacmanTimer = 0;
    ghostTimer = 0;
    startTime = performance.now();

    messageElement.textContent =
        `${lives} lives left lol`;

}

function updateScore() {
    scoreElement.textContent = score;
    livesElement.textContent = lives;
}

function draw() {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const px = x * TILE;
            const py = y * TILE;

            if (map[y][x] === "X") {
                ctx.fillStyle = "#186991";
                ctx.fillRect(px, py, TILE, TILE);

                ctx.strokeStyle = "#1c4a68";
                ctx.lineWidth = 1;
                ctx.strokeRect(
                    px + 2, py + 2,
                    TILE - 4, TILE - 4
                );
            } else if (map[y][x] === ".") {
                ctx.fillStyle = "#ffe6b3";
                ctx.beginPath();
                ctx.arc(
                    px + TILE / 2,
                    py + TILE / 2,
                    3, 0, Math.PI * 2
                );
                ctx.fill();
            }
        }
    }

    drawPacman();

    
    for (const ghost of ghosts) {
        drawGhost(ghost);
    }
}

function drawPacman() {
    const cx = pacman.x * TILE + TILE / 2;
    const cy = pacman.y * TILE + TILE / 2;

    const angles = {
        right: 0,
        down: Math.PI / 2,
        left: Math.PI,
        up: -Math.PI / 2
    };

    const angle = angles[pacman.direction] ?? 0;

    const mouth = pacman.moving
        ? 0.15 + Math.abs(Math.sin(mouthPhase)) * 0.35
        : 0.08;

    ctx.fillStyle = "#ffe600";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(
        cx, cy, TILE * 0.42,
        angle + mouth,
        angle + Math.PI * 2 - mouth
    );
    ctx.closePath();
    ctx.fill();
}

function drawGhost(ghost) {
    const cx = ghost.x * TILE + TILE / 2;
    const cy = ghost.y * TILE + TILE / 2;
    const radius = TILE * 0.38;

    ctx.fillStyle = ghost.color;
    ctx.beginPath();
    ctx.arc(cx, cy - 2, radius, Math.PI, 0);
    ctx.lineTo(cx + radius, cy + radius);

    ctx.lineTo(cx + radius / 2, cy + radius * 0.65);
    ctx.lineTo(cx, cy + radius);
    ctx.lineTo(cx - radius / 2, cy + radius * 0.65);
    ctx.lineTo(cx - radius, cy + radius);

    ctx.closePath();
    ctx.fill();

    // Eyes
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.ellipse(cx - 5, cy - 3, 4, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 5, cy - 3, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1111aa";
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 2, 2, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 2, 2, 0, Math.PI * 2);
    ctx.fill();
}

function gameLoop(timestamp) {
    if (lastTime === undefined || lastTime === null) {
        lastTime = timestamp;
    }

    const delta = Math.min(timestamp - lastTime, 100);
    lastTime = timestamp;

    if (started && !gameOver) {
        startTime = startTime || timestamp;

        pacmanTimer += delta;

        if (pacmanTimer >= PACMAN_SPEED) {
            pacmanTimer %= PACMAN_SPEED;
            movePacman();
            checkGhostCollision();
        }
        if (
            timestamp - startTime >= START_DELAY &&
            !gameOver
        ) {
            ghostTimer += delta;

            if (ghostTimer >= GHOST_SPEED) {
                ghostTimer %= GHOST_SPEED;
                moveGhosts();
                checkGhostCollision();
            }
        }
        if (pacman.moving) {
            mouthPhase += delta * 0.015;
        }
    }

    draw();

    if (!gameOver) {
        animationId = requestAnimationFrame(gameLoop);
    }
}

document.addEventListener("keydown", event => {
    const keyDirections = {
        ArrowUp: "up",
        KeyW: "up",
        ArrowDown: "down",
        KeyS: "down",
        ArrowLeft: "left",
        KeyA: "left",
        ArrowRight: "right",
        KeyD: "right"
    };
    initAudio();
    startMusic();
    const direction = keyDirections[event.code];

    if (!direction) return;

    event.preventDefault();

    if (gameOver) return;

    started = true;
    pacman.nextDirection = direction;

    if (!startTime) {
        startTime = performance.now();
    }

    messageElement.textContent = "";
});


let audioContext;
let musicTimer;
let musicNote = 0;

function initAudio() {
    if (!audioContext) {
        audioContext = new (
            window.AudioContext || window.webkitAudioContext
        )();
    }

    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
}

function playTone(frequency, duration = 0.08, type = "square", volume = 0.04) {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
}

function playChomp() {
    playTone(650, 0.045, "square", 0.035);
}

function playDeath() {
    playTone(400, 0.15, "sawtooth", 0.06);

    setTimeout(() => playTone(250, 0.2, "sawtooth", 0.05), 150);
    setTimeout(() => playTone(120, 0.35, "sawtooth", 0.04), 350);
}

function playWin() {
    [523, 659, 784, 1047].forEach((frequency, index) => {
        setTimeout(() => playTone(frequency, 0.18), index * 150);
    });
}

function startMusic() {
    if (musicTimer) return;

    const melody = [262, 330, 392, 330, 294, 349, 440, 349];

    musicTimer = setInterval(() => {
        if (!gameOver && started) {
            playTone(melody[musicNote], 0.12, "triangle", 0.012);
            musicNote = (musicNote + 1) % melody.length;
        }
    }, 220);
}

function stopMusic() {
    clearInterval(musicTimer);
    musicTimer = null;
}


restartButton.addEventListener("click", resetGame);

resetGame();