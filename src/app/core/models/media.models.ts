import { SafeResourceUrl } from '@angular/platform-browser';

export type MediaType = 'movie' | 'tv';
export type WatchStatus = 'Plan to Watch' | 'Watching' | 'Completed';
export type SortOption = 'popularity' | 'rating' | 'newest' | 'oldest' | 'titleAsc' | 'titleDesc';

export interface Genre {
  id: number;
  name: string;
  mediaType?: MediaType;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  imageUrl: string;
}

export interface MediaItem {
  id: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string;
  description: string;
  shortDescription: string;
  hiddenPlot: string;
  matchPercent?: number;
  posterUrl: string;
  backdropUrl: string;
  releaseDate: string | null;
  releaseYear: number | null;
  rating: number;
  voteCount: number;
  popularity: number;
  genreIds: number[];
  genres: string[];
  originalLanguage: string;
}

export interface MediaDetails extends MediaItem {
  duration: string;
  ageRating: string;
  director: string;
  cast: CastMember[];
  country: string;
  language: string;
  trailerKey: string | null;
  trailerUrl: SafeResourceUrl | null;
  recommendations: MediaItem[];
  seasons?: SeasonInfo[];
  status?: string;
  networks?: string[];
  creators?: string[];
}

export interface SeasonInfo {
  id: number;
  name: string;
  episodeCount: number;
  posterUrl: string;
}

export interface SavedMediaItem {
  id: number;
  mediaType: MediaType;
  title: string;
  posterUrl: string;
  releaseYear: number | null;
  rating: number;
}

export interface WatchlistItem extends SavedMediaItem {
  status: WatchStatus;
}

export interface Review {
  id: string;
  mediaKey: string;
  userId?: string;
  name: string;
  avatarUrl?: string;
  rating: number;
  text: string;
  createdAt: string;
  reactionCount?: number;
  reactedByMe?: boolean;
  replies?: ReviewReply[];
}

export interface ReviewReply {
  id: string;
  userId?: string;
  name: string;
  avatarUrl?: string;
  text: string;
  createdAt: string;
  reactionCount?: number;
  reactedByMe?: boolean;
}

export interface DiscoverFilters {
  mediaType: MediaType | 'all';
  query: string;
  genreId: number | null;
  releaseYear: number | null;
  minRating: number | null;
  sortBy: SortOption;
}

export interface PagedMediaResult {
  page: number;
  totalPages: number;
  totalResults: number;
  results: MediaItem[];
}
