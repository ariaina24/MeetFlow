import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, of } from 'rxjs';
import { Message, GroupedMessage, ApiMessage } from '../models/message.model';
import { User } from '../models/user.model';
import { SocketService } from '../../shared/socket.service';
import { AuthService } from '../../shared/auth.service';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private apiUrl = 'http://localhost:3000';
  private lastMessagesSubject = new BehaviorSubject<any[]>([]);
  lastMessages$ = this.lastMessagesSubject.asObservable();

  constructor(
    private http: HttpClient,
    private socketService: SocketService,
    private authService: AuthService
  ) {}

  fetchContacts(): Observable<User[]> {
    const token = this.authService.getToken();
    return this.http
      .get<User[]>(`${this.apiUrl}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        catchError((error) => {
          if (error.status === 403) {
            this.authService.logout();
          }
          return of([]);
        })
      );
  }

  fetchLastMessages(): Observable<any[]> {
    const token = this.authService.getToken();
    return this.http.get<any[]>(`${this.apiUrl}/api/messages/last-messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  loadMessages(otherUserEmail: string): Observable<ApiMessage[]> {
    const token = this.authService.getToken();
    return this.http.get<ApiMessage[]>(`${this.apiUrl}/api/messages?otherUserEmail=${otherUserEmail}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  groupMessagesByDate(messages: Message[]): GroupedMessage[] {
    const grouped: GroupedMessage[] = [];
    messages.forEach((msg) => {
      const msgDate = new Date(msg.time);
      const dateKey = this.getDateLabel(msgDate);
      const existing = grouped.find((g) => g.date === dateKey);
      if (existing) {
        existing.messages.push(msg);
      } else {
        grouped.push({ date: dateKey, messages: [msg] });
      }
    });
    return grouped;
  }

  getDateLabel(date: Date): string {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    return isToday ? 'Today' : isYesterday ? 'Yesterday' : date.toLocaleDateString();
  }

  sendMessage(senderId: string, receiverId: string, text: string): void {
    this.socketService.sendPrivateMessage(senderId, receiverId, text);
  }

  onPrivateMessageReceived(callback: (data: any) => void): void {
    this.socketService.onPrivateMessageReceived(callback);
  }

  joinPrivateChat(senderId: string, receiverId: string): void {
    this.socketService.joinPrivateChat(senderId, receiverId);
  }

  refreshLastMessages(): void {
    this.fetchLastMessages().subscribe(messages => {
      this.updateLastMessages(messages);
    });
  }

  updateLastMessages(messages: any[]) {
    this.lastMessagesSubject.next(messages);
  }
}
