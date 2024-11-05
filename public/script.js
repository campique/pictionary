// Game variables
let currentWord, timeLeft, score, currentPlayer, gameMode, currentTable;
let playerName, opponentName;
let timerBar;
const words = ['kat', 'hond', 'boom', 'huis', 'zon', 'bloem', 'auto', 'vliegtuig', 'vis', 'vogel'];
const colors = ['#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];

// Drawing variables
let isDrawing = false;
let currentColor = '#000000';
let lastX = 0;
let lastY = 0;

// DOM elements
const mainMenu = document.getElementById('main-menu');
const lobby = document.getElementById('lobby');
const tables = document.getElementById('tables');
const gameArea = document.getElementById('game-area');
const localGameBtn = document.getElementById('local-game');
const onlineGameBtn = document.getElementById('online-game');
const canvas = document.getElementById('drawing-board');
const ctx = canvas.getContext('2d');
const guessInput = document.getElementById('guess-input');
const submitGuessBtn = document.getElementById('submit-guess');
const wordToDrawElement = document.getElementById('word-to-draw');
const timerElement = document.getElementById('timer');
const scoreElement = document.getElementById('score');
const feedbackElement = document.getElementById('feedback');
const colorPalette = document.getElementById('color-palette');
const clearCanvasBtn = document.getElementById('clear-canvas');

// Socket.io setup
const socket = io();

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('submit-name').addEventListener('click', setPlayerName);
    localGameBtn.addEventListener('click', startLocalGame);
    onlineGameBtn.addEventListener('click', showLobby);
    submitGuessBtn.addEventListener('click', submitGuess);
    clearCanvasBtn.addEventListener('click', clearCanvas);

    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', handleEnd, { passive: false });
    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('mouseout', handleEnd);

    window.addEventListener('resize', resizeCanvas);

    initializeColorPalette();
});

// Socket event listeners
socket.on('connect', () => console.log('Connected to server'));
socket.on('lobbyUpdate', updateLobby);
socket.on('gameStart', startOnlineGame);
socket.on('draw', (data) => drawLine(data.x1, data.y1, data.x2, data.y2, data.color));
socket.on('clear', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
socket.on('newRound', startNewRound);
socket.on('updateScore', updateScore);
socket.on('updateScores', (scores) => scores.forEach(updateScore));
socket.on('playerLeft', handlePlayerLeft);
socket.on('nameSet', handleNameSet);

// Game functions
function setPlayerName() {
    playerName = document.getElementById('player-name').value.trim();
    if (playerName) socket.emit('setName', playerName);
}

function showLobby() {
    mainMenu.classList.add('hidden');
    gameArea.classList.add('hidden');
    lobby.classList.remove('hidden');
    socket.emit('enterLobby');
}

function updateLobby(lobbyData) {
    tables.innerHTML = '';
    lobbyData.forEach((table, index) => {
        const tableElement = createTableElement(table, index);
        tables.appendChild(tableElement);
    });
}

function joinTable(tableIndex) {
    socket.emit('joinTable', tableIndex);
    currentTable = tableIndex;
    document.querySelectorAll('.join-table').forEach(btn => btn.disabled = true);
}

function startLocalGame() {
    gameMode = 'local';
    mainMenu.classList.add('hidden');
    gameArea.classList.remove('hidden');
    initializeGame();
    resizeCanvas();
}

function startOnlineGame(gameData) {
    gameMode = 'online';
    lobby.classList.add('hidden');
    gameArea.classList.remove('hidden');
    currentPlayer = gameData.role;
    opponentName = gameData.opponent;
    initializeGame();
    resizeCanvas();
    socket.emit('getScores', currentTable);
}

function initializeGame() {
    score = 0;
    updateScore({ id: socket.id, name: playerName, score: 0 });
    if (gameMode === 'local') nextRound();
}

function startNewRound(roundData) {
    currentWord = roundData.word;
    timeLeft = 60;
    updateGameInfo();
    clearCanvas();
    startTimer();
}

function nextRound() {
    currentWord = getRandomWord();
    timeLeft = 60;
    updateGameInfo();
    clearCanvas();
    startTimer();
}

function updateGameInfo() {
    if (currentPlayer === 'drawer') {
        wordToDrawElement.textContent = `Teken: ${currentWord}`;
        guessInput.classList.add('hidden');
        submitGuessBtn.classList.add('hidden');
        clearCanvasBtn.classList.remove('hidden');
    } else {
        wordToDrawElement.textContent = 'Raad het woord!';
        guessInput.classList.remove('hidden');
        submitGuessBtn.classList.remove('hidden');
        clearCanvasBtn.classList.add('hidden');
    }
}

function startTimer() {
    // Timer implementation
}

function endRound() {
    feedbackElement.textContent = currentPlayer === 'drawer' 
        ? 'Tijd voorbij! Wissel van beurt.' 
        : `Tijd voorbij! Het woord was: ${currentWord}`;
    if (gameMode === 'local') {
        currentPlayer = currentPlayer === 'drawer' ? 'guesser' : 'drawer';
        setTimeout(nextRound, 3000);
    } else {
        socket.emit('endRound', currentTable);
    }
}

function updateScore(scoreData) {
    if (scoreData.id === socket.id) {
        score = scoreData.score;
        scoreElement.textContent = `Jouw score: ${score}`;
    } else {
        document.getElementById('opponent-score').textContent = `${opponentName}: ${scoreData.score}`;
    }
}

function submitGuess() {
    if (currentPlayer !== 'guesser') return;
    const guess = guessInput.value.toLowerCase();
    if (guess === currentWord) {
        handleCorrectGuess();
    } else {
        feedbackElement.textContent = 'Probeer opnieuw!';
    }
    guessInput.value = '';
}

// Drawing functions
function handleStart(e) {
    e.preventDefault();
    if (currentPlayer !== 'drawer') return;
    isDrawing = true;
    [lastX, lastY] = getCoordinates(e);
}

function handleMove(e) {
    e.preventDefault();
    if (!isDrawing || currentPlayer !== 'drawer') return;
    const [x, y] = getCoordinates(e);
    drawLine(lastX, lastY, x, y, currentColor);
    if (gameMode === 'online') {
        socket.emit('draw', { table: currentTable, x1: lastX, y1: lastY, x2: x, y2: y, color: currentColor });
    }
    [lastX, lastY] = [x, y];
}

function handleEnd(e) {
    e.preventDefault();
    isDrawing = false;
}

function getCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches && e.touches[0]) {
        return [
            (e.touches[0].clientX - rect.left) * scaleX,
            (e.touches[0].clientY - rect.top) * scaleY
        ];
    }
    return [
        (e.clientX - rect.left) * scaleX,
        (e.clientY - rect.top) * scaleY
    ];
}

function drawLine(x1, y1, x2, y2, color) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);            
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (gameMode === 'online') {
        socket.emit('clear', currentTable);
    }
}

function resizeCanvas() {
    const container = document.getElementById('canvas-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    clearCanvas();
}

// Utility functions
function getRandomWord() {
    return words[Math.floor(Math.random() * words.length)];
}

function createTableElement(table, index) {
    // Implementation for creating table element
}

function handleCorrectGuess() {
    // Implementation for handling correct guess
}

function handlePlayerLeft() {
    alert('De andere speler heeft het spel verlaten. Je wordt teruggestuurd naar de lobby.');
    showLobby();
}

function handleNameSet() {
    document.getElementById('name-input').classList.add('hidden');
    mainMenu.classList.remove('hidden');
}

function initializeColorPalette() {
    colors.forEach(color => {
        const colorOption = document.createElement('div');
        colorOption.className = 'w-8 h-8 rounded-full cursor-pointer transition duration-300 ease-in-out transform hover:scale-110';
        colorOption.style.backgroundColor = color;
        colorOption.addEventListener('click', () => {
            currentColor = color;
            document.querySelectorAll('#color-palette div').forEach(el => el.classList.remove('ring-4'));
            colorOption.classList.add('ring-4', 'ring-purple-500');
        });
        colorPalette.appendChild(colorOption);
    });
    document.querySelector('#color-palette div').click();
}

console.log("Script initialization complete");
