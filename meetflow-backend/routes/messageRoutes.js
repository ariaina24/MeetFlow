import express from 'express';
import mongoose from 'mongoose';
import authenticateToken from '../middleware/auth.js';
import User from '../models/User.js';
import Message from '../models/Message.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { otherUserEmail } = req.query;

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
    res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
  }
});

router.get('/last-messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const lastMessages = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: new mongoose.Types.ObjectId(userId) },
            { receiverId: new mongoose.Types.ObjectId(userId) },
          ],
        },
      },
      { $sort: { time: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$senderId', new mongoose.Types.ObjectId(userId)] },
              '$receiverId',
              '$senderId',
            ],
          },
          lastMessage: { $first: '$text' },
          time: { $first: '$time' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          contactId: '$user._id',
          email: '$user.email',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          photoUrl: '$user.photoUrl',
          lastMessage: 1,
          time: 1,
        },
      },
      { $sort: { time: -1 } },
    ]);

    res.json(lastMessages);
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch last messages' });
  }
});

export default router;
