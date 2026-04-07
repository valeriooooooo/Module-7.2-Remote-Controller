const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const HOST = '0.0.0.0';
const rootDir = path.join(__dirname, '..');

const server = http.createServer((req, res) => {
  const requested = req.url === '/' ? '/controller.html' : req.url;
  const safePath = path.normalize(requested).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(rootDir, safePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8'
    };

    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

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
    if (laptop === ws) laptop = null;
    if (phone === ws) phone = null;
    console.log('Client disconnected');
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://10.16.30.213:${PORT}`);
  console.log(`Controller URL: http://10.16.30.213:${PORT}/controller.html`);
});