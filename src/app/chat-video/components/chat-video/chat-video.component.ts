import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { User } from '../../models/user.model';
import { MatDialog } from '@angular/material/dialog';
import { ProfileDialogComponent } from '../profile-dialog/profile-dialog.component';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { jwtDecode } from 'jwt-decode';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../../shared/auth.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ChatAreaComponent } from '../chat-area/chat-area.component';
import { VideoService } from '../../services/video.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-chat-video',
  standalone: true,
  imports: [CommonModule, MatSidenavModule, SidebarComponent, ChatAreaComponent],
  templateUrl: './chat-video.component.html',
  styleUrls: ['./chat-video.component.css'],
})
export class ChatVideoComponent implements OnInit, OnDestroy {
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild(ChatAreaComponent) chatAreaComponent!: ChatAreaComponent;

  user: User | null = null;
  selectedUser: User | null = null;
  contacts: User[] = [];
  lastMessages: any[] = [];

  constructor(
    private authService: AuthService,
    private chatService: ChatService,
    private dialog: MatDialog,
    private videoService: VideoService,
    private router: Router,
    private cdr: ChangeDetectorRef // Injecter ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const token = this.authService.getToken();
    if (token) {
      const decoded: any = jwtDecode(token);
      this.user = {
        _id: decoded.id,
        email: decoded.email,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        photoUrl: decoded.photoUrl || '',
      };
    }

    this.chatService.fetchContacts().subscribe((users) => {
      this.contacts = users
        .filter((user) => user._id !== this.user?._id)
        .map((user) => ({
          ...user,
          photoUrl: user.photoUrl
            ? `http://localhost:3000${user.photoUrl}`
            : 'images/default-men.jpg',
        }));
      this.contacts.forEach((contact) => {
        this.chatService.joinPrivateChat(this.user!._id, contact._id);
      });
      this.chatService.refreshLastMessages();
    });

    this.chatService.fetchLastMessages().subscribe((messages) => {
      this.lastMessages = messages;
      this.sortContactsByLastMessage();
    });

    this.authService.user$.subscribe((user) => {
      if (user) {
        this.user = {
          _id: user.id || this.user?._id || '',
          email: user.email || this.user?.email || '',
          firstName: user.firstName || this.user?.firstName || '',
          lastName: user.lastName || this.user?.lastName || '',
          photoUrl: user.photoUrl
            ? `http://localhost:3000${user.photoUrl}`
            : 'images/default-men.jpg',
        };
      }
    });

    this.chatService.onPrivateMessageReceived((data) => {
      const updatedMessages = [...this.lastMessages.filter(m => m.contactId !== data.senderId)];

      updatedMessages.push({
        contactId: data.senderId,
        lastMessage: data.message,
        time: data.time,
        isRead: data.isRead,
      });

      updatedMessages.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      this.lastMessages = [...updatedMessages];
      this.chatService.updateLastMessages([...updatedMessages]);

      if (this.selectedUser?._id === data.senderId && data.senderId !== this.user?._id) {
        this.chatAreaComponent?.pushMessage({
          text: data.message,
          time: new Date(data.time),
          isSent: false,
        });
      }
    });

    this.chatService.lastMessages$.subscribe(messages => {
      this.lastMessages = messages;
      this.sortContactsByLastMessage();
      this.contacts = [...this.contacts];
    });
  }

  ngOnDestroy(): void {}

  selectUser(user: User): void {
    this.selectedUser = { ...user };
    this.videoService.toggleVideoCall(false);
    this.chatService.joinPrivateChat(this.user!._id, user._id);
    this.chatService.markMessagesAsRead(user._id).subscribe(() => {
      this.chatService.refreshLastMessages();
    });
    this.cdr.detectChanges();
  }

  openProfileModal(): void {
    this.dialog.open(ProfileDialogComponent, {
      width: '400px',
      data: this.user,
    });
  }

  logout(): void {
    this.authService.logout();
  }

  sortContactsByLastMessage(): void {
    this.contacts.sort((a, b) => {
      const msgA = this.lastMessages.find((m) => m.contactId === a._id);
      const msgB = this.lastMessages.find((m) => m.contactId === b._id);
      const timeA = msgA ? new Date(msgA.time).getTime() : 0;
      const timeB = msgB ? new Date(msgB.time).getTime() : 0;
      return timeB - timeA;
    });
    this.contacts = [...this.contacts];
  }

  goToHome(): void {
    this.videoService.toggleVideoCall(false);
    this.router.navigate(['/']);
  }

  startVideoCall(): void {
    this.videoService.toggleVideoCall(true);
  }
}
