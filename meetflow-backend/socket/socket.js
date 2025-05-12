import jwt from 'jsonwebtoken';
import Message from '../models/Message.js';

const setupSocket = (io) => {
  io.on('connection', (socket) => {
    socket.on('authenticate', ({ token }) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        socket.userId = decoded.id;
      } catch (error) {
        socket.disconnect();
      }
    });

    socket.on('join-room', (roomId, userId) => {
      socket.join(roomId);
      socket.to(roomId).emit('user-connected', userId);
    });

    socket.on('send-message', (roomId, message) => {
      socket.to(roomId).emit('receive-message', message);
    });

    socket.on('join-private-chat', (userId1, userId2) => {
      const chatId = [userId1, userId2].sort().join('-');
      socket.join(chatId);
    });

    socket.on('send-private-message', async (data) => {
      try {
        const { senderId, receiverId, message } = data;

        // Valider les champs requis
        if (!senderId || !receiverId || !message) {
          console.error('Missing required fields:', { senderId, receiverId, message });
          return;
        }

        // Sécurité : vérifier que senderId correspond à l'utilisateur authentifié
        if (senderId !== socket.userId) {
          console.error('Unauthorized senderId:', senderId);
          return;
        }

        const chatId = [senderId, receiverId].sort().join('-');
        const newMessage = new Message({
          senderId,
          receiverId,
          text: message,
          time: new Date(),
          isRead: false, // Non lu par défaut pour le destinataire
        });
        await newMessage.save();

        // Émettre le message pour le destinataire avec isRead: false
        io.to(chatId).emit('receive-private-message', {
          senderId,
          receiverId,
          message,
          time: newMessage.time,
          isRead: false, // Non lu pour le destinataire
        });

        // Émettre pour l'expéditeur avec isRead: true
        io.to(senderId).emit('receive-private-message', {
          senderId,
          receiverId,
          message,
          time: newMessage.time,
          isRead: true, // Lu pour l'expéditeur
        });
      } catch (error) {
        console.error('Error saving message:', error);
      }
    });
  });
};

export default setupSocket;
