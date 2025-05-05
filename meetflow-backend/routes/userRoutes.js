import express from 'express';
import authenticateToken from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const users = await User.find().select('firstName lastName email photoUrl');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/one-user', authenticateToken, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'Email parameter required' });
    }

    const user = await User.findOne({ email }).select('firstName lastName email _id photoUrl');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

export default router;
