import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import { User } from '../../models/user.model';
import { Message, GroupedMessage } from '../../models/message.model';
import { ChatService } from '../../services/chat.service';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MessageInputComponent } from '../message-input/message-input.component';
import { JoinCallComponent } from "../join-call/join-call.component";

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
    JoinCallComponent
],
  templateUrl: './chat-area.component.html',
  styleUrls: ['./chat-area.component.css'],
})
export class ChatAreaComponent implements AfterViewInit, OnDestroy {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  @Input() user: User | null = null;
  @Input() selectedUser: User | null = null;
  @Input() lastMessages: any[] = [];

  messages: Message[] = [];
  groupedMessages: GroupedMessage[] = [];
  errorMessage: string | null = null;

  constructor(private chatService: ChatService) {}

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  ngOnChanges(): void {
    if (this.selectedUser) {
      this.loadMessages();
      this.chatService.onPrivateMessageReceived((data) => {
        if (data.senderId !== this.user?._id) {
          this.messages.push({
            text: data.message,
            time: new Date(data.time),
            isSent: false,
          });
          this.updateLastMessage(data.senderId, data.message, data.time);
          this.groupedMessages = this.chatService.groupMessagesByDate(this.messages);
          this.scrollToBottom();
        }
      });
    }
  }

  ngOnDestroy(): void {
    // Cleanup if necessary
  }

  loadMessages(): void {
    if (!this.selectedUser || !this.user) return;
    this.chatService.loadMessages(this.selectedUser.email).subscribe({
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
      },
    });
  }

  sendMessage(text: string): void {
    if (text.trim() && this.user && this.selectedUser) {
      const message: Message = {
        text,
        time: new Date(),
        isSent: true,
      };
      this.messages.push(message);
      this.updateLastMessage(this.selectedUser._id, message.text, message.time);
      this.chatService.sendMessage(this.user._id, this.selectedUser._id, text);
      this.groupedMessages = this.chatService.groupMessagesByDate(this.messages);
      this.scrollToBottom();
    }
  }

  updateLastMessage(contactId: string, message: string, time: Date | string): void {
    const existing = this.lastMessages.find((m) => m.contactId === contactId);
    if (existing) {
      existing.lastMessage = message;
      existing.time = time;
    } else {
      this.lastMessages.push({ contactId, lastMessage: message, time });
    }
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
