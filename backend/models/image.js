import mongoose from 'mongoose';

const ImageSchema = new mongoose.Schema({
  // piId: { type: String, required: true },
  // imageUrl: { type: String, required: true },
  // timestamp: { type: Date, default: Date.now }

  piId: String,
  imageBase64: String,
  createdAt: { type: Date, default: Date.now }
});

// export default mongoose.model('Image', ImageSchema);
const Image = mongoose.model('Image', ImageSchema);

export default Image;
