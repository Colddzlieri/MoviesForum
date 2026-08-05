import { MediaType } from './media.models';

export interface TmdbPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbGenreResponse {
  genres: TmdbGenre[];
}

export interface TmdbMediaItem {
  id: number;
  media_type?: MediaType | 'person';
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids?: number[];
  genres?: TmdbGenre[];
  original_language: string;
  adult?: boolean;
}

export interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official: boolean;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  job: string;
}

export interface TmdbCredits {
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
}

export interface TmdbReleaseDates {
  results: Array<{
    iso_3166_1: string;
    release_dates: Array<{ certification: string }>;
  }>;
}

export interface TmdbContentRatings {
  results: Array<{ iso_3166_1: string; rating: string }>;
}

export interface TmdbSeason {
  id: number;
  name: string;
  episode_count: number;
  poster_path: string | null;
}

export interface TmdbKeyword {
  id: number;
  name: string;
}

export interface TmdbAlternativeTitles {
  titles?: Array<{ iso_3166_1?: string; title: string; type?: string }>;
  results?: Array<{ iso_3166_1?: string; title: string; type?: string }>;
}

export interface TmdbTranslations {
  translations?: Array<{
    iso_3166_1?: string;
    iso_639_1?: string;
    name?: string;
    english_name?: string;
    data?: {
      title?: string;
      name?: string;
      overview?: string;
      tagline?: string;
    };
  }>;
}

export interface TmdbPersonSearchResult {
  id: number;
  name: string;
  known_for?: TmdbMediaItem[];
}

export interface TmdbMediaDetails extends TmdbMediaItem {
  tagline?: string;
  runtime?: number | null;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: TmdbSeason[];
  status?: string;
  first_air_date?: string;
  last_air_date?: string;
  created_by?: Array<{ id: number; name: string }>;
  networks?: Array<{ id: number; name: string }>;
  origin_country?: string[];
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  spoken_languages?: Array<{ english_name: string; iso_639_1: string }>;
  credits: TmdbCredits;
  videos: { results: TmdbVideo[] };
  recommendations: TmdbPaginatedResponse<TmdbMediaItem>;
  keywords?: { keywords?: TmdbKeyword[]; results?: TmdbKeyword[] };
  alternative_titles?: TmdbAlternativeTitles;
  translations?: TmdbTranslations;
  release_dates?: TmdbReleaseDates;
  content_ratings?: TmdbContentRatings;
}
