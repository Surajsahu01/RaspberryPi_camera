import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { WebSocketServer } from 'ws';
import cameraRoutes from './routes/cameraRoutes.js';
import { connectDB } from './database/db.js';
// import { connectDB } from './database/db.js';

const app = express();
// const PORT = 5000;

// Connect MongoDB
// connectDB();
connectDB();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(path.resolve(), 'uploads')));
app.use('/api/camera', cameraRoutes);

// WebSocket servers
const wssFrontend = new WebSocketServer({ noServer: true });
const wssPi = new WebSocketServer({ noServer: true });

const piConnections = new Map();  // piId -> ws
const clients = new Set();        // frontend clients

// Pi WS connection
wssPi.on('connection', ws => {
  let piId = null;

  ws.on('message', msg => {
    const data = JSON.parse(msg.toString());

    if (data.type === 'register') {
      piId = data.piId;
      piConnections.set(piId, ws);
      console.log(`Pi registered: ${piId}`);
    }

    if (data.type === 'frame' && piId) {
      clients.forEach(client => {
        if (client.piId === piId && client.readyState === 1) {
          client.send(data.frame);
        }
      });
    }
  });

  ws.on('close', () => {
    if (piId) piConnections.delete(piId);
  });
});

// Frontend WS connection
wssFrontend.on('connection', ws => {
  ws.on('message', msg => {
    const data = JSON.parse(msg.toString());
    ws.piId = data.piId; // which Pi to watch
  });
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});


const PORT = process.env.PORT || 5000;
// Upgrade HTTP to WebSocket
const server = app.listen(PORT, () => console.log(`Server running on ${PORT}`));
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws/pi') {
    wssPi.handleUpgrade(req, socket, head, ws => wssPi.emit('connection', ws, req));
  } else if (req.url === '/ws/live') {
    wssFrontend.handleUpgrade(req, socket, head, ws => wssFrontend.emit('connection', ws, req));
  }
});
