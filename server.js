const WebSocket = require('ws');
const server = new WebSocket.Server({ port: process.env.PORT || 8080 });
const rooms = new Map();
const onlineProfiles = new Map(); // playerId -> { ws, nickname }

server.on('connection', (ws) => {
    let currentRoom = null;
    let playerSymbol = null;
    let playerId = null;

    ws.on('message', (msg) => {
        let data;
        try { data = JSON.parse(msg); } catch(e) { return; }

        // Регистрация профиля для приёма запросов дружбы
        if (data.type === 'registerForFriends') {
            playerId = data.playerId;
            onlineProfiles.set(playerId, { ws, nickname: playerProfile?.nickname || '' });
        }

        // Проверка профиля при входе
        if (data.type === 'checkProfile') {
            const profile = onlineProfiles.get(data.playerId);
            if (profile && profile.nickname === data.nickname) {
                ws.send(JSON.stringify({ type: 'profileOnline', nickname: data.nickname, playerId: data.playerId }));
            } else {
                ws.send(JSON.stringify({ type: 'profileOffline' }));
            }
        }

        // Запрос дружбы
        if (data.type === 'friendRequest') {
            const target = onlineProfiles.get(data.to);
            if (target && target.ws.readyState === WebSocket.OPEN) {
                target.ws.send(JSON.stringify({
                    type: 'friendRequest',
                    from: data.from,
                    fromNickname: data.fromNickname
                }));
            }
        }

        // Принятие запроса дружбы
        if (data.type === 'friendRequestAccepted') {
            const target = onlineProfiles.get(data.to);
            if (target && target.ws.readyState === WebSocket.OPEN) {
                target.ws.send(JSON.stringify({
                    type: 'friendRequestAccepted',
                    fromId: data.from,
                    fromNickname: data.fromNickname
                }));
            }
        }

        // Отклонение запроса дружбы
        if (data.type === 'friendRequestDeclined') {
            const target = onlineProfiles.get(data.to);
            if (target && target.ws.readyState === WebSocket.OPEN) {
                target.ws.send(JSON.stringify({
                    type: 'friendRequestDeclined',
                    fromNickname: data.fromNickname
                }));
            }
        }

        // Поиск случайного соперника
        if (data.type === 'findRandom') {
            let foundRoom = null;
            for (const [roomId, room] of rooms) {
                if (room.players.length === 1 && !room.permanent) {
                    foundRoom = roomId; break;
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
                rooms.set(roomId, { players: [ws], symbols: ['X'], timeout });
                currentRoom = roomId;
                playerSymbol = 'X';
                ws.send(JSON.stringify({ type: 'waiting', roomId, symbol: 'X' }));
            }
        }

        // Игра с другом
        if (data.type === 'friendConnect') {
            const roomKey = data.roomName + ':' + data.password;
            let room = rooms.get(roomKey);
            if (!room) {
                room = { players: [ws], symbols: ['X'], permanent: true };
                rooms.set(roomKey, room);
                currentRoom = roomKey; playerSymbol = 'X';
                ws.send(JSON.stringify({ type: 'waiting', roomId: data.roomName, symbol: 'X' }));
            } else if (room.players.length < 2) {
                room.players.push(ws); room.symbols.push('O');
                currentRoom = roomKey; playerSymbol = 'O';
                ws.send(JSON.stringify({ type: 'friendRoom', roomId: data.roomName, symbol: 'O' }));
                room.players[0].send(JSON.stringify({ type: 'opponentJoined' }));
            } else {
                ws.send(JSON.stringify({ type: 'error', message: 'Комната заполнена' }));
            }
        }

        // Пересылка ходов, фигур, таймаутов, playAgain, приглашений
        if (data.type === 'move' || data.type === 'fixFigure' || data.type === 'timeout' || data.type === 'playAgain' || data.type === 'friendInvite' || data.type === 'friendGameSetup') {
            const room = rooms.get(currentRoom);
            if (room) {
                room.players.forEach((player) => {
                    if (player !== ws && player.readyState === WebSocket.OPEN) {
                        player.send(JSON.stringify(data));
                    }
                });
            }
        }

        // Выход
        if (data.type === 'leave') {
            const room = rooms.get(currentRoom);
            if (room) {
                const other = room.players.find(p => p !== ws);
                if (other && other.readyState === WebSocket.OPEN) other.send(JSON.stringify({ type: 'opponentLeft' }));
                if (!room.permanent) rooms.delete(currentRoom);
            }
        }
    });

    ws.on('close', () => {
        if (currentRoom) {
            const room = rooms.get(currentRoom);
            if (room) {
                const other = room.players.find(p => p !== ws);
                if (other && other.readyState === WebSocket.OPEN) other.send(JSON.stringify({ type: 'opponentLeft' }));
                if (!room.permanent) rooms.delete(currentRoom);
            }
        }
        if (playerId) onlineProfiles.delete(playerId);
    });
});

console.log('Server running');
