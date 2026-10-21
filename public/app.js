const socket = io();

const joinForm = document.getElementById('joinForm');
const usernameInput = document.getElementById('usernameInput');
const roomInput = document.getElementById('roomInput');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const messagesEl = document.getElementById('messages');
const userListEl = document.getElementById('userList');
const userCountEl = document.getElementById('userCount');
const roomLabelEl = document.getElementById('roomLabel');
const leaveBtn = document.getElementById('leaveBtn');
const typingIndicator = document.getElementById('typingIndicator');

let currentRoom = 'general';
let currentUser = '';
let isJoined = false;
let typingTimeout = null;

function addMessage({ username, text, type = 'other', time = null }) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${type}`;

  const header = document.createElement('div');
  header.className = 'message-header';

  const author = document.createElement('strong');
  author.textContent = type === 'system' ? 'System' : username;

  const stamp = document.createElement('span');
  if (time) {
    stamp.textContent = new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  header.appendChild(author);
  if (stamp.textContent) header.appendChild(stamp);

  const body = document.createElement('div');
  body.className = 'message-text';
  body.textContent = text;

  wrapper.appendChild(header);
  wrapper.appendChild(body);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderUsers(users) {
  userListEl.innerHTML = '';

  users.forEach((name) => {
    const li = document.createElement('li');
    li.textContent = name;
    userListEl.appendChild(li);
  });

  userCountEl.textContent = String(users.length);
}

function setRoomLabel(room) {
  currentRoom = room;
  roomLabelEl.textContent = room;
}

function startTyping() {
  if (!isJoined) return;

  socket.emit('typing', { isTyping: true });

  if (typingTimeout) {
    clearTimeout(typingTimeout);
  }

  typingTimeout = setTimeout(() => {
    socket.emit('typing', { isTyping: false });
  }, 1200);
}

joinForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  const room = roomInput.value.trim() || 'general';

  if (!username) {
    usernameInput.focus();
    return;
  }

  currentUser = username;
  isJoined = true;
  setRoomLabel(room);

  socket.emit('joinRoom', { username, room });
  messageInput.focus();
});

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();

  if (!isJoined) {
    usernameInput.focus();
    return;
  }

  const text = messageInput.value.trim();
  if (!text) return;

  socket.emit('chatMessage', text);
  addMessage({
    username: currentUser,
    text,
    type: 'self',
    time: new Date().toISOString()
  });

  messageInput.value = '';
  socket.emit('typing', { isTyping: false });
});

messageInput.addEventListener('input', () => {
  if (isJoined) {
    startTyping();
  }
});

leaveBtn.addEventListener('click', () => {
  if (!isJoined) return;

  socket.emit('leaveRoom');
  isJoined = false;
  currentUser = '';
  roomLabelEl.textContent = 'general';
  userListEl.innerHTML = '';
  userCountEl.textContent = '0';
  typingIndicator.classList.add('hidden');
  addMessage({
    text: 'You left the room.',
    type: 'system'
  });
});

socket.on('roomJoined', ({ room, username }) => {
  currentUser = username;
  setRoomLabel(room);
  addMessage({
    text: `Welcome, ${username}! You're in room "${room}".`,
    type: 'system'
  });
});

socket.on('chatMessage', ({ username, text, time }) => {
  const type = username === currentUser ? 'self' : 'other';
  addMessage({ username, text, type, time });
  typingIndicator.classList.add('hidden');
});

socket.on('systemMessage', ({ text }) => {
  addMessage({ text, type: 'system' });
});

socket.on('roomUsers', ({ users }) => {
  renderUsers(users);
});

socket.on('typing', ({ username, isTyping }) => {
  if (username === currentUser) return;

  if (isTyping) {
    typingIndicator.textContent = `${username} is typing...`;
    typingIndicator.classList.remove('hidden');
  } else {
    typingIndicator.classList.add('hidden');
  }
});

window.addEventListener('beforeunload', () => {
  if (isJoined) {
    socket.emit('leaveRoom');
  }
});

addMessage({
  text: 'Choose a nickname and enter a room to begin chatting.',
  type: 'system'
});
