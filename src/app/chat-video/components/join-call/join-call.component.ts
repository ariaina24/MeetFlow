import { Component, ChangeDetectorRef } from '@angular/core';
import { VideoService } from '../../services/video.service';
import { AuthService } from '../../../shared/auth.service';
import { CommonModule } from '@angular/common';
import { VideoConfComponent } from '../video-conf/video-conf.component';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { Signal } from '@angular/core'; // Ajout pour typer correctement

@Component({
  selector: 'app-join-call',
  standalone: true,
  imports: [CommonModule, VideoConfComponent, ReactiveFormsModule],
  templateUrl: './join-call.component.html',
  styleUrls: ['./join-call.component.css']
})
export class JoinCallComponent {
  callIdControl = new FormControl('', [Validators.required]);
  error!: Signal<string | undefined>; // Définir sans initialisation immédiate

  constructor(
    public videoService: VideoService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.error = this.videoService.error; // Initialisation dans le constructeur
    this.authService.fetchStreamToken().subscribe({
      error: (err) => {
        console.error('Failed to fetch Stream token:', err);
        this.videoService.error.set(`Échec de l'initialisation de Stream: ${err.message}`);
      },
      next: () => {
        console.log('Stream token fetched successfully');
      }
    });
  }

  async joinCall() {
    if (this.callIdControl.invalid) {
      console.log('Form invalid, marking as touched');
      this.callIdControl.markAsTouched();
      return;
    }

    try {
      console.log('Joining call with ID:', this.callIdControl.value);
      await this.videoService.joinCall(this.callIdControl.value!);
      console.log('Call joined, callIdControl value:', this.callIdControl.value);
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error joining call:', error);
      this.cdr.detectChanges();
    }
  }

  async createCall() {
    try {
      console.log('Creating new call');
      const callId = await this.videoService.createCall();
      console.log('Call created with ID:', callId);
      this.callIdControl.setValue(callId);
      console.log('callIdControl updated with:', callId);
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error creating call:', error);
      this.cdr.detectChanges();
    }
  }

  copyCallId() {
    const callId = this.videoService.callId();
    console.log('Copying callId:', callId);
    if (callId) {
      navigator.clipboard.writeText(callId);
      alert('ID de l\'appel copié dans le presse-papiers !');
    } else {
      console.warn('No callId to copy');
    }
  }

  leaveCall() {
    console.log('Leaving call from JoinCallComponent');
    this.videoService.leaveCall();
    this.videoService.toggleVideoCall(false);
    this.cdr.detectChanges();
  }
}
