import express from 'express';
// import { checkTrigger, getImages, triggerCapture, triggerDone, uploadImage } from '../controllers/cameraController.js';
import { checkTrigger, saveImage, triggerCapture } from '../controllers/cameraController.js';
const router = express.Router();

// router.post('/upload', uploadImage);
// router.get('/images', getImages);
// router.post('/trigger-capture', triggerCapture);
// router.get('/check-trigger', checkTrigger);
// router.post('/trigger-done', triggerDone);
router.post("/upload", saveImage);
router.post("/trigger", triggerCapture);
router.get("/check", checkTrigger);


export default router;
