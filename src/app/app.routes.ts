import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { authGuard, publicGuard } from './shared/auth.guard';
import { ChatVideoComponent } from './chat-video/components/chat-video/chat-video.component';

export const routes: Routes = [
  { path: '', redirectTo: '/chat-video', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, canActivate: [publicGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [publicGuard] },
  { path: 'chat-video', component: ChatVideoComponent, canActivate: [authGuard]},
  { path: '**', redirectTo: '/chat-video' },
];
