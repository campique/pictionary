const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

// Game variables
const words = ['kat', 'hond', 'boom', 'huis', 'zon', 'bloem', 'auto', 'vliegtuig', 'vis', 'vogel'];
const tables = Array(5).fill().map(() => ({ players: 0, sockets: [] }));
const players = new Map();

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('setName', (name) => {
        players.set(socket.id, { name, score: 0 });
        io.to(socket.id).emit('nameSet');
    });

    socket.on('enterLobby', () => {
        io.to(socket.id).emit('lobbyUpdate', tables.map(table => ({ 
            players: table.players,
            playerNames: table.sockets.map(s => players.get(s.id).name)
        })));
    });

    socket.on('joinTable', (tableIndex) => {
        if (tables[tableIndex].players < 2) {
            tables[tableIndex].players++;
            tables[tableIndex].sockets.push(socket);
            socket.tableIndex = tableIndex;

            io.emit('lobbyUpdate', tables.map(table => ({ 
                players: table.players,
                playerNames: table.sockets.map(s => players.get(s.id).name)
            })));

            if (tables[tableIndex].players === 2) {
                startGame(tableIndex);
            }
        }
    });

    socket.on('draw', (data) => {
        socket.to(`table${data.table}`).emit('draw', data);
    });

    socket.on('clear', (tableIndex) => {
        socket.to(`table${tableIndex}`).emit('clear');
    });

    socket.on('correctGuess', (data) => {
        const player = players.get(socket.id);
        player.score += data.timeLeft;
        io.to(`table${data.table}`).emit('updateScore', { 
            id: socket.id, 
            name: player.name, 
            score: player.score 
        });
        endRound(data.table);
    });

    socket.on('endRound', (tableIndex) => {
        endRound(tableIndex);
    });

    socket.on('getScores', (tableIndex) => {
        const scores = tables[tableIndex].sockets.map(s => ({
            id: s.id,
            name: players.get(s.id).name,
            score: players.get(s.id).score
        }));
        io.to(`table${tableIndex}`).emit('updateScores', scores);
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        if (socket.tableIndex !== undefined) {
            const tableIndex = socket.tableIndex;
            tables[tableIndex].players--;
            tables[tableIndex].sockets = tables[tableIndex].sockets.filter(s => s.id !== socket.id);
            io.emit('lobbyUpdate', tables.map(table => ({ 
                players: table.players,
                playerNames: table.sockets.map(s => players.get(s.id).name)
            })));

            if (tables[tableIndex].players === 1) {
                io.to(`table${tableIndex}`).emit('playerLeft');
            }
        }
        players.delete(socket.id);
    });
});

function startGame(tableIndex) {
    const table = tables[tableIndex];
    table.sockets[0].join(`table${tableIndex}`);
    table.sockets[1].join(`table${tableIndex}`);

    const player1 = players.get(table.sockets[0].id);
    const player2 = players.get(table.sockets[1].id);

    table.sockets[0].emit('gameStart', { role: 'drawer', opponent: player2.name });
    table.sockets[1].emit('gameStart', { role: 'guesser', opponent: player1.name });

    startNewRound(tableIndex);
}

function startNewRound(tableIndex) {
    const word = words[Math.floor(Math.random() * words.length)];
    io.to(`table${tableIndex}`).emit('newRound', { word });
}

function endRound(tableIndex) {
    const table = tables[tableIndex];
    [table.sockets[0], table.sockets[1]] = [table.sockets[1], table.sockets[0]];
    const player1 = players.get(table.sockets[0].id);
    const player2 = players.get(table.sockets[1].id);
    table.sockets[0].emit('gameStart', { role: 'drawer', opponent: player2.name });
    table.sockets[1].emit('gameStart', { role: 'guesser', opponent: player1.name });
    startNewRound(tableIndex);
}

http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
