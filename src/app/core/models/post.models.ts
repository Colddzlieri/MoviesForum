import { SavedMediaItem } from './media.models';

export interface PostAuthor {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  bannerUrl?: string;
}

export interface PostComment {
  id: string;
  text: string;
  author: PostAuthor;
  createdAt: string;
  reactionCount?: number;
  reactedByMe?: boolean;
  replies?: PostCommentReply[];
}

export interface PostCommentReply {
  id: string;
  text: string;
  author: PostAuthor;
  createdAt: string;
  reactionCount?: number;
  reactedByMe?: boolean;
}

export interface MoviePost {
  id: string;
  title: string;
  content: string;
  photoUrl?: string;
  photoName?: string;
  mediaItems: SavedMediaItem[];
  author: PostAuthor;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  comments: PostComment[];
}

export interface PostPayload {
  title: string;
  content: string;
  photoUrl?: string | null;
  photoName?: string | null;
  mediaItems: SavedMediaItem[];
}

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt?: string;
}

export interface UserActivity {
  id: string;
  user: AdminUserSummary;
  action: string;
  meta: {
    postId?: string;
    postTitle?: string;
    mediaCount?: number;
    commentId?: string;
  };
  createdAt: string;
}

export interface PublicUserStats {
  posts: number;
  favorites: number;
  likes: number;
  comments: number;
}

export interface PublicUserSummary {
  id: string;
  name: string;
  avatarUrl?: string;
  bannerUrl?: string;
  role: string;
  createdAt?: string;
  stats: PublicUserStats;
}

export interface PublicUserProfile {
  user: PublicUserSummary;
  favorites: SavedMediaItem[];
  posts: MoviePost[];
}
