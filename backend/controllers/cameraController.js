import fs from 'fs';
import path from 'path';
import Image from '../models/image.js';

// Map to track capture requests per Pi
const captureRequests = new Map();

// Pi uploads image
// export const uploadImage = async (req, res) => {
//   try {
//     const { imageBase64, piId } = req.body;
//     if (!piId) return res.status(400).json({ error: 'piId required' });

//     const imageName = `${piId}_${Date.now()}.jpg`;
//     const imagePath = path.join('uploads', imageName);
//     fs.writeFileSync(imagePath, Buffer.from(imageBase64, 'base64'));

//     const image = new Image({
//       piId,
//       imageUrl: `${req.protocol}://${req.get('host')}/uploads/${imageName}`
//     });
//     await image.save();
//     res.status(201).json({ message: 'Image saved', image });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to save image' });
//   }
// };

export const uploadImage = async (req, res) => {
  try {
    // Accept base64 JSON payload: { piId, imageBase64 }
    const { piId, imageBase64 } = req.body;
    if (!piId || !imageBase64) return res.status(400).json({ error: 'piId and imageBase64 required' });

    const imageName = `${piId}_${Date.now()}.jpg`;
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const imagePath = path.join(uploadsDir, imageName);
    fs.writeFileSync(imagePath, Buffer.from(imageBase64, 'base64'));

    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${imageName}`;
    const imageDoc = new Image({ piId, imageUrl });
    await imageDoc.save();

    return res.status(201).json({ message: 'Image saved', image: imageDoc });
  } catch (err) {
    console.error('UPLOAD ERROR:', err);
    return res.status(500).json({ error: 'Failed to save image' });
  }
};

// Fetch images (optionally by Pi)
export const getImages = async (req, res) => {
  try {
    const { piId } = req.query;
    const filter = piId ? { piId } : {};
    const images = await Image.find(filter).sort({ timestamp: -1 });
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch images' });
  }
};

// User triggers capture for a specific Pi
export const triggerCapture = (req, res) => {
  const { piId } = req.body;
  if (!piId) return res.status(400).json({ error: "piId required" });
  captureRequests.set(piId, true);
  res.json({ message: `Capture requested for ${piId}` });
};

// Pi polls for capture request
export const checkTrigger = (req, res) => {
  const piId = req.query.piId;
  const capture = captureRequests.get(piId) || false;
  res.json({ capture });
};

// Pi marks capture done
export const triggerDone = (req, res) => {
  const { piId } = req.body;
  captureRequests.set(piId, false);
  res.json({ message: `Capture done for ${piId}` });
};
