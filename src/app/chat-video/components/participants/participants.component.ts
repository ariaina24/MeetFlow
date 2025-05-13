import { Component, ElementRef, Input, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { StreamVideoParticipant } from '@stream-io/video-client';
import { VideoService } from '../../services/video.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-participants',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './participants.component.html',
  styleUrls: ['./participants.component.css']
})
export class ParticipantsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('audioElement') audioElement!: ElementRef<HTMLAudioElement>;

  @Input({ required: true }) participant!: StreamVideoParticipant;

  private unbindVideoElement: (() => void) | undefined;
  private unbindAudioElement: (() => void) | undefined;

  constructor(private videoService: VideoService) {}

  ngAfterViewInit(): void {
    const call = this.videoService.call();
    if (!call) {
      console.error('No call available for binding media elements');
      return;
    }

    const userId = this.videoService.getUserId();
    if (this.participant.userId === userId) {
      this.participant.isLocalParticipant = true;
    }

    console.log('Binding video for participant:', this.participant.userId, 'Session ID:', this.participant.sessionId);
    console.log('Video element:', this.videoElement.nativeElement);

    try {
      this.unbindVideoElement = call.bindVideoElement(
        this.videoElement.nativeElement,
        this.participant.sessionId,
        'videoTrack'
      );
      console.log('Video element bound successfully for', this.participant.userId);
    } catch (error) {
      console.error('Error binding video element for', this.participant.userId, ':', error);
    }

    if (!this.participant.isLocalParticipant) {
      console.log('Binding audio for remote participant:', this.participant.userId);
      try {
        this.unbindAudioElement = call.bindAudioElement(
          this.audioElement.nativeElement,
          this.participant.sessionId
        );
        console.log('Audio element bound successfully for', this.participant.userId);
      } catch (error) {
        console.error('Error binding audio element for', this.participant.userId, ':', error);
      }
    }
  }

  ngOnDestroy(): void {
    this.unbindVideoElement?.();
    this.unbindAudioElement?.();
  }
}
