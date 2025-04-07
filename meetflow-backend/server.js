import express, { json } from 'express';
import { connect, Schema, model } from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { hash, compare } from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();

app.use(cors({
  origin: 'http://localhost:4200',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(json());

connect('mongodb://ariaina:root@localhost:27017/meetFlow', {
  authSource: 'admin',
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const userSchema = new Schema({
  lastName: String,
  firstName: String,
  email: { type: String, unique: true },
  password: String,
});

const User = model('User', userSchema);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  console.log('Auth header:', authHeader);

  if (!authHeader) {
    console.log('No authorization header found');
    return res.status(401).json({ error: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.log('Token not found in authorization header');
    return res.status(401).json({ error: 'Invalid token format' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token verified successfully:', decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Error verifying token:', error.message);
    res.status(403).json({ error: 'Invalid or expired token', message: error.message });
  }
};

app.post('/register', async (req, res) => {
  try {
    if (!req.body) {
      throw new Error('Request body is empty');
    }
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

// Login Endpoint (Générer un JWT)
app.post('/login', async (req, res) => {
  try {
    console.log('Request body:', req.body);
    const { email, password } = req.body;
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    const isMatch = await compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { email: user.email, id: user._id },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Login successful',
      user: { lastName: user.lastName, firstName: user.firstName, email: user.email },
      token,
    });
  } catch (error) {
    console.error('Error in /login:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

app.get('/home', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.status(200).json({ message: 'Bienvenue sur la home', user });
  } catch (error) {
    console.error('Erreur dans /home :', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});



app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ error: 'Something went wrong', details: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
