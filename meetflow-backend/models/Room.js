// models/Room.js
import mongoose from 'mongoose';

const RoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  creator: { type: String, required: true },
  users: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Room', RoomSchema);
