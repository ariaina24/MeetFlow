import { Component } from '@angular/core';
import { VideoService } from '../../services/video.service';
import { CommonModule } from '@angular/common';
import { VideoConfComponent } from '../video-conf/video-conf.component';

@Component({
  selector: 'app-join-call',
  imports: [
    CommonModule,
    VideoConfComponent
  ],
  templateUrl: './join-call.component.html',
  styleUrl: './join-call.component.css'
})
export class JoinCallComponent {
  videoService: VideoService;

  constructor(videoService: VideoService) {
    this.videoService = videoService;
  }

  setCallId(callId: string) {
    this.videoService.setCallId(callId);
  }
}
