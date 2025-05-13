import express from 'express';
import { StreamClient } from '@stream-io/node-sdk';

const router = express.Router();

// Initialisation du client Stream pour le serveur
const streamClient = new StreamClient(
  process.env.STREAM_API_KEY || 'mmhfdzb5evj2',
  process.env.STREAM_API_SECRET || 'votre_api_secret_ici'
);

router.post('/token', (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  try {
    const token = streamClient.createCallToken({
      user_id: userId,
      exp: Math.floor(Date.now() / 1000) + 3600
    });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate token', details: error.message });
  }
});

export default router;
