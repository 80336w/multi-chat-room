const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = new Map();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function getUsersInRoom(room) {
  const members = rooms.get(room);
  if (!members) return [];
  return Array.from(members.values());
}

function leaveRoom(socket) {
  const room = socket.data.room;
  const username = socket.data.username;

  if (!room || !username) return;

  const members = rooms.get(room);

  if (members) {
    members.delete(socket.id);

    if (members.size === 0) {
      rooms.delete(room);
    } else {
      io.to(room).emit('roomUsers', { users: getUsersInRoom(room) });
    }

    io.to(room).emit('systemMessage', { text: `${username} left the room.` });
  }

  socket.leave(room);
  socket.data.room = null;
  socket.data.username = null;
}

io.on('connection', (socket) => {
  socket.data.room = null;
  socket.data.username = null;

  socket.on('joinRoom', ({ username, room }) => {
    const safeUsername = String(username || '').trim().slice(0, 20);
    const safeRoom = String(room || 'general').trim() || 'general';

    if (!safeUsername) {
      socket.emit('systemMessage', { text: 'Please choose a valid username.' });
      return;
    }

    const currentRoom = socket.data.room;
    if (currentRoom && currentRoom !== safeRoom) {
      leaveRoom(socket);
    }

    if (currentRoom === safeRoom && socket.data.username === safeUsername) {
      socket.emit('systemMessage', { text: `You are already in room "${safeRoom}".` });
      return;
    }

    if (!rooms.has(safeRoom)) {
      rooms.set(safeRoom, new Map());
    }

    const roomMembers = rooms.get(safeRoom);
    const usernameTaken = Array.from(roomMembers.values()).includes(safeUsername);

    if (usernameTaken) {
      socket.emit('systemMessage', {
        text: `Username "${safeUsername}" is already taken in room "${safeRoom}". Please choose another one.`
      });
      return;
    }

    socket.data.room = safeRoom;
    socket.data.username = safeUsername;
    roomMembers.set(socket.id, safeUsername);
    socket.join(safeRoom);

    io.to(safeRoom).emit('systemMessage', {
      text: `${safeUsername} joined the room.`
    });
    io.to(safeRoom).emit('roomUsers', { users: getUsersInRoom(safeRoom) });
    socket.emit('roomJoined', { room: safeRoom, username: safeUsername });
    socket.emit('roomUsers', { users: getUsersInRoom(safeRoom) });
  });

  socket.on('chatMessage', (text) => {
    const room = socket.data.room;
    const username = socket.data.username;
    const cleanText = String(text || '').trim();

    if (!room || !username || !cleanText) return;

    io.to(room).emit('chatMessage', {
      username,
      text: cleanText,
      time: new Date().toISOString()
    });
  });

  socket.on('typing', ({ isTyping }) => {
    const room = socket.data.room;
    const username = socket.data.username;

    if (!room || !username) return;

    socket.to(room).emit('typing', {
      username,
      isTyping: Boolean(isTyping)
    });
  });

  socket.on('leaveRoom', () => {
    leaveRoom(socket);
  });

  socket.on('disconnect', () => {
    leaveRoom(socket);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Multi chat room server running on http://localhost:${PORT}`);
});
