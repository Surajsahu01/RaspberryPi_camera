import { useEffect, useRef, useState } from "react";

export default function Dashboard() {
  const videoRef = useRef();
  const ws = useRef(null);

  const [pc] = useState(new RTCPeerConnection());

  const start = () => {
    ws.current = new WebSocket("wss://raspberrypi-camera.onrender.com");

    ws.current.onopen = () => {
      ws.current.send(JSON.stringify({ role: "client" }));
    };

    ws.current.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);

      if (data.type === "answer") {
        await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
      }

      if (data.type === "candidate") {
        try {
          await pc.addIceCandidate({ candidate: data.candidate, sdpMid: "0" });
        } catch {}
      }
    };

    pc.ontrack = (event) => {
      videoRef.current.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        ws.current.send(
          JSON.stringify({ to: "pi", type: "candidate", candidate: event.candidate.candidate })
        );
      }
    };

    (async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      ws.current.send({
        to: "pi",
        type: "offer",
        sdp: offer.sdp
      });
    })();
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
        <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg"></video>
      </div>
    </div>
  );
}
