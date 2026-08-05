import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { AdminUserSummary, MoviePost, PostPayload, UserActivity } from '../models/post.models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class PostsService {
  private readonly postsState = signal<MoviePost[]>([]);
  readonly posts = this.postsState.asReadonly();

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
  ) {}

  load(): Observable<MoviePost[]> {
    return this.http.get<{ posts: MoviePost[] }>('/api/posts', { headers: this.headers() }).pipe(
      map((response) => response.posts),
      tap((posts) => this.postsState.set(posts)),
    );
  }

  get(id: string, track = true): Observable<MoviePost> {
    return this.http.get<{ post: MoviePost }>(`/api/posts/${id}`, {
      headers: this.headers(),
      params: { track: String(track) },
    }).pipe(map((response) => response.post));
  }

  create(payload: PostPayload): Observable<MoviePost> {
    return this.http.post<{ post: MoviePost }>('/api/posts', payload, { headers: this.headers() }).pipe(
      map((response) => response.post),
      tap((post) => this.postsState.update((posts) => [post, ...posts])),
    );
  }

  update(id: string, payload: PostPayload): Observable<MoviePost> {
    return this.http.patch<{ post: MoviePost }>(`/api/posts/${id}`, payload, { headers: this.headers() }).pipe(
      map((response) => response.post),
      tap((post) => this.postsState.update((posts) => posts.map((item) => (item.id === post.id ? post : item)))),
    );
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/posts/${id}`, { headers: this.headers() }).pipe(
      tap(() => this.postsState.update((posts) => posts.filter((post) => post.id !== id))),
    );
  }

  toggleLike(id: string): Observable<MoviePost> {
    return this.http.post<{ post: MoviePost }>(`/api/posts/${id}/like`, {}, { headers: this.headers() }).pipe(map((response) => response.post));
  }

  addComment(id: string, text: string): Observable<MoviePost> {
    return this.http.post<{ post: MoviePost }>(`/api/posts/${id}/comments`, { text }, { headers: this.headers() }).pipe(map((response) => response.post));
  }

  toggleCommentReaction(id: string, commentId: string): Observable<MoviePost> {
    return this.http
      .post<{ post: MoviePost }>(`/api/posts/${id}/comments/${commentId}/react`, {}, { headers: this.headers() })
      .pipe(map((response) => response.post));
  }

  addCommentReply(id: string, commentId: string, text: string): Observable<MoviePost> {
    return this.http
      .post<{ post: MoviePost }>(`/api/posts/${id}/comments/${commentId}/replies`, { text }, { headers: this.headers() })
      .pipe(map((response) => response.post));
  }

  toggleCommentReplyReaction(id: string, commentId: string, replyId: string): Observable<MoviePost> {
    return this.http
      .post<{ post: MoviePost }>(`/api/posts/${id}/comments/${commentId}/replies/${replyId}/react`, {}, { headers: this.headers() })
      .pipe(map((response) => response.post));
  }

  adminUsers(): Observable<AdminUserSummary[]> {
    return this.http.get<{ users: AdminUserSummary[] }>('/api/admin/users', { headers: this.headers() }).pipe(map((response) => response.users));
  }

  adminActivities(query = ''): Observable<UserActivity[]> {
    return this.http
      .get<{ activities: UserActivity[] }>('/api/admin/activities', {
        headers: this.headers(),
        params: query ? { q: query } : {},
      })
      .pipe(map((response) => response.activities));
  }

  private headers(): HttpHeaders {
    return new HttpHeaders(this.auth.authHeaders());
  }
}
