import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { User } from '@stream-io/video-client';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:3000';
  private tokenKey = 'auth_token';
  private isLoggingOut = false;
  private currentUserSubject = new BehaviorSubject<any>(this.getUserFromToken());
  public user$ = this.currentUserSubject.asObservable();

  private testStreamToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3Byb250by5nZXRzdHJlYW0uaW8iLCJzdWIiOiJ1c2VyL0dlbmVyYWxfQ3JpeF9NYWRpbmUiLCJ1c2VyX2lkIjoiR2VuZXJhbF9Dcml4X01hZGluZSIsInZhbGlkaXR5X2luX3NlY29uZHMiOjYwNDgwMCwiaWF0IjoxNzQ3MTM4OTIyLCJleHAiOjE3NDc3NDM3MjJ9.SA_MCi4iqsWIJJb-wFXcb7AUXSFmZnqZNpKS8Ro9N0o';
  constructor(private http: HttpClient, private router: Router) {}

  register(user: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/auth/register`, user);
  }

  login(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/auth/login`, credentials).pipe(
      tap((response: any) => {
        if (response && response.token) {
          localStorage.setItem(this.tokenKey, response.token);
          this.setUserFromToken(response.token);
          this.fetchUserDetails(credentials.email, response.token);

          setTimeout(() => {
            this.router.navigate(['/chat-video']);
          }, 100);
        }
      }),
      catchError(error => {
        console.error('Erreur de connexion:', error);
        return throwError(() => error);
      })
    );
  }

  private fetchUserDetails(email: string, token: string): void {
    this.http
      .get(`${this.apiUrl}/api/users/one-user?email=${email}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (user: any) => {
          this.currentUserSubject.next({
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            photoUrl: user.photoUrl || '',
          });
        },
        error: (error) => {
          console.error('Erreur lors de la récupération des détails utilisateur:', error);
        },
      });
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUserName(): string | null {
    const user = this.currentUserSubject.value;
    if (!user) {
      return null;
    }
    return `${user.lastName} ${user.firstName}`;
  }

  getUser(): User {
    const userToken = this.getToken();
    const token = this.getStreamToken();
    if (token && userToken) {
      const decoded: any = jwtDecode(token);
      const userDecoded: any = jwtDecode(userToken);
      return {
        id: decoded.user_id || decoded.sub.split('/')[1],
        name: userDecoded.firstName ? `${userDecoded.firstName} ${userDecoded.lastName || ''}` : userDecoded.id
      };
    }
    throw new Error('No user logged in');
  }

  getStreamToken(): string | undefined {
    return this.testStreamToken;
  }

  fetchStreamToken(): Observable<string> {
    return new Observable(observer => {
      console.log('Using test Stream token:', this.testStreamToken);
      observer.next(this.testStreamToken);
      observer.complete();
    });
  }

  private setUserFromToken(token: string): void {
    try {
      const decoded: any = jwtDecode(token);
      this.currentUserSubject.next({
        id: decoded.id,
        email: decoded.email,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        photoUrl: decoded.photoUrl || '',
      });
    } catch (error) {
      console.error('Erreur lors du décodage du token:', error);
      this.currentUserSubject.next(null);
    }
  }

  private getUserFromToken(): any | null {
    const token = this.getToken();
    if (!token) {
      return null;
    }
    try {
      return jwtDecode(token);
    } catch (error) {
      console.error('Erreur lors du décodage du token:', error);
      return null;
    }
  }

  updateProfile(data: FormData): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('Aucun token disponible'));
    }

    return this.http.put(`${this.apiUrl}/api/profile/update-profile`, data, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      tap((response: any) => {
        if (response.token) {
          localStorage.setItem(this.tokenKey, response.token);
          this.setUserFromToken(response.token);
          this.fetchUserDetails(response.email, response.token);
        }
      }),
      catchError(error => {
        console.error('Erreur dans updateProfile:', error);
        return throwError(() => error);
      })
    );
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    if (this.isLoggingOut) {
      return;
    }

    this.isLoggingOut = true;
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem('stream_token');
    this.currentUserSubject.next(null);

    setTimeout(() => {
      this.router.navigate(['/login']);
      this.isLoggingOut = false;
    }, 100);
  }
}
