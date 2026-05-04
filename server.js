const WebSocket = require('ws');
const server = new WebSocket.Server({ port: process.env.PORT || 8080 });

const rooms = new Map();

server.on('connection', (ws) => {
    let currentRoom = null;
    let playerSymbol = null;

    ws.on('message', (msg) => {
        const data = JSON.parse(msg);

        if (data.type === 'create') {
            const roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
            rooms.set(roomId, { players: [ws], symbols: ['X'] });
            currentRoom = roomId;
            playerSymbol = 'X';
            ws.send(JSON.stringify({ type: 'roomCreated', roomId, symbol: 'X' }));
        }

        if (data.type === 'join') {
            const room = rooms.get(data.roomId);
            if (room && room.players.length < 2) {
                room.players.push(ws);
                room.symbols.push('O');
                currentRoom = data.roomId;
                playerSymbol = 'O';
                ws.send(JSON.stringify({ type: 'joined', symbol: 'O' }));
                room.players[0].send(JSON.stringify({ type: 'opponentJoined' }));
            } else {
                ws.send(JSON.stringify({ type: 'error', message: 'Комната не найдена или заполнена' }));
            }
        }

        if (data.type === 'move' || data.type === 'fixFigure') {
            const room = rooms.get(currentRoom);
            if (room) {
                room.players.forEach((player, i) => {
                    if (player !== ws) {
                        player.send(JSON.stringify(data));
                    }
                });
            }
        }

        if (data.type === 'playAgain') {
            const room = rooms.get(currentRoom);
            if (room) {
                room.players.forEach((player, i) => {
                    if (player !== ws) {
                        player.send(JSON.stringify({ type: 'playAgain' }));
                    }
                });
            }
        }
    });

    ws.on('close', () => {
        if (currentRoom) {
            const room = rooms.get(currentRoom);
            if (room) {
                const otherPlayer = room.players.find(p => p !== ws);
                if (otherPlayer) {
                    otherPlayer.send(JSON.stringify({ type: 'opponentLeft' }));
                }
                rooms.delete(currentRoom);
            }
        }
    });
});

console.log('Server running on port ' + (process.env.PORT || 8080));
