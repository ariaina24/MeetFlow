import express, { json } from 'express';
import mongoose, { connect, Schema, model } from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { hash, compare } from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();

app.use(cors({
  origin: 'http://localhost:4200',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
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
    photoUrl: { type: String, default: null },
  });

const User = model('User', userSchema);

const messageSchema = new Schema({
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  time: { type: Date, default: Date.now },
});

const Message = model('Message', messageSchema);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // console.log('Auth header:', authHeader);

  if (!authHeader) {
    // console.log('No authorization header found');
    return res.status(401).json({ error: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.log('Token not found in authorization header');
    return res.status(401).json({ error: 'Invalid token format' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Error verifying token:', error.message);
    res.status(403).json({ error: 'Invalid or expired token', message: error.message });
  }
};

const server = app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  // console.log('User connected:', socket.id);
  socket.on('authenticate', ({ token }) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      socket.userId = decoded.id;
      // console.log('User authenticated:', decoded);
    } catch (error) {
      console.error('Authentication error:', error.message);
      socket.disconnect();
    }
  });

  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    console.log(`${userId} joined room: ${roomId}`);
    socket.to(roomId).emit('user-connected', userId);
  });

  socket.on('send-message', (roomId, message) => {
    console.log('Message received:', message);
    socket.to(roomId).emit('receive-message', message);
  });

  socket.on('send-private-message', async (senderId, receiverId, message) => {
    try {
      const chatId = [senderId, receiverId].sort().join('-');
      console.log(`Private message from ${senderId} to ${receiverId}: ${message}`);

      const newMessage = new Message({
        senderId,
        receiverId,
        text: message,
        time: new Date(),
      });
      await newMessage.save();

      io.to(chatId).emit('receive-private-message', {
        senderId,
        receiverId,
        message,
        time: newMessage.time,
      });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  socket.on('join-private-chat', (userId1, userId2) => {
    const chatId = [userId1, userId2].sort().join('-');
    socket.join(chatId);
    // console.log(`${userId1} and ${userId2} joined private chat: ${chatId}`);
  });

  socket.on('disconnect', () => {
    // console.log('User disconnected:', socket.id);
  });
});

app.post('/register', async (req, res) => {
  try {
    if (!req.body) {
      throw new Error('Request body is empty');
    }
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
      res.status(500).json({ error: 'Registration failed', details: error.message });
    }
  }
});

app.post('/login', async (req, res) => {
  try {
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
      {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl || '', // Inclure photoUrl
      },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Login successful',
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl || '',
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

app.get('/users', authenticateToken, async (req, res) => {
  try {
    const users = await User.find().select('firstName lastName email photoUrl');
    res.status(200).json(users);
    // console.log(users)
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
});

app.get('/one-user', authenticateToken, async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) {
      throw new Error('Paramètre email requis');
    }
    const user = await User.findOne({ email }).select('firstName lastName email _id photoUrl');
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error('Erreur dans /one-user :', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

app.get('/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUserEmail = req.query.otherUserEmail;

    if (!otherUserEmail) {
      return res.status(400).json({ error: 'otherUserEmail parameter is required' });
    }

    const otherUser = await User.findOne({ email: otherUserEmail });
    if (!otherUser) {
      return res.status(404).json({ error: 'Other user not found' });
    }

    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: otherUser._id },
        { senderId: otherUser._id, receiverId: userId },
      ],
    })
      .sort({ time: 1 })
      .populate('senderId', 'email firstName lastName _id')
      .populate('receiverId', 'email firstName lastName _id');

    res.status(200).json(messages);
  } catch (error) {
    console.error('Error in /messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, 'Uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configuration de multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user.id; // ID de l'utilisateur authentifié
    const timestamp = Date.now();
    const extension = path.extname(file.originalname); // Extrait l'extension (ex: .jpg)
    const filename = `${userId}-${timestamp}${extension}`; // Ex: user123-16987654321.jpg
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Accepter uniquement les images
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Seules les images sont acceptées.'));
    }
  },
});

app.put('/update-profile', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('Données reçues:', {
      body: req.body,
      file: req.file,
    });

    const { firstName, lastName } = req.body;

    // Rejeter les requêtes avec des valeurs undefined ou vides
    if (!firstName || !lastName || firstName === 'undefined' || lastName === 'undefined') {
      console.log('Requête ignorée : firstName ou lastName invalide');
      return res.status(400).json({ error: 'firstName et lastName sont requis et ne doivent pas être "undefined"' });
    }

    const update = {};
    if (firstName) update.firstName = firstName;
    if (lastName) update.lastName = lastName;

    if (req.file) {
      update.photoUrl = `/Uploads/${req.file.filename}`;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, { $set: update }, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    console.log('Utilisateur mis à jour dans la base:', updatedUser);

    const token = jwt.sign(
      {
        id: updatedUser._id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        photoUrl: updatedUser.photoUrl,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ ...updatedUser.toObject(), token });
  } catch (error) {
    console.error('Erreur dans /update-profile:', error);
    res.status(500).json({ error: 'Échec de la mise à jour', details: error.message });
  }
});

app.get('/last-messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Agrégation pour récupérer le dernier message par contact
    const lastMessages = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: new mongoose.Types.ObjectId(userId) },
            { receiverId: new mongoose.Types.ObjectId(userId) }
          ]
        }
      },
      {
        $sort: { time: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$senderId', new mongoose.Types.ObjectId(userId)] },
              '$receiverId',
              '$senderId'
            ]
          },
          lastMessage: { $first: '$text' },
          time: { $first: '$time' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          contactId: '$user._id',
          email: '$user.email',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          photoUrl: '$user.photoUrl',
          lastMessage: 1,
          time: 1
        }
      },
      {
        $sort: { time: -1 }
      }
    ]);

    res.json(lastMessages);
  } catch (error) {
    console.error('Error fetching last messages:', error);
    res.status(500).json({ error: 'Could not fetch last messages' });
  }
});

app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ error: 'Something went wrong', details: err.message });
});

app.use('/Uploads', express.static(path.join(__dirname, 'Uploads')));
