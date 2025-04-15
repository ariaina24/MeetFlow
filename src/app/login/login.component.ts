import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../auth.service';
import { RouterLink, Router } from '@angular/router';
import { MatGridListModule } from '@angular/material/grid-list';
import { finalize } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    RouterLink,
    MatGridListModule,
    CommonModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage: string | null = null;
  hidePassword: boolean = true;
  isLoading: boolean = false;

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });

    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/chat-video']);
    }
  }

  hide(): boolean {
    return this.hidePassword;
  }

  clickEvent(event: Event): void {
    event.preventDefault();
    this.hidePassword = !this.hidePassword;
  }

  updateErrorMessage(): void {
    const emailControl = this.loginForm.get('email');
    if (emailControl?.hasError('required')) {
      this.errorMessage = 'Email is required';
    } else if (emailControl?.hasError('email')) {
      this.errorMessage = 'Please enter a valid email';
    } else {
      this.errorMessage = null;
    }
    this.cdr.markForCheck();
  }

  errorMessageFn(): string | null {
    return this.errorMessage;
  }

  login() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = null;
      this.cdr.markForCheck();

      const credentials = this.loginForm.value;
      this.authService.login(credentials).pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        })
      ).subscribe({
        next: (response) => {
          console.log('Login successful:', response);
        },
        error: (error) => {
          console.error('Login error:', error);
          this.errorMessage = error.error?.error || 'Login failed. Please try again.';
          this.cdr.markForCheck();
        },
      });
    }
  }
}
