import { Component, EventEmitter, Input, Output } from '@angular/core';
import { User } from '../../models/user.model';
import { AuthService } from '../../../shared/auth.service';
import { VideoService } from '../../services/video.service'; // Importer VideoService
import { Router } from '@angular/router'; // Importer Router
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { ContactListComponent } from '../contact-list/contact-list.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatListModule,
    MatButtonModule,
    MatMenuModule,
    ContactListComponent,
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
})
export class SidebarComponent {
  @Input() user: User | null = null;
  @Input() contacts: User[] = [];
  @Input() lastMessages: any[] = [];
  @Output() userSelected = new EventEmitter<User>();
  @Output() openProfile = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  constructor(
    public authService: AuthService,
    private videoService: VideoService,
    private router: Router
  ) {}

  selectUser(user: User): void {
    this.videoService.toggleVideoCall(false);
    this.userSelected.emit(user);
  }

  openProfileModal(): void {
    this.openProfile.emit();
  }

  onLogout(): void {
    this.logout.emit();
  }

  goToHome(): void {
    this.videoService.toggleVideoCall(false);
    this.router.navigate(['/']);
  }

  startVideoCall(): void {
    this.videoService.toggleVideoCall(true);
  }
}
