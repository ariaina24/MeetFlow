import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  lastName: String,
  firstName: String,
  email: { type: String, unique: true },
  password: String,
  photoUrl: { type: String, default: null },
});

export default mongoose.model('User', userSchema);
