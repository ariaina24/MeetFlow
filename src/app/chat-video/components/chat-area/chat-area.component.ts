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
import { Subscription } from 'rxjs';

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
    }
  }
  get selectedUser(): User | null {
    return this._selectedUser;
  }
  private _selectedUser: User | null = null;
  @Input() lastMessages: any[] = [];

  messages: Message[] = [];
  groupedMessages: GroupedMessage[] = [];
  errorMessage: string | null = null;
  private subscription: Subscription = new Subscription();

  constructor(private chatService: ChatService) {}

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
        this.errorMessage = 'Failed to load messages: ' + err.message;
        console.error('Error loading messages:', err);
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
