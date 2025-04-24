import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { StreamVideoParticipant } from '@stream-io/video-client';
import { VideoService } from '../../services/video.service';

@Component({
  selector: 'app-participants',
  imports: [],
  templateUrl: './participants.component.html',
  styleUrl: './participants.component.css'
})
export class ParticipantsComponent {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('audioElement') audioElement!: ElementRef<HTMLAudioElement>;

  @Input() participant!: StreamVideoParticipant;
  unbindVideoElement: (() => void) | undefined;
  unbindAudioElement: (() => void) | undefined;

  constructor(private videoService: VideoService) {}

  ngAfterViewInit(): void {
    this.unbindVideoElement = this.videoService
      .call()
      ?.bindVideoElement(
        this.videoElement.nativeElement,
        this.participant.sessionId,
        'videoTrack'
      );

    this.unbindAudioElement = this.videoService
      .call()
      ?.bindAudioElement(
        this.audioElement.nativeElement,
        this.participant.sessionId
      );
  }

  ngOnDestroy(): void {
    this.unbindVideoElement?.();
    this.unbindAudioElement?.();
  }
}
