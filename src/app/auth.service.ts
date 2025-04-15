import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { tap, catchError, delay } from 'rxjs/operators';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:3000';
  private tokenKey = 'auth_token';
  private isLoggingOut = false;

  constructor(private http: HttpClient, private router: Router) {}

  register(user: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, user);
  }

  login(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials).pipe(
      tap((response: any) => {
        if (response && response.token) {
          localStorage.setItem(this.tokenKey, response.token);
          // console.log('Token stored in localStorage:', response.token);

          setTimeout(() => {
            this.router.navigate(['/chat-video']);
          }, 100);
        }
      }),
      catchError(error => {
        console.error('Login error:', error);
        return throwError(() => error);
      })
    );
  }

  getToken(): string | null {
    const token = localStorage.getItem(this.tokenKey);
    // console.log('getToken called, returning:', token ? 'token exists' : 'no token');
    return token;
  }

  getUserName(): string | null {
    const token = this.getToken();
    if (!token) return null;
    const decoded: any = jwtDecode(token);
    return decoded.firstName + ' ' + decoded.lastName;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    if (this.isLoggingOut) return;

    this.isLoggingOut = true;
    // console.log('Logging out, removing token');
    localStorage.removeItem(this.tokenKey);

    setTimeout(() => {
      this.router.navigate(['/login']);
      this.isLoggingOut = false;
    }, 100);
  }
}
