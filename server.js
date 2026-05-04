const WebSocket = require('ws');
const server = new WebSocket.Server({ port: process.env.PORT || 8080 });

const rooms = new Map();

server.on('connection', (ws) => {
    let currentRoom = null;
    let playerSymbol = null;

    ws.on('message', (msg) => {
        let data;
        try { data = JSON.parse(msg); } catch(e) { return; }

        if (data.type === 'checkRoom') {
            const room = rooms.get(data.roomId);
            if (room && room.players.length < 2) {
                ws.send(JSON.stringify({ type: 'roomExists' }));
            } else if (room && room.players.length >= 2) {
                ws.send(JSON.stringify({ type: 'error', message: 'Комната заполнена' }));
            } else {
                ws.send(JSON.stringify({ type: 'roomNotFound' }));
            }
        }

        if (data.type === 'create') {
            const roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
            rooms.set(roomId, { players: [ws], symbols: ['X'] });
            currentRoom = roomId;
            playerSymbol = 'X';
            ws.send(JSON.stringify({ type: 'roomCreated', roomId, symbol: 'X' }));
        }

        if (data.type === 'createPermanent') {
            const roomId = data.roomId || Math.random().toString(36).substr(2, 8);
            if (!rooms.has(roomId)) {
                rooms.set(roomId, { players: [ws], symbols: ['X'], permanent: true });
                currentRoom = roomId;
                playerSymbol = 'X';
                ws.send(JSON.stringify({ type: 'roomCreated', roomId, symbol: 'X' }));
            } else {
                ws.send(JSON.stringify({ type: 'error', message: 'Комната с таким кодом уже существует' }));
            }
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
            } else if (room && room.players.length >= 2) {
                ws.send(JSON.stringify({ type: 'error', message: 'Комната заполнена' }));
            } else {
                ws.send(JSON.stringify({ type: 'error', message: 'Комната не найдена' }));
            }
        }

        if (data.type === 'move' || data.type === 'fixFigure') {
            const room = rooms.get(currentRoom);
            if (room) {
                room.players.forEach((player) => {
                    if (player !== ws) player.send(JSON.stringify(data));
                });
            }
        }

        if (data.type === 'leave') {
            const room = rooms.get(currentRoom);
            if (room) {
                const otherPlayer = room.players.find(p => p !== ws);
                if (otherPlayer) otherPlayer.send(JSON.stringify({ type: 'opponentLeft' }));
                if (!room.permanent) {
                    rooms.delete(currentRoom);
                }
            }
        }
    });

    ws.on('close', () => {
        if (currentRoom) {
            const room = rooms.get(currentRoom);
            if (room) {
                const otherPlayer = room.players.find(p => p !== ws);
                if (otherPlayer) otherPlayer.send(JSON.stringify({ type: 'opponentLeft' }));
                if (!room.permanent) rooms.delete(currentRoom);
            }
        }
    });
});

console.log('Server running');
