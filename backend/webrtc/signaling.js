import { WebSocketServer } from "ws";

let piSocket = null;
let clientSocket = null;

export const initSignaling = (server) => {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg);

        if (data.role === "pi") {
          piSocket = ws;
          console.log("PI Connected");
        }

        if (data.role === "client") {
          clientSocket = ws;
          console.log("Client Connected");
        }

        // forward messages
        if (data.to === "client" && clientSocket)
          clientSocket.send(JSON.stringify(data));

        if (data.to === "pi" && piSocket)
          piSocket.send(JSON.stringify(data));

      } catch (e) {
        console.log("WS error:", e);
      }
    });

    ws.on("close", () => {
      if (ws === piSocket) piSocket = null;
      if (ws === clientSocket) clientSocket = null;
    });
  });

  console.log("WebRTC Signaling Ready");
};
