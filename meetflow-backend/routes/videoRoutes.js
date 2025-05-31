import express from 'express';
import jwt from 'jsonwebtoken';
import Room from '../models/Room.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requis' });

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalide' });
    req.user = user;
    next();
  });
};

router.post('/create-room', authenticateToken, async (req, res) => {
  try {
    const roomId = uuidv4();
    const room = new Room({
      roomId,
      creator: req.user.id,
      users: [req.user.id],
      createdAt: new Date(),
    });
    await room.save();
    res.status(201).json({ roomId });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/join-room', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.body;
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ error: 'Salle non trouvée' });
    }
    if (!room.users.includes(req.user.id)) {
      room.users.push(req.user.id);
      await room.save();
    }
    res.status(200).json({ message: 'Salle rejointe', roomId });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/check-room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ error: 'Salle non trouvée' });
    }
    res.status(200).json({ roomId, creator: room.creator, users: room.users });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
