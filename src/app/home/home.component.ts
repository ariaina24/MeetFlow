import { Component, ChangeDetectionStrategy, OnInit, ChangeDetectorRef } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-home',
  imports: [
    MatCardModule,
    MatButtonModule,
    HttpClientModule,
    CommonModule,
    MatProgressSpinnerModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {
  user: any = null;
  users: any[] = [];
  errorMessage: string | null = null;
  isLoading: boolean = true;
  private apiUrl = 'http://localhost:3000';

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    this.isLoading = true;
    this.cdr.markForCheck();

    this.http.get(`${this.apiUrl}/home`).pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (response: any) => {
        this.user = response.user;
        this.getUsers();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Home error:', error);
        if (error.status == 403){
          this.logout();
        }
        this.errorMessage = `Failed to load home page (${error.status}): ${error.error?.message || error.statusText}`;
        this.cdr.markForCheck();
      },
    });
  }


  getUsers(): void {
    this.http.get<any[]>(`${this.apiUrl}/users`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .subscribe({
      next: (users) => {
        this.users = users.filter(user => user.email !== this.user.email);
      }

    });
  }


  logout() {
    this.authService.logout();
  }

  startPrivateChat(email: string): void {
    this.router.navigate(['/chat-video'], { queryParams: { email } });
  }
}
