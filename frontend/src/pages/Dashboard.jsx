import { useEffect, useRef, useState } from "react";

export default function Dashboard() {
  const videoRef = useRef();
  const ws = useRef(null);
  const pc = useRef(null);

  const safeSend = (data) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    } else {
      console.warn("WS not open, message skipped:", data);
    }
  };

  const start = () => {
    // Create RTCPeerConnection
    pc.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // WebSocket
    ws.current = new WebSocket("wss://raspberrypi-camera.onrender.com");

    ws.current.onopen = async () => {
      console.log("WS CONNECTED");
      safeSend({ role: "client" });

      // Create offer only AFTER WS is open
      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);

      safeSend({
        to: "pi",
        type: "offer",
        sdp: offer.sdp,
      });
    };

    ws.current.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);

      if (data.type === "answer") {
        await pc.current.setRemoteDescription({
          type: "answer",
          sdp: data.sdp,
        });
      }

      if (data.type === "candidate") {
        try {
          await pc.current.addIceCandidate({
            candidate: data.candidate,
            sdpMid: "0",
          });
        } catch (e) {
          console.error("ICE add error", e);
        }
      }
    };

    // Receive remote video
    pc.current.ontrack = (event) => {
      videoRef.current.srcObject = event.streams[0];
    };

    // Send ICE candidate to PI
    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        safeSend({
          to: "pi",
          type: "candidate",
          candidate: event.candidate.candidate,
        });
      }
    };
  };

  const capture = async () => {
    await fetch("https://raspberrypi-camera.onrender.com/api/camera/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ piId: "pi_001" }),
    });
  };

  return (
    <div className="p-10">
      <button
        className="bg-blue-600 text-white px-5 py-2 rounded"
        onClick={start}
      >
        Start Live Stream
      </button>

      <button
        className="bg-green-600 text-white px-5 py-2 rounded ml-4"
        onClick={capture}
      >
        Capture Image
      </button>

      <div className="mt-5">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full rounded-lg"
        ></video>
      </div>
    </div>
  );
}
