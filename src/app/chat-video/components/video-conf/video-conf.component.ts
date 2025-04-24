import { CommonModule } from '@angular/common';
import { Component, Input, Signal } from '@angular/core';
import { VideoService } from '../../services/video.service';
import { Call, StreamVideoParticipant } from '@stream-io/video-client';
import { toSignal } from '@angular/core/rxjs-interop';
import { ParticipantsComponent } from "../participants/participants.component";

@Component({
  selector: 'app-video-conf',
  imports: [
    CommonModule,
    ParticipantsComponent
],
  templateUrl: './video-conf.component.html',
  styleUrl: './video-conf.component.css'
})
export class VideoConfComponent {
  @Input({ required: true }) call!: Call;

  participants: Signal<StreamVideoParticipant[]>;

  constructor(private videoService: VideoService) {
    this.participants = toSignal(
      this.videoService.call()!.state.participants$,
      // All @stream-io/video-client state Observables have an initial value, so it's safe to set the `requireSync` option: https://angular.io/guide/rxjs-interop#the-requiresync-option
      { requireSync: true }
    );
  }

  toggleMicrophone() {
    this.call.microphone.toggle();
  }

  toggleCamera() {
    this.call.camera.toggle();
  }

  trackBySessionId(_: number, participant: StreamVideoParticipant) {
    return participant.sessionId;
  }

  leaveCall() {
    this.videoService.setCallId(undefined);
  }
}
