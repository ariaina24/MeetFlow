import express, { json } from 'express';
import { connect, Schema, model } from 'mongoose';
import cors from 'cors';
import { hash, compare } from 'bcrypt';
import dotenv from 'dotenv'; // Import dotenv as an ES module

dotenv.config(); // Call config() to load environment variables

const app = express();
app.use(cors());
app.use(json());

// Connect to MongoDB
connect('mongodb://ariaina:root@localhost:27017/meetflow')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new Schema({
  lastName: String,
  firstName: String,
  email: { type: String, unique: true },
  password: String,
});

const User = model('User', userSchema);

// Registration Endpoint
app.post('/register', async (req, res) => {
  try {
    console.log('Request body:', req.body);
    const { lastName, firstName, email, password } = req.body;
    if (!lastName || !firstName || !email || !password) {
      throw new Error('All fields are required');
    }
    const hashedPassword = await hash(password, 10);
    const user = new User({ lastName, firstName, email, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error in /register:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed ato @ server.js', details: error.message });
    }
  }
});

// Login Endpoint
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    const isMatch = await compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    res.status(200).json({ message: 'Login successful', user: { lastName: user.lastName, firstName: user.firstName, email: user.email } });
  } catch (error) {
    console.error('Error in /login:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
