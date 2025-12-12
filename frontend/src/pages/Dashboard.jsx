// import { useEffect, useRef, useState } from "react";

// export default function Dashboard() {
//   const videoRef = useRef();
//   const ws = useRef(null);
//   const pc = useRef(null);

//   const safeSend = (data) => {
//     if (ws.current && ws.current.readyState === WebSocket.OPEN) {
//       ws.current.send(JSON.stringify(data));
//     } else {
//       console.warn("WS not open, message skipped:", data);
//     }
//   };

//   const start = () => {
//     // Create RTCPeerConnection
//     pc.current = new RTCPeerConnection({
//       iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//     });

//     // WebSocket
//     ws.current = new WebSocket("wss://raspberrypi-camera.onrender.com");

//     ws.current.onopen = async () => {
//       console.log("WS CONNECTED");
//       safeSend({ role: "client" });

//       // Create offer only AFTER WS is open
//       const offer = await pc.current.createOffer();
//       await pc.current.setLocalDescription(offer);

//       safeSend({
//         to: "pi",
//         type: "offer",
//         sdp: offer.sdp,
//       });
//     };

//     ws.current.onmessage = async (msg) => {
//       const data = JSON.parse(msg.data);

//       if (data.type === "answer") {
//         await pc.current.setRemoteDescription({
//           type: "answer",
//           sdp: data.sdp,
//         });
//       }

//       if (data.type === "candidate") {
//         try {
//           await pc.current.addIceCandidate({
//             candidate: data.candidate,
//             sdpMid: "0",
//           });
//         } catch (e) {
//           console.error("ICE add error", e);
//         }
//       }
//     };

//     // Receive remote video
//     pc.current.ontrack = (event) => {
//       videoRef.current.srcObject = event.streams[0];
//     };

//     // Send ICE candidate to PI
//     pc.current.onicecandidate = (event) => {
//       if (event.candidate) {
//         safeSend({
//           to: "pi",
//           type: "candidate",
//           candidate: event.candidate.candidate,
//         });
//       }
//     };
//   };

//   const capture = async () => {
//     await fetch("https://raspberrypi-camera.onrender.com/api/camera/trigger", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ piId: "pi_001" }),
//     });
//   };

//   return (
//     <div className="p-10">
//       <button
//         className="bg-blue-600 text-white px-5 py-2 rounded"
//         onClick={start}
//       >
//         Start Live Stream
//       </button>

//       <button
//         className="bg-green-600 text-white px-5 py-2 rounded ml-4"
//         onClick={capture}
//       >
//         Capture Image
//       </button>

//       <div className="mt-5">
//         <video
//           ref={videoRef}
//           autoPlay
//           playsInline
//           className="w-full rounded-lg"
//         ></video>
//       </div>
//     </div>
//   );
// }



// src/pages/Dashboard.jsx
import { useRef, useState } from "react";

export default function Dashboard() {
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const [capturedImage, setCapturedImage] = useState(null);

  const SIGNAL_URL = import.meta.env.VITE_SIGNAL_URL;

  // safe send wrapper
  const safeSend = (obj) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(obj));
    } else {
      console.warn("WS not open, skipping send:", obj);
    }
  };

  const start = async () => {
    // create PeerConnection
    pcRef.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // ensure we will receive a video from the pi
    pcRef.current.addTransceiver("video", { direction: "recvonly" });

    pcRef.current.ontrack = (event) => {
      // attach remote stream to video element
      if (videoRef.current) videoRef.current.srcObject = event.streams[0];
    };

    pcRef.current.onicecandidate = (evt) => {
      if (evt.candidate) {
        safeSend({
          to: "pi",
          type: "candidate",
          candidate: {
            candidate: evt.candidate.candidate,
            sdpMid: evt.candidate.sdpMid,
            sdpMLineIndex: evt.candidate.sdpMLineIndex,
          },
        });
      }
    };

    // open websocket (signaling)
    wsRef.current = new WebSocket(SIGNAL_URL);

    wsRef.current.onopen = async () => {
      console.log("Signaling WS open");
      // register as client
      safeSend({ role: "client" });

      // create offer only AFTER ws open and transceiver set
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);

      safeSend({
        to: "pi",
        type: "offer",
        sdp: pcRef.current.localDescription.sdp,
      });
    };

    wsRef.current.onmessage = async (message) => {
      try {
        const data = JSON.parse(message.data);

        // handle answer from PI (via backend)
        if (data.type === "answer" && data.sdp) {
          await pcRef.current.setRemoteDescription({ type: "answer", sdp: data.sdp });
        }

        // remote ICE candidate from PI
        if (data.type === "candidate" && data.candidate) {
          try {
            await pcRef.current.addIceCandidate({
              candidate: data.candidate.candidate,
              sdpMid: data.candidate.sdpMid,
              sdpMLineIndex: data.candidate.sdpMLineIndex,
            });
          } catch (e) {
            console.warn("addIceCandidate error:", e);
          }
        }

        // captured image broadcasted by backend (base64 jpg)
        if (data.type === "capture" && data.imageBase64) {
          setCapturedImage(`data:image/jpeg;base64,${data.imageBase64}`);
        }
      } catch (e) {
        console.error("WS message parse error:", e);
      }
    };

    wsRef.current.onclose = () => {
      console.log("Signaling WS closed");
    };

    wsRef.current.onerror = (e) => {
      console.error("Signaling WS error:", e);
    };
  };

  const requestCapture = async () => {
    // call backend HTTP trigger endpoint (replace URL accordingly)
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_BASE}/api/camera/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ piId: "pi_001" }),
      });
      if (!resp.ok) {
        console.error("Capture request failed", await resp.text());
      }
    } catch (e) {
      console.error("Capture request error", e);
    }
  };

  return (
    <div className="p-10">
      <div className="flex gap-3 items-center">
        <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={start}>
          Start Live Stream
        </button>

        <button className="bg-green-600 text-white px-4 py-2 rounded" onClick={requestCapture}>
          Capture Image
        </button>
      </div>

      <div className="mt-6">
        <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg bg-black"></video>
      </div>

      {capturedImage && (
        <div className="mt-6">
          <h3 className="mb-2 font-semibold">Captured Image</h3>
          <img src={capturedImage} alt="Captured" className="w-full rounded-lg border" />
        </div>
      )}
    </div>
  );
}
