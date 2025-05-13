import { Component, Input, OnChanges, SimpleChanges, Signal, EnvironmentInjector } from '@angular/core';
import { Call, StreamVideoParticipant } from '@stream-io/video-client';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ParticipantsComponent } from '../participants/participants.component';
import { VideoService } from '../../services/video.service';
import { runInInjectionContext } from '@angular/core';

@Component({
  selector: 'app-video-conf',
  standalone: true,
  imports: [CommonModule, ParticipantsComponent],
  templateUrl: './video-conf.component.html',
  styleUrls: ['./video-conf.component.css']
})
export class VideoConfComponent implements OnChanges {
  @Input({ required: true }) call!: Call;
  participants!: Signal<StreamVideoParticipant[] | undefined>;

  constructor(
    private videoService: VideoService,
    private injector: EnvironmentInjector // Injecter EnvironmentInjector
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['call'] && this.call) {
      // Utiliser runInInjectionContext pour fournir un contexte d'injection
      runInInjectionContext(this.injector, () => {
        this.participants = toSignal(this.call.state.participants$, {
          initialValue: []
        });
      });
      console.log('Participants initialized for call:', this.call);
      this.call.state.participants$.subscribe(participants => {
        console.log('Current participants:', participants);
      });
    }
  }

  toggleMicrophone() {
    if (this.call) {
      this.call.microphone.toggle().catch((error) => {
        console.error('Error toggling microphone:', error);
      });
    } else {
      console.error('Cannot toggle microphone: call is undefined');
    }
  }

  toggleCamera() {
    if (this.call) {
      this.call.camera.toggle().catch((error) => {
        console.error('Error toggling camera:', error);
      });
    } else {
      console.error('Cannot toggle camera: call is undefined');
    }
  }

  trackBySessionId(_: number, participant: StreamVideoParticipant) {
    return participant.sessionId;
  }

  leaveCall() {
    this.videoService.leaveCall().catch((error) => {
      console.error('Error leaving call:', error);
    });
  }
}
