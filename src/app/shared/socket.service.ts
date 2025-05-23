import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket;
  private readonly serverUrl: string = 'http://localhost:3000';

  constructor() {
    this.socket = io(this.serverUrl, {
      withCredentials: true,
    });

    // Authentifier manuellement après la connexion
    const token = localStorage.getItem('auth_token');
    if (token) {
      this.socket.emit('authenticate', { token });
    }
  }

  // Écouter la connexion d'un utilisateur
  onUserConnected(callback: (userId: string) => void): void {
    this.socket.on('user-connected', callback);
  }

  // Envoyer un message privé
  sendPrivateMessage(senderId: string, receiverId: string, message: string): void {
    this.socket.emit('send-private-message', { senderId, receiverId, message });
  }

  // Recevoir un message privé
  onPrivateMessageReceived(callback: (message: { senderId: string; receiverId: string; message: string; time: string; isRead: boolean }) => void): void {
    this.socket.on('receive-private-message', callback);
  }

  // Rejoindre un chat privé
  joinPrivateChat(userId1: string, userId2: string): void {
    this.socket.emit('join-private-chat', userId1, userId2);
  }

  // Se déconnecter
  disconnect(): void {
    this.socket.disconnect();
  }
}
