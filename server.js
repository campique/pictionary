const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// Game variables
const words = ['kat', 'hond', 'boom', 'huis', 'zon', 'bloem', 'auto', 'vliegtuig', 'vis', 'vogel'];
const tables = Array(5).fill().map(() => ({ players: 0, sockets: [] }));

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('enterLobby', () => {
        io.to(socket.id).emit('lobbyUpdate', tables.map(table => ({ players: table.players })));
    });

    socket.on('joinTable', (tableIndex) => {
        if (tables[tableIndex].players < 2) {
            tables[tableIndex].players++;
            tables[tableIndex].sockets.push(socket);
            socket.tableIndex = tableIndex;

            io.emit('lobbyUpdate', tables.map(table => ({ players: table.players })));

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
        io.to(`table${data.table}`).emit('updateScore', data.score);
        endRound(data.table);
    });

    socket.on('endRound', (tableIndex) => {
        endRound(tableIndex);
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        if (socket.tableIndex !== undefined) {
            const tableIndex = socket.tableIndex;
            tables[tableIndex].players--;
            tables[tableIndex].sockets = tables[tableIndex].sockets.filter(s => s.id !== socket.id);
            io.emit('lobbyUpdate', tables.map(table => ({ players: table.players })));

            if (tables[tableIndex].players === 1) {
                io.to(`table${tableIndex}`).emit('playerLeft');
            }
        }
    });
});

function startGame(tableIndex) {
    const table = tables[tableIndex];
    table.sockets[0].join(`table${tableIndex}`);
    table.sockets[1].join(`table${tableIndex}`);

    table.sockets[0].emit('gameStart', { role: 'drawer' });
    table.sockets[1].emit('gameStart', { role: 'guesser' });

    startNewRound(tableIndex);
}

function startNewRound(tableIndex) {
    const word = words[Math.floor(Math.random() * words.length)];
    io.to(`table${tableIndex}`).emit('newRound', { word });
}

function endRound(tableIndex) {
    const table = tables[tableIndex];
    [table.sockets[0], table.sockets[1]] = [table.sockets[1], table.sockets[0]];
    table.sockets[0].emit('gameStart', { role: 'drawer' });
    table.sockets[1].emit('gameStart', { role: 'guesser' });
    startNewRound(tableIndex);
}

http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
