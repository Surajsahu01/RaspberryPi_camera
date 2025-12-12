// import { WebSocketServer } from "ws";

// let piSocket = null;
// let clientSocket = null;

// export const initSignaling = (server) => {
//   const wss = new WebSocketServer({ server });

//   wss.on("connection", (ws) => {
//     ws.on("message", (msg) => {
//       try {
//         const data = JSON.parse(msg);

//         if (data.role === "pi") {
//           piSocket = ws;
//           console.log("PI Connected");
//         }

//         if (data.role === "client") {
//           clientSocket = ws;
//           console.log("Client Connected");
//         }

//         // forward messages
//         if (data.to === "client" && clientSocket)
//           clientSocket.send(JSON.stringify(data));

//         if (data.to === "pi" && piSocket)
//           piSocket.send(JSON.stringify(data));

//       } catch (e) {
//         console.log("WS error:", e);
//       }
//     });

//     ws.on("close", () => {
//       if (ws === piSocket) piSocket = null;
//       if (ws === clientSocket) clientSocket = null;
//     });
//   });

//   console.log("WebRTC Signaling Ready");
// };



// // src/signaling.js
// import { WebSocketServer } from "ws";

// const pis = new Map();     // piId -> ws
// const clients = new Set(); // all client sockets

// export function initSignaling(server) {
//   const wss = new WebSocketServer({ server });

//   wss.on("connection", (ws, req) => {
//     console.log("WS connected:", req.socket.remoteAddress);

//     ws.isAlive = true;
//     ws.on("pong", () => (ws.isAlive = true));

//     ws.on("message", (raw) => {
//       let msg;
//       try {
//         msg = JSON.parse(raw);
//       } catch (e) {
//         console.warn("invalid ws json");
//         return;
//       }

//       // Registration
//       if (msg.role === "pi" && msg.piId) {
//         ws.role = "pi";
//         ws.piId = msg.piId;
//         pis.set(msg.piId, ws);
//         console.log("Registered PI:", msg.piId);
//         return;
//       }

//       if (msg.role === "client") {
//         ws.role = "client";
//         clients.add(ws);
//         console.log("Registered client");
//         return;
//       }

//       // Forwarding logic: to pi or to client(s)
//       // If message contains to: "pi" and piId, forward to that pi
//       if (msg.to === "pi" && msg.piId) {
//         const piWs = pis.get(msg.piId);
//         if (piWs && piWs.readyState === piWs.OPEN) {
//           piWs.send(JSON.stringify(msg));
//         } else {
//           console.warn("PI not connected:", msg.piId);
//         }
//         return;
//       }

//       // If message targets client(s): forward to all current clients
//       if (msg.to === "client") {
//         // broadcast to all clients (could be optimized to target specific client)
//         for (const c of clients) {
//           if (c.readyState === c.OPEN) {
//             try {
//               c.send(JSON.stringify(msg));
//             } catch (e) {
//               console.warn("send to client failed", e);
//             }
//           }
//         }
//         return;
//       }

//       // If it's a capture uploaded/forwarded from pi, broadcast to clients
//       if (msg.type === "capture" && msg.imageBase64) {
//         for (const c of clients) {
//           if (c.readyState === c.OPEN) {
//             try {
//               c.send(JSON.stringify({
//                 type: "capture",
//                 piId: msg.piId || null,
//                 imageBase64: msg.imageBase64
//               }));
//             } catch (e) {}
//           }
//         }
//         return;
//       }

//       // fallback: unknown message
//       console.log("Unhandled ws message:", msg);
//     });

//     ws.on("close", () => {
//       if (ws.role === "pi" && ws.piId) {
//         pis.delete(ws.piId);
//         console.log("PI disconnected:", ws.piId);
//       }
//       if (ws.role === "client") {
//         clients.delete(ws);
//         console.log("Client disconnected");
//       }
//     });

//     ws.on("error", (err) => {
//       console.warn("WS error:", err);
//     });
//   });

//   // basic ping to keep connections alive & detect dead peers
//   const interval = setInterval(() => {
//     wss.clients.forEach((ws) => {
//       if (ws.isAlive === false) {
//         return ws.terminate();
//       }
//       ws.isAlive = false;
//       ws.ping(() => {});
//     });
//   }, 30000);

//   wss.on("close", () => clearInterval(interval));

//   console.log("Signaling server ready");
//   return wss;
// }

// src/signaling.js
import { WebSocketServer } from "ws";

const pis = new Map();     // piId -> ws
const clients = new Set(); // ws objects

export function initSignaling(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    console.log("WS connected from", req.socket.remoteAddress);

    ws.isAlive = true;
    ws.on("pong", () => (ws.isAlive = true));

    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch (e) {
        console.warn("Invalid JSON from ws:", raw);
        return;
      }
      console.log("signaling recv:", msg);

      // Registration
      if (msg.role === "pi" && msg.piId) {
        ws.role = "pi";
        ws.piId = msg.piId;
        pis.set(msg.piId, ws);
        console.log("Registered PI:", msg.piId);
        return;
      }

      if (msg.role === "client") {
        ws.role = "client";
        clients.add(ws);
        console.log("Registered client for PI:", msg.piId || "all");
        return;
      }

      // Forward to specific pi
      if (msg.to === "pi" && msg.piId) {
        const piWs = pis.get(msg.piId);
        if (piWs && piWs.readyState === piWs.OPEN) {
          console.log("Forwarding to PI", msg.piId, msg.type);
          piWs.send(JSON.stringify(msg));
        } else {
          console.warn("PI not connected:", msg.piId);
        }
        return;
      }

      // Forward to clients (e.g. answer/candidates from pi are broadcasted)
      if (msg.to === "client") {
        console.log("Forwarding to clients:", msg.type);
        for (const c of clients) {
          if (c.readyState === c.OPEN) {
            try {
              c.send(JSON.stringify(msg));
            } catch (e) {
              console.warn("Failed send to client", e);
            }
          }
        }
        return;
      }

      // If message is capture broadcast from anywhere
      if (msg.type === "capture" && msg.imageBase64) {
        for (const c of clients) {
          if (c.readyState === c.OPEN) {
            c.send(JSON.stringify({ type: "capture", piId: msg.piId, imageBase64: msg.imageBase64 }));
          }
        }
        return;
      }

      console.log("Unhandled signaling message:", msg);
    });

    ws.on("close", () => {
      if (ws.role === "pi" && ws.piId) {
        pis.delete(ws.piId);
        console.log("PI disconnected:", ws.piId);
      }
      if (ws.role === "client") {
        clients.delete(ws);
        console.log("Client disconnected");
      }
    });

    ws.on("error", (err) => {
      console.warn("WS error:", err);
    });
  });

  // ping/pong keepalive
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  console.log("Signaling server ready");
  return wss;
}

