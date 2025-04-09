import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth.service';
import { SocketService } from '../socket.service';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatGridListModule } from '@angular/material/grid-list';
import { CommonModule } from '@angular/common';
import { jwtDecode } from 'jwt-decode';

interface Message {
  text: string;
  time: Date;
  isSent: boolean;
}

interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
}

@Component({
  selector: 'app-chat-video',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    MatGridListModule,
    CommonModule,
    FormsModule,
  ],
  templateUrl: './chat-video.component.html',
  styleUrls: ['./chat-video.component.css'],
})
export class ChatVideoComponent implements OnInit, OnDestroy {
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;

  selectedUser: User | null = null;
  messages: Message[] = [];
  newMessage: string = '';
  isLoading: boolean = false;
  errorMessage: string | null = null;
  private apiUrl = 'http://localhost:3000';
  private currentUserId: string | null = null;

  // Vidéoconférence
  isVideoCallActive: boolean = false;
  isCameraOn: boolean = false;
  isMicOn: boolean = false;
  localStream: MediaStream | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
    private socketService: SocketService
  ) {}

  ngOnInit(): void {
    // Récupérer l'ID de l'utilisateur connecté à partir du token
    const token = this.authService.getToken();
    if (token) {
      const decoded: any = jwtDecode(token);
      this.currentUserId = decoded.id;
    }

    // Récupérer l'email de l'utilisateur sélectionné depuis les paramètres de la route
    const userEmail = this.route.snapshot.queryParamMap.get('email');
    if (userEmail) {
      this.loadUserDetails(userEmail);
    } else {
      this.errorMessage = 'No user selected for chat.';
    }

    // Écouter les messages privés
    this.socketService.onPrivateMessageReceived((data) => {
      const isSent = data.senderId === this.currentUserId;
      if (!isSent) {
        this.messages.push({
          text: data.message,
          time: new Date(data.time),
          isSent: false,
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.endCall();
    this.socketService.disconnect();
  }

  // Charger les détails de l'utilisateur sélectionné
  loadUserDetails(email: string): void {
    this.isLoading = true;
    this.http.get<User>(`${this.apiUrl}/one-user?email=${email}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
    }).subscribe({
      next: (user) => {
        this.isLoading = false;
        console.log('User received:', user);
        if (user) {
          this.selectedUser = user;
          this.loadMessages();

          // Rejoindre le chat privé
          if (this.currentUserId) {
            this.socketService.joinPrivateChat(this.currentUserId, this.selectedUser._id);
          }
        } else {
          this.errorMessage = 'User not found.';
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error fetching user:', err);
        this.errorMessage = 'Failed to load user details: ' + err.message;
      }
    });
  }

  // Charger les messages depuis la base de données
  loadMessages(): void {
    if (!this.selectedUser || !this.currentUserId) return;

    this.http.get<any[]>(`${this.apiUrl}/messages?otherUserEmail=${this.selectedUser.email}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
    }).subscribe({
      next: (messages) => {
        this.messages = messages.map((msg) => ({
          text: msg.text,
          time: new Date(msg.time),
          isSent: msg.senderId._id === this.currentUserId,
        }));
      },
      error: (err) => {
        console.error('Error loading messages:', err);
        this.errorMessage = 'Failed to load messages: ' + err.message;
      },
    });
  }

  // Envoyer un message
  sendMessage(): void {
    if (this.newMessage.trim() && this.currentUserId && this.selectedUser) {
      const message: Message = {
        text: this.newMessage,
        time: new Date(),
        isSent: true,
      };
      this.messages.push(message);

      this.socketService.sendPrivateMessage(this.currentUserId, this.selectedUser._id, this.newMessage);
      this.newMessage = '';
    }
  }

  // Démarrer la vidéoconférence
  async startVideoCall(): Promise<void> {
    try {
      this.isVideoCallActive = true;
      this.isCameraOn = true;
      this.isMicOn = true;

      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (this.localVideo && this.localVideo.nativeElement) {
        this.localVideo.nativeElement.srcObject = this.localStream;
      }
    } catch (err) {
      this.errorMessage = 'Failed to start video call: ' + (err as Error).message;
      this.endCall();
    }
  }

  // Basculer la caméra
  toggleCamera(): void {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      this.isCameraOn = videoTrack.enabled;
    }
  }

  // Basculer le microphone
  toggleMicrophone(): void {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      this.isMicOn = audioTrack.enabled;
    }
  }

  // Terminer l'appel
  endCall(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.localVideo && this.localVideo.nativeElement) {
      this.localVideo.nativeElement.srcObject = null;
    }
    if (this.remoteVideo && this.remoteVideo.nativeElement) {
      this.remoteVideo.nativeElement.srcObject = null;
    }
    this.isVideoCallActive = false;
    this.isCameraOn = false;
    this.isMicOn = false;
  }

  // Retour à la page d'accueil
  goBack(): void {
    this.endCall();
    this.router.navigate(['/']);
  }
}
