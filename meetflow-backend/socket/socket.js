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

    socket.on('send-private-message', async (senderId, receiverId, message) => {
      try {
        const chatId = [senderId, receiverId].sort().join('-');
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
    });
  });
};

export default setupSocket;
