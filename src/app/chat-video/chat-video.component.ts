import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth.service';
import { SocketService } from '../socket.service';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CommonModule } from '@angular/common';
import { jwtDecode } from 'jwt-decode';
import { catchError, of } from 'rxjs';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDialog } from '@angular/material/dialog';
import { ProfileDialogComponent } from '../profile-dialog/profile-dialog.component';
import { MatMenuModule } from '@angular/material/menu';
interface Message {
  text: string;
  time: Date;
  isSent: boolean;
}

interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  photoUrl: string;
}

@Component({
  selector: 'app-chat-video',
  imports: [
    CommonModule,
    FormsModule,
    MatSidenavModule,
    MatToolbarModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatChipsModule,
    MatMenuModule
  ],
  templateUrl: './chat-video.component.html',
  styleUrls: ['./chat-video.component.css'],
})
export class ChatVideoComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  selectedUser: User | null = null;
  user: User | null = null;
  messages: Message[] = [];
  contacts: User[] = [];
  newMessage: string = '';
  groupedMessages: { date: string, messages: Message[] }[] = [];
  isLoading: boolean = false;
  errorMessage: string | null = null;
  lastMessages: any[] = [];

  private apiUrl = 'http://localhost:3000';
  private currentUserId: string | null = null;

  firstName: string = '';
  lastName: string = '';
  photoUrl: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    public authService: AuthService,
    private socketService: SocketService,
    private dialog: MatDialog,
  ) {}

  ngAfterViewInit() {
    this.scrollToBottom();
  }

  ngOnInit(): void {
    const token = this.authService.getToken();
    if (token) {
      const decoded: any = jwtDecode(token);
      this.currentUserId = decoded.id;
      this.user = {
        _id: decoded.id,
        email: decoded.email,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        photoUrl: decoded.photoUrl || '',
      };
    }

    this.socketService.onPrivateMessageReceived((data) => {
      const isSent = data.senderId === this.currentUserId;
      if (!isSent) {
        this.messages.push({
          text: data.message,
          time: new Date(data.time),
          isSent: false,
        });
        this.updateLastMessage(data.senderId, data.message, data.time);
        this.groupMessagesByDate(this.messages);
      }
    });

    this.http.get<User[]>(`${this.apiUrl}/users`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
      },
    }).pipe(
      catchError(error => {
        if (error.status === 403) {
          this.logout();
        }
        return of([]);
      })
    ).subscribe(users => {
      this.contacts = users
      .filter(user => user._id !== this.currentUserId)
      .map(user => ({
        ...user,
        photoUrl: user.photoUrl
          ? `http://localhost:3000${user.photoUrl}`
          : 'images/default-men.jpg'
      }));
    });

    this.authService.user$.subscribe(user => {
      if (user) {
        this.firstName = user.firstName;
        this.lastName = user.lastName;
        this.photoUrl = user.photoUrl
          ? `http://localhost:3000${user.photoUrl}`
          : 'images/default-men.jpg';
        this.user = {
          _id: user.id || this.user?._id || '',
          email: user.email || this.user?.email || '',
          firstName: user.firstName || this.user?.firstName || '',
          lastName: user.lastName || this.user?.lastName || '',
          photoUrl: user.photoUrl || this.user?.photoUrl || '',
        };
        // console.log('Données utilisateur mises à jour:', {
        //   firstName: this.firstName,
        //   lastName: this.lastName,
        //   photoUrl: this.photoUrl,
        //   user: this.user,
        // });
      }
    });

    this.fetchLastMessages();
  }


  ngOnChanges() {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      setTimeout(() => {
        this.scrollContainer.nativeElement.scrollTo({
          top: this.scrollContainer.nativeElement.scrollHeight,
          behavior: 'smooth'
        });

      }, 0);
    } catch (err) {
      console.warn('Scroll failed:', err);
    }
  }

  ngOnDestroy(): void {
    this.socketService.disconnect();
  }

  selectUser(user: User) {
    this.selectedUser = user;
    this.loadMessages();
    this.socketService.joinPrivateChat(this.currentUserId!, user._id);
  }

  loadMessages(): void {
    if (!this.selectedUser || !this.currentUserId) return;

    this.http.get<any[]>(`${this.apiUrl}/messages?otherUserEmail=${this.selectedUser.email}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
    }).subscribe({
      next: (messages) => {
        this.messages = messages.map((msg) => ({
          text: msg.text,
          time: new Date(msg.time),
          isSent: msg.senderId._id === this.currentUserId,
        }));
        this.groupMessagesByDate(this.messages);
        setTimeout(() => {
          this.scrollToBottom();
        }, 0);
      },
      error: (err) => {
        this.errorMessage = 'Failed to load messages: ' + err.message;
      },
    });
  }

  sendMessage(): void {
    if (this.newMessage.trim() && this.currentUserId && this.selectedUser) {
      const message: Message = {
        text: this.newMessage,
        time: new Date(),
        isSent: true,
      };
      this.messages.push(message);
      this.updateLastMessage(this.selectedUser!._id, message.text, message.time);
      this.socketService.sendPrivateMessage(this.currentUserId, this.selectedUser._id, this.newMessage);
      this.newMessage = '';
      this.groupMessagesByDate(this.messages);
      this.scrollToBottom();
    }
  }

  groupMessagesByDate(messages: Message[]): void {
    const grouped: { date: string, messages: Message[] }[] = [];

    messages.forEach(msg => {
      const msgDate = new Date(msg.time);
      const dateKey = this.getDateLabel(msgDate);

      const existing = grouped.find(g => g.date === dateKey);
      if (existing) {
        existing.messages.push(msg);
      } else {
        grouped.push({ date: dateKey, messages: [msg] });
      }
    });

    this.groupedMessages = grouped;
  }

  fetchLastMessages() {
    const token = localStorage.getItem('auth_token');
    this.http.get<any[]>(`${this.apiUrl}/last-messages`, {
      headers: { Authorization: `Bearer ${token}` },
    }).subscribe({
      next: (messages) => {
        this.lastMessages = messages;
        this.sortContactsByLastMessage();
      },
      error: (err) => {
        console.error('Erreur lors de la récupération des derniers messages :', err);
      }
    });
  }

  getLastMessageForContact(contactId: string): string | null {
    const found = this.lastMessages.find(msg => msg.contactId === contactId);
    return found ? found.lastMessage : null;
  }

  updateLastMessage(contactId: string, message: string, time: Date | string) {
    const existing = this.lastMessages.find(m => m.contactId === contactId);
    if (existing) {
      existing.lastMessage = message;
      existing.time = time;
    } else {
      this.lastMessages.push({
        contactId,
        lastMessage: message,
        time
      });
    }
    this.sortContactsByLastMessage();
  }

  sortContactsByLastMessage() {
    this.contacts.sort((a, b) => {
      const msgA = this.lastMessages.find(m => m.contactId === a._id);
      const msgB = this.lastMessages.find(m => m.contactId === b._id);

      const timeA = msgA ? new Date(msgA.time).getTime() : 0;
      const timeB = msgB ? new Date(msgB.time).getTime() : 0;

      return timeB - timeA; // plus récent en haut
    });
  }

  getDateLabel(date: Date): string {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';

    return date.toLocaleDateString();
  }

  openProfileModal() {
    console.log('Données utilisateur envoyées au dialogue:', this.user);

    const dialogRef = this.dialog.open(ProfileDialogComponent, {
      width: '400px',
      data: {
        _id: this.user?._id || '',
        email: this.user?.email || '',
        firstName: this.user?.firstName || '',
        lastName: this.user?.lastName || '',
        photoUrl: this.user?.photoUrl || '',
      },
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        console.log('Dialogue fermé avec succès:', result);
      }
    });
  }

  logout() {
    this.authService.logout();
  }
}
