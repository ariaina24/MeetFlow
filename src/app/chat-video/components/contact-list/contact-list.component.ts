import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { User } from '../../models/user.model';
import { MatListModule } from '@angular/material/list';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-contact-list',
  imports: [
    MatListModule,
    FormsModule,
    CommonModule
  ],
  templateUrl: './contact-list.component.html',
  styleUrls: ['./contact-list.component.css'],
})
export class ContactListComponent implements OnChanges {
  @Input() contacts: User[] = [];
  @Input() lastMessages: any[] = [];
  @Output() userSelected = new EventEmitter<User>();

  sortedContacts: User[] = [];

  constructor(
    private chatService: ChatService,
  ) {}

  ngOnInit(): void {
    this.chatService.lastMessages$.subscribe(messages => {
      this.lastMessages = [...messages];
      this.sortContacts();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['contacts'] || changes['lastMessages']) {
      this.sortContacts();
    }
  }

  sortContacts(): void {
    this.sortedContacts = [...this.contacts].sort((a, b) => {
      const lastMessageA = this.lastMessages.find((msg) => msg.contactId === a._id);
      const lastMessageB = this.lastMessages.find((msg) => msg.contactId === b._id);

      const timeA = lastMessageA ? new Date(lastMessageA.time).getTime() : 0;
      const timeB = lastMessageB ? new Date(lastMessageB.time).getTime() : 0;

      return timeB - timeA;
    });
  }

  selectUser(user: User): void {
    this.userSelected.emit(user);
  }

  getLastMessage(userId: string): string {
    const lastMessage = this.lastMessages.find((msg) => msg.contactId === userId);
    return lastMessage ? lastMessage.lastMessage : 'No messages yet';
  }

  getLastMessageTime(userId: string): string {
    const lastMessage = this.lastMessages.find((msg) => msg.contactId === userId);
    return lastMessage ? new Date(lastMessage.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  }
}
