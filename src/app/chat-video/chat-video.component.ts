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
  ],
  templateUrl: './chat-video.component.html',
  styleUrls: ['./chat-video.component.css'],
})
export class ChatVideoComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
    @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;
    @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

    selectedUser: User | null = null;
    messages: Message[] = [];
    contacts: User[] = [];
    newMessage: string = '';
    groupedMessages: { date: string, messages: Message[] }[] = [];
    isLoading: boolean = false;
    errorMessage: string | null = null;
    private apiUrl = 'http://localhost:3000';
    private currentUserId: string | null = null;

    constructor(
      private route: ActivatedRoute,
      private router: Router,
      private http: HttpClient,
      public authService: AuthService,
      private socketService: SocketService
    ) {}

    ngAfterViewInit() {
      this.scrollToBottom();
    }

    ngOnInit(): void {
      const token = this.authService.getToken();
      if (token) {
        const decoded: any = jwtDecode(token);
        this.currentUserId = decoded.id;
      }

      const userEmail = this.route.snapshot.queryParamMap.get('email');
      if (userEmail) {
        this.loadUserDetails(userEmail);
      } else {
        this.errorMessage = 'No user selected for chat.';
      }

      this.socketService.onPrivateMessageReceived((data) => {
        const isSent = data.senderId === this.currentUserId;
        if (!isSent) {
          this.messages.push({
            text: data.message,
            time: new Date(data.time),
            isSent: false,
          });
          this.groupMessagesByDate(this.messages);
        }
      });

      this.http.get<User[]>(`${this.apiUrl}/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      }).pipe(
        catchError(error => {
          if (error.status === 403) {
            this.logout();
          }
          return of([]);
        })
      ).subscribe(users => {
        this.contacts = users.filter(user => user._id !== this.currentUserId);
      });
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

    loadUserDetails(email: string): void {
      this.isLoading = true;
      this.http.get<User>(`${this.apiUrl}/one-user?email=${email}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      }).subscribe({
        next: (user) => {
          this.isLoading = false;
          if (user) {
            this.selectedUser = user;
            this.loadMessages();
          } else {
            this.errorMessage = 'User not found.';
          }
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = 'Failed to load user details: ' + err.message;
        }
      });
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

    logout() {
      this.authService.logout();
    }
}
