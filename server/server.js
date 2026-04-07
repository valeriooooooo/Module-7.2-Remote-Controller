const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

let laptop = null;
let phone = null;

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'laptop') {
      laptop = ws;
      console.log('Laptop connected');
    }

    if (data.type === 'phone') {
      phone = ws;
      console.log('Phone connected');
    }

    if (data.type === 'joystick' && laptop) {
      laptop.send(JSON.stringify(data));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// 👇 DIT IS BELANGRIJK
console.log('Server running on ws://localhost:8080');