const WebSocket = require('ws');
const server = new WebSocket.Server({ port: process.env.PORT || 8080 });
const rooms = new Map();

server.on('connection', (ws) => {
    let currentRoom = null;
    let playerSymbol = null;

    ws.on('message', (msg) => {
        let data;
        try { data = JSON.parse(msg); } catch(e) { return; }

       if (data.type === 'findRandom') {
    let foundRoom = null;
    for (const [roomId, room] of rooms) {
        if (room.players.length === 1 && !room.permanent) {
            foundRoom = roomId;
            break;
        }
    }
    
    if (foundRoom) {
        const room = rooms.get(foundRoom);
        clearTimeout(room.timeout);
        room.players.push(ws);
        room.symbols.push('O');
        currentRoom = foundRoom;
        playerSymbol = 'O';
        ws.send(JSON.stringify({ type: 'randomRoom', roomId: foundRoom, symbol: 'O' }));
        room.players[0].send(JSON.stringify({ type: 'opponentJoined' }));
    } else {
        const roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const timeout = setTimeout(() => {
            const room = rooms.get(roomId);
            if (room && room.players.length === 1) {
                rooms.delete(roomId);
                room.players[0].send(JSON.stringify({ type: 'error', message: 'Соперник не найден' }));
            }
        }, 15000);
        rooms.set(roomId, { players: [ws], symbols: ['X'], timeout: timeout });
        currentRoom = roomId;
        playerSymbol = 'X';
        ws.send(JSON.stringify({ type: 'waiting', roomId, symbol: 'X' }));
    }
}

        if (data.type === 'friendConnect') {
            const roomKey = data.roomName + ':' + data.password;
            let room = rooms.get(roomKey);
            if (!room) {
                room = { players: [ws], symbols: ['X'], permanent: true };
                rooms.set(roomKey, room);
                currentRoom = roomKey;
                playerSymbol = 'X';
                ws.send(JSON.stringify({ type: 'waiting', roomId: data.roomName, symbol: 'X' }));
            } else if (room.players.length < 2) {
                room.players.push(ws);
                room.symbols.push('O');
                currentRoom = roomKey;
                playerSymbol = 'O';
                ws.send(JSON.stringify({ type: 'friendRoom', roomId: data.roomName, symbol: 'O' }));
                room.players[0].send(JSON.stringify({ type: 'opponentJoined' }));
            } else {
                ws.send(JSON.stringify({ type: 'error', message: 'Комната заполнена' }));
            }
        }

        if (data.type === 'move' || data.type === 'fixFigure' || data.type === 'timeout') {
            const room = rooms.get(currentRoom);
            if (room) {
                room.players.forEach((player) => {
                    if (player !== ws && player.readyState === WebSocket.OPEN) {
                        player.send(JSON.stringify(data));
                    }
                });
            }
        }

        if (data.type === 'leave') {
            const room = rooms.get(currentRoom);
            if (room) {
                const otherPlayer = room.players.find(p => p !== ws);
                if (otherPlayer && otherPlayer.readyState === WebSocket.OPEN) {
                    otherPlayer.send(JSON.stringify({ type: 'opponentLeft' }));
                }
                if (!room.permanent) rooms.delete(currentRoom);
            }
        }
    });

    ws.on('close', () => {
        if (currentRoom) {
            const room = rooms.get(currentRoom);
            if (room) {
                const otherPlayer = room.players.find(p => p !== ws);
                if (otherPlayer && otherPlayer.readyState === WebSocket.OPEN) {
                    otherPlayer.send(JSON.stringify({ type: 'opponentLeft' }));
                }
                if (!room.permanent) rooms.delete(currentRoom);
            }
        }
    });
});

console.log('Server running');
