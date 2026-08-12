import { PostAuthor } from './post.models';

export interface ReelComment {
  id: string;
  text: string;
  author: PostAuthor;
  createdAt: string;
}

export interface Reel {
  id: string;
  caption: string;
  videoUrl: string;
  videoName: string;
  author: PostAuthor;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  comments: ReelComment[];
}

export interface ReelPayload {
  caption: string;
  videoUrl: string;
  videoName: string;
}
