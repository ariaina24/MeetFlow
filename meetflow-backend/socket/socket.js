import jwt from 'jsonwebtoken';
import Message from '../models/Message.js';
import Room from '../models/Room.js';

const setupSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`Nouvelle connexion: ${socket.id}`);

    socket.on('authenticate', ({ token }) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        socket.userId = decoded.id;
        console.log(`Utilisateur authentifié: ${socket.userId}`);
        socket.emit('authenticated', { userId: socket.userId });
      } catch (error) {
        console.error('Erreur d’authentification:', error);
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
        if (!senderId || !receiverId || !message) {
          console.error('Champs requis manquants:', { senderId, receiverId, message });
          return;
        }
        if (senderId !== socket.userId) {
          console.error('senderId non autorisé:', senderId);
          return;
        }
        const chatId = [senderId, receiverId].sort().join('-');
        const newMessage = new Message({
          senderId,
          receiverId,
          text: message,
          time: new Date(),
          isRead: false,
        });
        await newMessage.save();
        io.to(chatId).emit('receive-private-message', {
          senderId,
          receiverId,
          message,
          time: newMessage.time,
          isRead: false,
        });
        io.to(senderId).emit('receive-private-message', {
          senderId,
          receiverId,
          message,
          time: newMessage.time,
          isRead: true,
        });
      } catch (error) {
        console.error('Erreur lors de l’enregistrement du message:', error);
      }
    });

    socket.on('join-video-room', async ({ roomId }) => {
      try {
        const room = await Room.findOne({ roomId });
        if (!room) {
          socket.emit('error', { message: 'Salle non trouvée' });
          return;
        }
        if (!room.users.includes(socket.userId)) {
          room.users.push(socket.userId);
          await room.save();
        }
        console.log(`Utilisateur ${socket.userId} rejoint la salle vidéo ${roomId}`);
        socket.join(roomId);

        // Notify other users in the room about the new user
        socket.to(roomId).emit('user-connected', socket.userId);

        // Send the list of existing users to the new user
        const existingUsers = room.users.filter(userId => userId !== socket.userId);
        socket.emit('existing-users', existingUsers);
        console.log(`Utilisateurs existants envoyés à ${socket.userId}:`, existingUsers);

        socket.on('signal', ({ userId, signal }) => {
          console.log(`Signal de ${socket.userId} pour ${userId}:`, signal.type, signal.sdp ? 'avec SDP' : '');
          io.to(roomId).emit('signal', {
            userId: socket.userId,
            targetUserId: userId,
            signal,
          });
        });

        socket.on('disconnect', async () => {
          console.log(`Utilisateur ${socket.userId} a quitté la salle vidéo ${roomId}`);
          socket.to(roomId).emit('user-disconnected', socket.userId);
          await Room.updateOne({ roomId }, { $pull: { users: socket.userId } });
          const room = await Room.findOne({ roomId });
          if (room && room.users.length === 0) {
            await Room.deleteOne({ roomId });
            console.log(`Salle ${roomId} supprimée car vide`);
          }
        });
      } catch (error) {
        console.error('Erreur lors de la jointure de la salle vidéo:', error);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });
  });
};

export default setupSocket;
