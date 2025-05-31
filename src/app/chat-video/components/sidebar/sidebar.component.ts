import { Component, EventEmitter, Input, Output } from '@angular/core';
import { User } from '../../models/user.model';
import { AuthService } from '../../../shared/auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { ContactListComponent } from '../contact-list/contact-list.component';
import { FormsModule } from '@angular/forms';

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
    FormsModule
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
  @Output() startVideoCall = new EventEmitter<void>();
  searchTerm: string = '';

  constructor(
    public authService: AuthService,
    private router: Router
  ) {}

  selectUser(user: User): void {
    this.userSelected.emit(user);
  }

  get filteredContacts(): User[] {
    if (!this.searchTerm.trim()) {
      return this.contacts;
    }
    const lowerSearch = this.searchTerm.toLowerCase();
    return this.contacts.filter(contact =>
      `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(lowerSearch)
    );
  }

  openProfileModal(): void {
    this.openProfile.emit();
  }

  onLogout(): void {
    this.logout.emit();
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }

  onStartVideoCall(): void {
    this.startVideoCall.emit();
  }
}
