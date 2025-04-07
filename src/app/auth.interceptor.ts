import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService, private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isPublicRoute = req.url.includes('/login') || req.url.includes('/register') || req.url.includes('/test');

    if (isPublicRoute) {
      // console.log('Interceptor skipped for public route:', req.url);
      return next.handle(req);
    }

    const token = this.authService.getToken();
    // console.log('Intercepted request:', req.url, 'Token available:', !!token);

    if (token) {
      const modifiedReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });

      // console.log('Request headers:',
      //   Array.from(modifiedReq.headers.keys())
      //     .map(key => `${key}: ${modifiedReq.headers.get(key)}`)
      //     .join(', ')
      // );

      return next.handle(modifiedReq).pipe(
        catchError((error: HttpErrorResponse) => {
          // console.log('Error in interceptor for URL:', req.url, 'Status:', error.status);

          if (error.status === 401) {
            console.log('Unauthorized access detected (401)');
          }

          return throwError(() => error);
        })
      );
    }

    console.log('No token found, proceeding without Authorization header');
    return next.handle(req);
  }
}
