import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Input, Output, EventEmitter } from '@angular/core';
import { User } from '../../models/user.model';
import { io, Socket } from 'socket.io-client';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../../shared/auth.service';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ChatAreaComponent } from '../chat-area/chat-area.component';

@Component({
  selector: 'app-video-conference',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './video-conference.component.html',
  styleUrls: ['./video-conference.component.css'],
})
export class VideoConferenceComponent implements OnInit, OnDestroy {
  @ViewChild('localVideoElement') localVideo!: ElementRef<HTMLVideoElement>;
  @Input() user: User | null = null;
  @Input() selectedUser: User | null = null;
  @Input() roomId: string | null = null;
  @Output() videoCallEnded = new EventEmitter<void>();

  private socket!: Socket;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private stream: MediaStream | null = null;
  private remoteVideos: Map<string, HTMLVideoElement> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidate[]> = new Map();
  errorMessage: string | null = null;

  constructor(private http: HttpClient, private authService: AuthService, private chatArea: ChatAreaComponent) {}

  async ngOnInit(): Promise<void> {
    if (!this.user || !this.roomId) {
      this.errorMessage = 'Utilisateur ou ID de salle non défini';
      console.error(this.errorMessage);
      return;
    }

    const token = this.authService.getToken();
    if (!token) {
      this.errorMessage = 'Vous devez être connecté';
      console.error(this.errorMessage);
      return;
    }

    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      this.errorMessage = 'Accès à la caméra ou au microphone refusé';
      console.error(this.errorMessage);
      return;
    }

    this.socket = io('http://localhost:3000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket.IO connecté:', this.socket.id);
      this.socket.emit('authenticate', { token });
    });

    this.socket.on('connect_error', (error) => {
      console.error('Erreur de connexion Socket.IO:', error);
      this.errorMessage = 'Impossible de se connecter au serveur';
    });

    this.socket.on('authenticated', async () => {
      console.log('Utilisateur authentifié');
      // Start media stream before joining room
      await this.startMediaStream();
      this.joinVideoRoom();
    });

    this.socket.on('existing-users', (userIds: string[]) => {
      console.log('Utilisateurs existants reçus:', userIds);
      userIds.forEach(userId => {
        if (userId !== this.user?._id) {
          this.createPeerConnection(userId);
        }
      });
    });

    this.socket.on('user-connected', (userId: string) => {
      console.log('Utilisateur connecté:', userId);
      if (userId !== this.user?._id) {
        this.createPeerConnection(userId);
      }
    });

    this.socket.on('user-disconnected', (userId: string) => {
      console.log('Utilisateur déconnecté:', userId);
      this.cleanupPeerConnection(userId);
      const video = this.remoteVideos.get(userId);
      if (video) {
        video.srcObject = null;
        video.remove();
        this.remoteVideos.delete(userId);
      }
    });

    this.socket.on('signal', (data: { userId: string; targetUserId: string; signal: any }) => {
      console.log('Signal reçu:', data);
      if (data.targetUserId === this.user?._id && data.userId !== this.user?._id) {
        this.handleSignal(data.userId, data.signal, 0).catch(err => {
          console.error('Erreur lors du traitement du signal:', err);
          this.errorMessage = 'Erreur de connexion WebRTC';
        });
      }
    });
  }

  async checkPermissions(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log('Permissions accordées pour caméra/micro');
      return true;
    } catch (err) {
      console.error('Échec de la vérification des permissions:', err);
      return false;
    }
  }

  async startMediaStream(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('Flux média local obtenu:', stream);
      console.log('Pistes:', stream.getTracks().map(t => `${t.kind}:${t.id}`));
      this.stream = stream;
      if (this.localVideo) {
        this.localVideo.nativeElement.srcObject = stream;
      }
      if (!stream.getVideoTracks().length) {
        console.warn('Aucun flux vidéo détecté');
        this.errorMessage = 'Aucun flux vidéo disponible. Vérifiez votre caméra.';
      }
      // Add tracks to existing peer connections
      this.peerConnections.forEach((pc, userId) => {
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
          console.log(`Piste ${track.kind} (${track.id}) ajoutée ultérieurement pour ${userId}`);
        });
      });
    } catch (err) {
      console.error('Erreur avec vidéo/audio:', err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Flux audio de secours obtenu:', stream);
        console.log('Pistes:', stream.getTracks().map(t => `${t.kind}:${t.id}`));
        this.stream = stream;
        if (this.localVideo) {
          this.localVideo.nativeElement.srcObject = stream;
        }
        this.errorMessage = 'Flux vidéo non disponible, audio uniquement.';
        this.peerConnections.forEach((pc, userId) => {
          stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
            console.log(`Piste ${track.kind} (${track.id}) ajoutée ultérieurement pour ${userId}`);
          });
        });
      } catch (err) {
        this.errorMessage = 'Erreur d’accès à la caméra/micro. Vérifiez vos périphériques et permissions.';
        console.error('Erreur finale:', err);
      }
    }
  }

  joinVideoRoom(): void {
    if (!this.roomId || !this.user) {
      this.errorMessage = 'Informations manquantes pour rejoindre la salle';
      console.error(this.errorMessage);
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.authService.getToken()}`,
    });

    this.http
      .post('http://localhost:3000/api/video/join-room', { roomId: this.roomId }, { headers })
      .subscribe({
        next: () => {
          console.log('Rejoint la salle:', this.roomId);
          this.socket.emit('join-video-room', { roomId: this.roomId });
        },
        error: (err) => {
          this.errorMessage = 'Erreur lors de la jointure de la salle';
          console.error('Erreur:', err);
        },
      });
  }

  createPeerConnection(userId: string): void {
    if (!this.user) {
      this.errorMessage = 'Utilisateur non défini';
      console.error('Erreur: this.user est undefined');
      return;
    }

    if (this.peerConnections.has(userId)) {
      console.log(`Connexion pair déjà existante pour ${userId}, ignorée`);
      return;
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // Add TURN server if available, e.g.:
        // { urls: 'turn:your-turn-server.com', username: 'user', credential: 'pass' },
      ],
    });

    this.peerConnections.set(userId, peerConnection);
    console.log(`Connexion pair créée pour ${userId}`);

    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, this.stream!);
        console.log(`Piste ${track.kind} (${track.id}) ajoutée pour ${userId}`);
      });
    } else {
      console.warn('Aucun flux local disponible pour ajouter au pair');
    }

    const remoteVideo = document.createElement('video');
    remoteVideo.autoplay = true;
    remoteVideo.playsInline = true;
    remoteVideo.className = 'remote-video';
    remoteVideo.id = `remote-video-${userId}`;
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
      videoContainer.appendChild(remoteVideo);
      console.log(`Vidéo distante ajoutée pour ${userId}`);
    } else {
      console.error('Conteneur vidéo non trouvé');
    }
    this.remoteVideos.set(userId, remoteVideo);

    peerConnection.ontrack = (event) => {
      console.log(`Événement ontrack pour ${userId}:`, event.streams);
      if (event.streams && event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
        console.log(`Flux distant attribué à la vidéo pour ${userId}, pistes:`, event.streams[0].getTracks().map(t => `${t.kind}:${t.id}`));
      } else {
        console.warn(`Aucun flux reçu dans ontrack pour ${userId}`);
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`Envoi de candidat ICE pour ${userId}`);
        this.socket.emit('signal', {
          userId,
          signal: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`État ICE pour ${userId}: ${peerConnection.iceConnectionState}`);
      if (peerConnection.iceConnectionState === 'failed') {
        console.error(`Connexion ICE échouée pour ${userId}`);
        this.cleanupPeerConnection(userId);
        this.errorMessage = 'Échec de la connexion réseau';
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`État de connexion pour ${userId}: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
        this.cleanupPeerConnection(userId);
        this.errorMessage = 'Connexion WebRTC échouée';
      }
    };

    if (this.user._id < userId) {
      console.log(`Création d’une offre pour ${userId}`);
      peerConnection
        .createOffer()
        .then((offer) => {
          console.log(`Offre SDP pour ${userId}:`, offer.sdp);
          return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
          console.log(`Offre envoyée pour ${userId}`);
          this.socket.emit('signal', {
            userId,
            signal: peerConnection.localDescription,
          });
        })
        .catch((err) => {
          console.error('Erreur lors de la création de l’offre:', err);
          this.errorMessage = 'Erreur WebRTC';
        });
    }
  }

  async handleSignal(userId: string, signal: any, retryCount: number = 0): Promise<void> {
    let peerConnection = this.peerConnections.get(userId);
    if (!peerConnection) {
      if (retryCount < 3) {
        console.warn(`Aucune connexion pair pour ${userId}, tentative ${retryCount + 1}`);
        this.createPeerConnection(userId);
        setTimeout(() => this.handleSignal(userId, signal, retryCount + 1), 2000);
        return;
      }
      console.error(`Échec après ${retryCount} tentatives pour ${userId}`);
      this.errorMessage = `Impossible d’établir la connexion avec ${userId}`;
      return;
    }

    try {
      if (signal.type === 'offer') {
        console.log(`Réception d’une offre de ${userId}, SDP:`, signal.sdp);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await peerConnection.createAnswer();
        console.log(`Réponse SDP pour ${userId}:`, answer.sdp);
        await peerConnection.setLocalDescription(answer);
        console.log(`Réponse envoyée pour ${userId}`);
        this.socket.emit('signal', {
          userId,
          signal: peerConnection.localDescription,
        });
      } else if (signal.type === 'answer') {
        console.log(`Réception d’une réponse de ${userId}, SDP:`, signal.sdp);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        // Apply buffered candidates
        const candidates = this.pendingCandidates.get(userId) || [];
        for (const candidate of candidates) {
          await peerConnection.addIceCandidate(candidate);
          console.log(`Candidat ICE appliqué pour ${userId}`);
        }
        this.pendingCandidates.delete(userId);
      } else if (signal.type === 'candidate') {
        console.log(`Réception d’un candidat ICE de ${userId}`);
        if (peerConnection.remoteDescription) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          console.warn(`Description distante non définie pour ${userId}, mise en attente du candidat`);
          if (!this.pendingCandidates.has(userId)) {
            this.pendingCandidates.set(userId, []);
          }
          this.pendingCandidates.get(userId)!.push(new RTCIceCandidate(signal.candidate));
        }
      }
    } catch (err) {
      console.error(`Erreur lors du traitement du signal pour ${userId}:`, err);
      throw err;
    }
  }

  cleanupPeerConnection(userId: string): void {
    const peerConnection = this.peerConnections.get(userId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(userId);
      console.log(`Connexion pair nettoyée pour ${userId}`);
    }
    const video = this.remoteVideos.get(userId);
    if (video) {
      video.srcObject = null;
      video.remove();
      this.remoteVideos.delete(userId);
      console.log(`Vidéo distante supprimée pour ${userId}`);
    }
    this.pendingCandidates.delete(userId);
  }

  stopVideoCall(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      console.log('Flux local arrêté');
    }
    this.peerConnections.forEach((pc, userId) => {
      pc.close();
      const video = this.remoteVideos.get(userId);
      if (video) {
        video.srcObject = null;
        video.remove();
      }
    });
    this.peerConnections.clear();
    this.remoteVideos.clear();
    this.pendingCandidates.clear();
    if (this.localVideo) {
      this.localVideo.nativeElement.srcObject = null;
    }
    this.roomId = null;
    this.socket.disconnect();
    console.log('Appel vidéo arrêté');
    this.videoCallEnded.emit();
    window.location.reload();
  }

  showToast = false;
  copyRoomId(): void {
    if (this.roomId) {
      navigator.clipboard.writeText(this.roomId).then(() => {
        this.showToast = true;
        setTimeout(() => this.showToast = false, 3000);
      });
    }
  }

  sendRoomIdToContact(): void {
    if (this.roomId && this.selectedUser) {
      const message = `Rejoignez mon appel vidéo ! ID de la salle : ${this.roomId}`;
      this.chatArea.sendMessage(message);
    }
  }

  ngOnDestroy(): void {
    this.stopVideoCall();
  }
}
