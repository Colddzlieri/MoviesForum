import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { PublicUserProfile, PublicUserSummary } from '../models/post.models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
  ) {}

  list(): Observable<PublicUserSummary[]> {
    return this.http.get<{ users: PublicUserSummary[] }>('/api/users').pipe(map((response) => response.users));
  }

  profile(id: string): Observable<PublicUserProfile> {
    return this.http.get<PublicUserProfile>(`/api/users/${id}`, { headers: this.headers() });
  }

  private headers(): HttpHeaders {
    return new HttpHeaders(this.auth.authHeaders());
  }
}
