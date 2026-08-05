import { MediaType } from '../models/media.models';

export function makeMediaKey(mediaType: MediaType, id: number): string {
  return `${mediaType}-${id}`;
}

export function parseMediaRouteId(value: string | null): { mediaType: MediaType; id: number } | null {
  if (!value) {
    return null;
  }

  const typed = /^(movie|tv)-(\d+)$/.exec(value);
  if (typed) {
    return { mediaType: typed[1] as MediaType, id: Number(typed[2]) };
  }

  const numericId = Number(value);
  return Number.isFinite(numericId) ? { mediaType: 'movie', id: numericId } : null;
}
