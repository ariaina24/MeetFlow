import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { HomeComponent } from './home/home.component';
import { RegisterComponent } from './register/register.component';
import { authGuard, publicGuard } from './auth.guard';
import { ChatVideoComponent } from './chat-video/chat-video.component';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, canActivate: [publicGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [publicGuard] },
  { path: 'home', component: HomeComponent, canActivate: [authGuard] },
  { path: 'chat-video', component: ChatVideoComponent, canActivate: [authGuard]},
  { path: '**', redirectTo: '/home' },
];
