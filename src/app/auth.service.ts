import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
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
  private currentUserSubject = new BehaviorSubject<any>(this.getUser());
public user$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  register(user: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, user);
  }

  login(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials).pipe(
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

  private fetchUserDetails(email: string, token: string) {
  this.http
    .get(`${this.apiUrl}/one-user?email=${email}`, {
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
        console.log('Données utilisateur récupérées:', user);
      },
      error: (error) => {
        console.error('Erreur lors de la récupération des détails utilisateur:', error);
      },
    });
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

  setUserFromToken(token: string) {
    try {
      const decoded: any = jwtDecode(token);
      this.currentUserSubject.next({
        id: decoded.id,
        email: decoded.email,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        photoUrl: decoded.photoUrl || '',
      });
      console.log('Utilisateur mis à jour dans AuthService:', decoded);
    } catch (error) {
      console.error('Erreur lors du décodage du token:', error);
      this.currentUserSubject.next(null);
    }
  }

  getUser(): any | null {
    const token = this.getToken();
    if (!token) return null;
    const decoded: any = jwtDecode(token);
    return decoded;
  }

  updateProfile(data: FormData): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('Aucun token disponible'));
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    return this.http.put(`${this.apiUrl}/update-profile`, data, { headers }).pipe(
      tap((response: any) => {
        if (response.token) {
          this.setUserFromToken(response.token);
          console.log('Token et données utilisateur mis à jour:', response);
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
