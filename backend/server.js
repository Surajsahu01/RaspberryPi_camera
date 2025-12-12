// import express from 'express';
// import cors from 'cors';
// import bodyParser from 'body-parser';
// import path from 'path';
// import { WebSocketServer } from 'ws';
// import cameraRoutes from './routes/cameraRoutes.js';
// import { connectDB } from './database/db.js';
// import http from 'http';

// // import { connectDB } from './database/db.js';
// // import http from 'http';

// // const app = express();
// // // const PORT = 5000;

// // // Connect MongoDB
// // // connectDB();
// // connectDB();

// // // Middleware
// // app.use(cors());
// // app.use(bodyParser.json({ limit: '10mb' }));
// // app.use('/uploads', express.static(path.join(path.resolve(), 'uploads')));
// // app.use('/api/camera', cameraRoutes);

// // // create http server (for WebSocket upgrade)
// // // const server = http.createServer(app);

// // // WebSocket servers
// // const wssFrontend = new WebSocketServer({ noServer: true });
// // const wssPi = new WebSocketServer({ noServer: true });

// // const piConnections = new Map();  // piId -> ws
// // const clients = new Set();        // frontend clients

// // // Pi WS connection
// // wssPi.on('connection', ws => {
// //   let piId = null;

// //   ws.on('message', msg => {
// //     const data = JSON.parse(msg.toString());

// //     if (data.type === 'register') {
// //       piId = data.piId;
// //       piConnections.set(piId, ws);
// //       console.log(`Pi registered: ${piId}`);
// //     }

// //     if (data.type === 'frame' && piId) {
// //       clients.forEach(client => {
// //         if (client.piId === piId && client.readyState === 1) {
// //           client.send(data.frame);
// //         }
// //       });
// //     }
// //   });

// //   ws.on('close', () => {
// //     if (piId) piConnections.delete(piId);
// //   });
// // });

// // // Frontend WS connection
// // wssFrontend.on('connection', ws => {
// //   ws.on('message', msg => {
// //     const data = JSON.parse(msg.toString());
// //     ws.piId = data.piId; // which Pi to watch
// //   });
// //   clients.add(ws);
// //   ws.on('close', () => clients.delete(ws));
// // });


// // const PORT = process.env.PORT || 5000;
// // // Upgrade HTTP to WebSocket
// // const server = app.listen(PORT, () => console.log(`Server running on ${PORT}`));
// // server.on('upgrade', (req, socket, head) => {
// //   if (req.url === '/ws/pi') {
// //     wssPi.handleUpgrade(req, socket, head, ws => wssPi.emit('connection', ws, req));
// //   } else if (req.url === '/ws/live') {
// //     wssFrontend.handleUpgrade(req, socket, head, ws => wssFrontend.emit('connection', ws, req));
// //   }
// // });


// const app = express();
// const PORT = process.env.PORT || 5000;
// // const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cctv';

// // connect DB
// connectDB();

// // middleware
// app.use(cors());
// app.use(bodyParser.json({ limit: '20mb' })); // accept base64 large payloads
// app.use('/uploads', express.static(path.join(path.resolve(), 'uploads')));
// app.use('/api/camera', cameraRoutes);

// // create http server (for WebSocket upgrade)
// const server = http.createServer(app);

// // WebSocket servers — we'll route by path:
// // - Pi connects to /ws/pi/:piId
// // - Frontend connects to /ws/live/:piId

// const wss = new WebSocketServer({ noServer: true });

// // Map of piId -> ws (Pi connections)
// const piConnections = new Map();
// // Map of client ws -> watchingPiId
// const clients = new Map();

// wss.on('connection', (ws, req, clientType, piId) => {
//   // NOTE: we don't use this handler; we'll manage per-upgrade below.
// });

// // handle upgrade manually
// server.on('upgrade', (req, socket, head) => {
//   try {
//     const url = new URL(req.url, `http://${req.headers.host}`);
//     const parts = url.pathname.split('/').filter(Boolean); // split path
//     // Expected: ['ws', 'pi', '<piId>']  OR ['ws','live','<piId>']
//     if (parts.length >= 3 && parts[0] === 'ws') {
//       const kind = parts[1];
//       const piId = parts.slice(2).join('/'); // support piId with slashes if needed

//       if (kind === 'pi') {
//         // Pi connection
//         wss.handleUpgrade(req, socket, head, (wsConn) => {
//           // register Pi
//           console.log('Pi connected:', piId);
//           piConnections.set(piId, wsConn);

//           wsConn.on('message', (message) => {
//             // Expect JSON { type: 'frame', piId, frame: base64 } OR simple JSON register
//             try {
//               const data = JSON.parse(message.toString());
//               if (data.type === 'register') {
//                 // already registered by path, can ignore
//                 return;
//               }
//               if (data.type === 'frame' && data.piId) {
//                 // broadcast base64 frame to all clients watching this piId
//                 for (const [client, watching] of clients.entries()) {
//                   if (watching === data.piId && client.readyState === 1) {
//                     client.send(data.frame); // send base64 string
//                   }
//                 }
//               }
//             } catch (e) {
//               // if message not JSON, ignore
//             }
//           });

//           wsConn.on('close', () => {
//             console.log('Pi disconnected:', piId);
//             if (piConnections.get(piId) === wsConn) piConnections.delete(piId);
//           });

//           // ping/pong keep-alive
//           wsConn.isAlive = true;
//           wsConn.on('pong', () => wsConn.isAlive = true);
//         });

//         return;
//       } else if (kind === 'live') {
//         // Frontend connection
//         wss.handleUpgrade(req, socket, head, (wsConn) => {
//           // register client
//           console.log('Frontend client connected, watching:', piId);
//           clients.set(wsConn, piId);

//           wsConn.on('message', (msg) => {
//             // optional: allow client to change watched pi by sending {"piId":"..."}
//             try {
//               const d = JSON.parse(msg.toString());
//               if (d.piId) clients.set(wsConn, d.piId);
//             } catch (e) {}
//           });

//           wsConn.on('close', () => {
//             clients.delete(wsConn);
//           });

//           // ping/pong keep-alive
//           wsConn.isAlive = true;
//           wsConn.on('pong', () => wsConn.isAlive = true);
//         });

//         return;
//       }
//     }

//     // otherwise reject upgrade
//     socket.destroy();
//   } catch (err) {
//     console.error('Upgrade error:', err);
//     socket.destroy();
//   }
// });

// // simple periodic ping to keep connections alive and remove dead ones
// setInterval(() => {
//   // Pi connections
//   for (const [piId, wsConn] of piConnections.entries()) {
//     if (wsConn.isAlive === false) {
//       wsConn.terminate();
//       piConnections.delete(piId);
//     } else {
//       wsConn.isAlive = false;
//       wsConn.ping();
//     }
//   }
//   // clients
//   for (const [client, watching] of clients.entries()) {
//     if (client.isAlive === false) {
//       client.terminate();
//       clients.delete(client);
//     } else {
//       client.isAlive = false;
//       client.ping();
//     }
//   }
// }, 10000);

// server.listen(PORT, () => console.log(`Server listening on ${PORT}`));


import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
// import { connectDB } from "./db.js";
import { connectDB } from "./database/db.js";
import cameraRoutes from "./routes/cameraRoutes.js";
import { initSignaling } from "./webrtc/signaling.js";

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.use("/api/camera", cameraRoutes);

const server = http.createServer(app);
initSignaling(server);

server.listen(process.env.PORT, () =>
  console.log("Backend running on port", process.env.PORT)
);
