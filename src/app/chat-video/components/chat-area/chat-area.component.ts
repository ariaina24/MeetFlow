import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild, OnInit, SimpleChanges } from '@angular/core';
import { User } from '../../models/user.model';
import { Message, GroupedMessage } from '../../models/message.model';
import { ChatService } from '../../services/chat.service';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MessageInputComponent } from '../message-input/message-input.component';
import { VideoConferenceComponent } from '../video-conference/video-conference.component';
import { Subscription } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms'; // Import FormsModule for ngModel
import { AuthService } from '../../../shared/auth.service';

@Component({
  selector: 'app-chat-area',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MessageInputComponent,
    VideoConferenceComponent,
    FormsModule, // Add FormsModule for ngModel
  ],
  templateUrl: './chat-area.component.html',
  styleUrls: ['./chat-area.component.css'],
})
export class ChatAreaComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  @Input() user: User | null = null;
  @Input()
  set selectedUser(user: User | null) {
    this._selectedUser = user;
    if (user) {
      this.loadMessages();
      this.setupMessageListener();
    } else {
      this.messages = [];
      this.groupedMessages = [];
      this.isVideoCallActive = false;
      this.showVideoCallInterface = false; // Reset when no user is selected
    }
  }
  get selectedUser(): User | null {
    return this._selectedUser;
  }
  private _selectedUser: User | null = null;
  @Input() lastMessages: any[] = [];
  @Input() showVideoCallInterface: boolean = false; // New input to show video call controls

  messages: Message[] = [];
  groupedMessages: GroupedMessage[] = [];
  errorMessage: string | null = null;
  isVideoCallActive: boolean = false;
  roomId: string | null = null;
  roomIdInput: string = ''; // Input for joining a room
  private subscription: Subscription = new Subscription();

  constructor(private chatService: ChatService, private authService: AuthService, private http: HttpClient) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedUser']) {
      const newUser = changes['selectedUser'].currentValue;
      if (newUser) {
        this.loadMessages();
        this.setupMessageListener();
      } else {
        this.messages = [];
        this.groupedMessages = [];
        this.isVideoCallActive = false;
        this.showVideoCallInterface = false; // Reset when no user is selected
      }
    }
    if (changes['lastMessages']) {
      this.updateLastMessageBasedOnInput();
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.chatService.onPrivateMessageReceived(() => {});
  }

  createVideoRoom(): void {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.authService.getToken()}`,
    });
    this.http
      .post<{ roomId: string }>('http://localhost:3000/api/video/create-room', {}, { headers })
      .subscribe({
        next: (response) => {
          this.roomId = response.roomId;
          this.isVideoCallActive = true;
          this.showVideoCallInterface = false; // Hide controls after creating room
          console.log('Salle créée:', this.roomId);
        },
        error: (err) => {
          this.errorMessage = 'Erreur lors de la création de la salle';
          console.error('Erreur:', err);
        },
      });
  }

  joinVideoRoom(): void {
    if (!this.roomIdInput || this.roomIdInput.trim() === '') {
      this.errorMessage = 'Veuillez entrer un ID de salle valide';
      return;
    }
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.authService.getToken()}`,
    });
    this.http
      .get(`http://localhost:3000/api/video/check-room/${this.roomIdInput}`, { headers })
      .subscribe({
        next: (response: any) => {
          this.roomId = this.roomIdInput;
          this.isVideoCallActive = true;
          this.showVideoCallInterface = false; // Hide controls after joining
          this.roomIdInput = ''; // Clear input
        },
        error: (err) => {
          this.errorMessage = 'Salle non trouvée ou erreur serveur';
          console.error('Erreur:', err);
        },
      });
  }

  stopVideoCall(): void {
    this.isVideoCallActive = false;
    this.roomId = null;
    this.showVideoCallInterface = false; // Reset interface
  }

  closeVideoCallControls(): void {
    this.showVideoCallInterface = false;
    this.errorMessage = null;
  }
  private setupMessageListener(): void {
    this.chatService.onPrivateMessageReceived((data) => {
      if (this._selectedUser?._id === data.senderId && data.senderId !== this.user?._id) {
        this.messages.push({
          text: data.message,
          time: new Date(data.time),
          isSent: false,
        });
        this.updateLastMessage(data.senderId, data.message, data.time, data.isRead);
        this.groupedMessages = this.chatService.groupMessagesByDate(this.messages);
        this.scrollToBottom();
      }
    });
  }

  private updateLastMessageBasedOnInput(): void {
    if (this._selectedUser && this.lastMessages.length > 0) {
      const lastMsg = this.lastMessages.find((m) => m.contactId === this._selectedUser?._id);
      if (lastMsg && this.messages.length === 0) {
        this.messages.push({
          text: lastMsg.lastMessage,
          time: new Date(lastMsg.time),
          isSent: lastMsg.contactId !== this.user?._id,
        });
        this.groupedMessages = this.chatService.groupMessagesByDate(this.messages);
        this.scrollToBottom();
      }
    }
  }

  loadMessages(): void {
    if (!this._selectedUser || !this.user) return;
    this.chatService.loadMessages(this._selectedUser.email).subscribe({
      next: (messages) => {
        this.messages = messages.map((msg) => ({
          text: msg.text,
          time: new Date(msg.time),
          isSent: msg.senderId._id === this.user?._id,
        }));
        this.groupedMessages = this.chatService.groupMessagesByDate(this.messages);
        this.scrollToBottom();
      },
      error: (err) => {
        this.errorMessage = 'Échec du chargement des messages : ' + err.message;
        console.error('Erreur lors du chargement des messages:', err);
      },
    });
  }

  sendMessage(text: string): void {
    if (text.trim() && this.user && this._selectedUser) {
      const message: Message = {
        text,
        time: new Date(),
        isSent: true,
      };
      this.messages.push(message);
      this.updateLastMessage(this._selectedUser._id, message.text, message.time, true);
      this.chatService.sendMessage(this.user._id, this._selectedUser._id, text);
      this.groupedMessages = this.chatService.groupMessagesByDate(this.messages);
      this.scrollToBottom();
    }
  }

  updateLastMessage(contactId: string, message: string, time: Date | string, isRead: boolean): void {
    const existing = this.lastMessages.find((m) => m.contactId === contactId);
    if (existing) {
      existing.lastMessage = message;
      existing.time = time;
      existing.isRead = isRead;
    } else {
      this.lastMessages.push({ contactId, lastMessage: message, time, isRead });
    }
    this.chatService.updateLastMessages([...this.lastMessages]);
  }

  pushMessage(message: { text: string; time: Date; isSent: boolean }) {
    this.messages.push(message);
    this.groupedMessages = this.chatService.groupMessagesByDate(this.messages);
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    setTimeout(() => {
      this.scrollContainer.nativeElement.scrollTo({
        top: this.scrollContainer.nativeElement.scrollHeight,
        behavior: 'smooth',
      });
    }, 0);
  }
}
