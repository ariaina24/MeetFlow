import { Injectable, computed, signal } from '@angular/core';
import { Call, StreamVideoClient, User } from '@stream-io/video-client';
import { v4 as uuidv4 } from 'uuid';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../shared/auth.service';
import { environment } from '../../../environments/environment';
import { BehaviorSubject, Observable, from, timeout } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private callSignal = signal<Call | undefined>(undefined);
  callId = signal<string | undefined>(undefined);
  client: StreamVideoClient | undefined;
  error = signal<string | undefined>(undefined);
  private userId: string;

  private isVideoCallActiveSubject = new BehaviorSubject<boolean>(false);
  isVideoCallActive$: Observable<boolean> = this.isVideoCallActiveSubject.asObservable();

  constructor(private authService: AuthService, private http: HttpClient) {
    const user: User = this.authService.getUser();
    if (!user.id) {
      throw new Error('User ID is undefined');
    }
    this.userId = user.id;
    console.log('Initialized VideoService with user:', user);
  }

  private initializeClient(): Observable<void> {
    if (this.client) {
      console.log('Client already initialized');
      return from(Promise.resolve());
    }

    const apiKey = environment.streamApiKey;
    const user: User = this.authService.getUser();
    let token = this.authService.getStreamToken();

    console.log('Initializing client with apiKey:', apiKey, 'user:', user, 'and token:', token);

    if (!apiKey || !token) {
      console.error('API Key or token is missing:', { apiKey, token });
      this.error.set('Clé API ou token manquant');
      throw new Error('API Key or token is missing');
    }

    try {
      this.client = new StreamVideoClient({ apiKey, token, user });
      console.log('Client initialized with test token');
      return from(Promise.resolve());
    } catch (err) {
      console.error('Failed to initialize StreamVideoClient:', err);
      this.error.set('Erreur lors de l\'initialisation du client Stream');
      throw err;
    }
  }

  getUserId(): string {
    return this.userId;
  }

  async createCall(): Promise<string> {
    console.log('Starting createCall');
    try {
      await this.initializeClient().toPromise();
      console.log('Client initialized successfully');
    } catch (err) {
      console.error('Error initializing client:', err);
      this.error.set('Erreur lors de l\'initialisation du client');
      throw err;
    }

    if (!this.client) {
      console.error('StreamVideoClient not initialized');
      this.error.set('Client vidéo non initialisé');
      throw new Error('StreamVideoClient not initialized');
    }

    const callId = uuidv4();
    console.log('Generated callId:', callId);
    const call = this.client.call('default', callId);
    const userId = this.authService.getUser().id;

    if (!userId) {
      console.error('User ID is undefined');
      this.error.set('ID utilisateur non défini');
      throw new Error('User ID is undefined');
    }

    try {
      console.log('Creating call for user:', userId);
      console.log('Call parameters:', {
        data: {
          members: [{ user_id: userId, role: 'admin' }],
        },
        ring: true
      });
      const response = await Promise.race([
        call.getOrCreate({
          data: {
            members: [{ user_id: userId, role: 'admin' }],
          },
          ring: true
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout: Call creation took too long')), 20000))
      ]);
      console.log('Call created successfully, response:', response);

      // Activer la caméra et le microphone après création
      await Promise.all([
        call.camera.enable().catch(err => console.error('Failed to enable camera:', err)),
        call.microphone.enable().catch(err => console.error('Failed to enable microphone:', err))
      ]);
      console.log('Camera and microphone enabled');

      this.callId.set(callId);
      console.log('callId set to:', callId);
      this.callSignal.set(call);
      this.error.set(undefined);
      return callId;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to create call:', message, 'Error details:', error);
      this.error.set(`Erreur lors de la création de l'appel: ${message}`);
      throw new Error(message);
    }
  }

  async joinCall(callId: string): Promise<void> {
    console.log('Starting joinCall with callId:', callId);
    await this.initializeClient().toPromise();
    if (!this.client) {
      console.error('StreamVideoClient not initialized');
      this.error.set('Client vidéo non initialisé');
      throw new Error('StreamVideoClient not initialized');
    }

    if (!callId) {
      console.error('Call ID is required');
      this.error.set('ID de l\'appel requis');
      throw new Error('Call ID is required');
    }

    const call = this.client.call('default', callId);

    try {
      console.log('Joining call:', callId, 'for user:', this.authService.getUser().id);
      await call.join();
      console.log('Call joined successfully');

      // Activer la caméra et le microphone après jointure
      await Promise.all([
        call.camera.enable().catch(err => console.error('Failed to enable camera:', err)),
        call.microphone.enable().catch(err => console.error('Failed to enable microphone:', err))
      ]);
      console.log('Camera and microphone enabled after joining');

      this.callId.set(callId);
      this.callSignal.set(call);
      this.error.set(undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to join call:', message);
      this.error.set(`Erreur lors de la participation à l'appel: ${message}`);
      throw new Error(message);
    }
  }

  async leaveCall(): Promise<void> {
    console.log('Starting leaveCall');
    const call = this.callSignal();
    if (call) {
      try {
        await call.leave();
        console.log('Call left successfully');
      } catch (error: unknown) {
        console.warn('Error leaving call:', error);
      }
      this.callSignal.set(undefined);
      this.callId.set(undefined);
      this.error.set(undefined);
      console.log('Call state reset');
    } else {
      console.log('No active call to leave');
    }
  }

  call = computed(() => this.callSignal());

  toggleVideoCall(isActive: boolean): void {
    console.log('Toggling video call to:', isActive);
    this.isVideoCallActiveSubject.next(isActive);
  }
}
