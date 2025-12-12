// import { useEffect, useRef, useState } from "react";
// import axios from "axios";
// import { FiCamera } from "react-icons/fi";
// import { API_URL, wss } from "./Api/api";

// function App() {
//   const [images, setImages] = useState([]);
//   const [selectedPi, setSelectedPi] = useState("pi_001"); // default Pi
//   const canvasRef = useRef();

  

//   // Fetch images for selected Pi
//   const fetchImages = async () => {
//     const res = await axios.get(`${API_URL}/api/camera/images?piId=${selectedPi}`);
//     setImages(res.data);
//   };

//   useEffect(() => {
//     fetchImages();
//     const interval = setInterval(fetchImages, 5000);
//     return () => clearInterval(interval);
//   }, [selectedPi]);

//   // Trigger capture for selected Pi
//   const triggerCapture = async () => {
//     await axios.post(`${API_URL}/api/camera/trigger-capture`, { piId: selectedPi });
//     alert("Capture requested!");
//   };

//   // Live stream via WebSocket
//   useEffect(() => {
//     const ws = new WebSocket(`wss://${wss}/ws/live`);
//     ws.onopen = () => ws.send(JSON.stringify({ piId: selectedPi }));

//     ws.onmessage = (event) => {
//       const frameBase64 = event.data;
//       const img = new Image();
//       img.src = "data:image/jpeg;base64," + frameBase64;
//       img.onload = () => {
//         const ctx = canvasRef.current.getContext("2d");
//         ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
//       };
//     };

//     return () => ws.close();
//   }, [selectedPi]);

//   return (
//     <div className="p-4 max-w-4xl mx-auto">
//       <h1 className="text-3xl font-bold mb-4">AI CCTV Camera</h1>

//       <div className="mb-4">
//         <label className="block mb-2 font-semibold">Select Pi:</label>
//         <select
//           value={selectedPi}
//           onChange={(e) => setSelectedPi(e.target.value)}
//           className="border p-2 rounded mb-4"
//         >
//           <option value="pi_001">Pi 001</option>
//           <option value="pi_002">Pi 002</option>
//           <option value="pi_003">Pi 003</option>
//         </select>

//         <h2 className="text-xl font-semibold mb-2">Live Stream</h2>
//         <canvas ref={canvasRef} width={640} height={480} className="border rounded" />
//       </div>

//       <button
//         onClick={triggerCapture}
//         className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded mb-6"
//       >
//         <FiCamera /> Capture Image
//       </button>

//       <h2 className="text-xl font-semibold mb-2">Captured Images</h2>
//       <div className="grid grid-cols-3 gap-4">
//         {images.map(img => (
//           <img key={img._id} src={img.imageUrl} alt="Captured" className="w-full h-40 object-cover rounded" />
//         ))}
//       </div>
//     </div>
//   );
// }

// export default App;




import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { FiCamera } from 'react-icons/fi';

const API = import.meta.env.VITE_API_URL || 'https://raspberrypi-camera.onrender.com';

function App() {
  const [selectedPi, setSelectedPi] = useState('pi_001');
  const [images, setImages] = useState([]);
  const canvasRef = useRef();
  const wsRef = useRef();

  useEffect(() => {
    fetchImages();
    const id = setInterval(fetchImages, 5000);
    return () => clearInterval(id);
  }, [selectedPi]);

  useEffect(() => {
    // open WS for live frames
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    const wsUrl = `${API.replace(/^http/, 'ws')}/ws/live/${selectedPi}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WS open', wsUrl);
    };

    ws.onmessage = (evt) => {
      // payload is base64 string
      const frameBase64 = evt.data;
      const img = new Image();
      img.src = 'data:image/jpeg;base64,' + frameBase64;
      img.onload = () => {
        const ctx = canvasRef.current.getContext('2d');
        ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
      };
    };

    ws.onclose = () => console.log('WS closed');
    ws.onerror = (e) => console.error('WS error', e);

    return () => ws.close();
  }, [selectedPi]);

  async function fetchImages() {
    try {
      const res = await axios.get(`${API}/api/camera/images?piId=${selectedPi}`);
      setImages(res.data);
    } catch (e) {
      console.error('fetchImages', e);
    }
  }

  async function triggerCapture() {
    try {
      await axios.post(`${API}/api/camera/trigger-capture`, { piId: selectedPi });
      alert('Capture requested for ' + selectedPi);
    } catch (e) {
      console.error('triggerCapture', e);
      alert('Failed to request capture');
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">AI CCTV — Multi Pi</h1>

      <div className="mb-4">
        <label className="block mb-2 font-semibold">Select Pi:</label>
        <select value={selectedPi} onChange={(e) => setSelectedPi(e.target.value)} className="border p-2 rounded">
          <option value="pi_001">pi_001</option>
          <option value="pi_002">pi_002</option>
          <option value="pi_003">pi_003</option>
        </select>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Live Stream ({selectedPi})</h2>
        <canvas ref={canvasRef} width={640} height={480} className="border rounded" />
      </div>

      <div className="mb-6">
        <button onClick={triggerCapture} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded">
          <FiCamera /> Capture Image
        </button>
      </div>

      <h2 className="text-xl font-semibold mb-2">Captured Images</h2>
      <div className="grid grid-cols-3 gap-4">
        {images.map((img) => (
          <img key={img._id} src={img.imageUrl} alt="capture" className="w-full h-40 object-cover rounded" />
        ))}
      </div>
    </div>
  );
}

export default App;

