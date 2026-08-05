import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable, catchError, map, of, shareReplay, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CastMember, Genre, MediaDetails, MediaItem, MediaType, PagedMediaResult, SeasonInfo } from '../models/media.models';
import { TmdbGenreResponse, TmdbMediaDetails, TmdbMediaItem, TmdbPaginatedResponse, TmdbPersonSearchResult, TmdbVideo } from '../models/tmdb.models';
import { LanguageService } from './language.service';

@Injectable({ providedIn: 'root' })
export class TmdbApiService {
  private readonly baseUrl = environment.useTmdbProxy ? environment.tmdbProxyUrl : environment.tmdbApiUrl;
  private readonly imageUrl = environment.tmdbImageUrl;
  private readonly placeholderPoster =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22500%22 height=%22750%22 viewBox=%220 0 500 750%22%3E%3Crect width=%22500%22 height=%22750%22 fill=%22%23141416%22/%3E%3Cpath d=%22M96 130h308v430H96z%22 fill=%22%23232327%22/%3E%3Ccircle cx=%22250%22 cy=%22316%22 r=%2274%22 fill=%22%231877f2%22 opacity=%22.78%22/%3E%3Cpath d=%22M232 276v82l72-41z%22 fill=%22%23fff%22/%3E%3Ctext x=%22250%22 y=%22660%22 text-anchor=%22middle%22 fill=%22%23bfc0c8%22 font-family=%22Arial%22 font-size=%2230%22%3EColdMovie%3C/text%3E%3C/svg%3E';
  private readonly placeholderBackdrop =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221600%22 height=%22900%22 viewBox=%220 0 1600 900%22%3E%3Crect width=%221600%22 height=%22900%22 fill=%22%230b0b0d%22/%3E%3Cpath d=%22M0 650 C420 500 760 760 1600 530 V900 H0z%22 fill=%22%231d1d22%22/%3E%3Ccircle cx=%221180%22 cy=%22310%22 r=%22120%22 fill=%22%231877f2%22 opacity=%22.45%22/%3E%3Ctext x=%2280%22 y=%22755%22 fill=%22%23f6f6f6%22 font-family=%22Arial%22 font-size=%2264%22 font-weight=%22700%22%3EColdMovie%3C/text%3E%3C/svg%3E';
  private readonly placeholderProfile =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22185%22 height=%22278%22 viewBox=%220 0 185 278%22%3E%3Crect width=%22185%22 height=%22278%22 fill=%22%23202024%22/%3E%3Ccircle cx=%2292%22 cy=%2295%22 r=%2242%22 fill=%22%23636670%22/%3E%3Cpath d=%22M30 232c8-50 116-50 124 0%22 fill=%22%23636670%22/%3E%3C/svg%3E';
  private readonly cache = new Map<string, Observable<unknown>>();
  private readonly genreNames = new Map<number, string>([
    [12, 'adventure journey quest exploration treasure island wilderness expedition rescue discovery'],
    [14, 'fantasy magic myth kingdom dragon wizard curse prophecy supernatural mythical creatures'],
    [16, 'animation anime cartoon family coming of age imagination children adventure'],
    [18, 'drama emotional life family tragedy relationship conflict grief redemption character study'],
    [27, 'horror scary ghost demon monster haunted occult possession nightmare killer supernatural'],
    [28, 'action fight battle chase hero revenge mission explosion rescue martial arts'],
    [35, 'comedy funny humor laugh friends awkward satire parody workplace family'],
    [36, 'history historical biography king queen war politics period true story'],
    [37, 'western cowboy frontier sheriff outlaw revenge desert justice'],
    [53, 'thriller suspense survival danger tense conspiracy psychological stalker escape hostage'],
    [80, 'crime mafia detective heist investigation murder killer police criminal gang'],
    [99, 'documentary real life nature history biography investigation social issue'],
    [878, 'science fiction sci-fi space future robot alien technology time travel time loop repeating day apocalypse experiment'],
    [9648, 'mystery secret puzzle investigation twist disappearance hidden truth detective strange events'],
    [10402, 'music musician concert band singer performance fame'],
    [10749, 'romance love relationship couple wedding heartbreak passion emotional'],
    [10751, 'family kids parent child sibling brothers sisters home friendship'],
    [10752, 'war soldier army battlefield military occupation resistance survival politics'],
    [10770, 'tv movie'],
    [10759, 'action adventure journey chase hero mission fight rescue quest'],
    [10762, 'kids children family'],
    [10763, 'news current events'],
    [10764, 'reality competition real life'],
    [10765, 'sci-fi fantasy supernatural paranormal magic ghost demon monster alien time travel powers'],
    [10766, 'soap drama relationship family'],
    [10767, 'talk interview conversation'],
    [10768, 'war politics military government conflict power conspiracy resistance'],
  ]);

  constructor(
    private readonly http: HttpClient,
    private readonly sanitizer: DomSanitizer,
    private readonly lang: LanguageService,
  ) {}

  list(path: string, mediaType: MediaType, page = 1): Observable<PagedMediaResult> {
    return this.getPaged(path, mediaType, { page });
  }

  trending(mediaType: MediaType): Observable<PagedMediaResult> {
    return this.getPaged(`/trending/${mediaType}/week`, mediaType, { page: 1 });
  }

  discover(mediaType: MediaType, params: Record<string, string | number | null>): Observable<PagedMediaResult> {
    return this.getPaged(`/discover/${mediaType}`, mediaType, {
      include_adult: 'false',
      vote_count: 100,
      ...params,
    });
  }

  searchKeywords(query: string): Observable<number[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return of([]);
    }

    return this.get<TmdbPaginatedResponse<{ id: number; name: string }>>('/search/keyword', {
      query: trimmed,
      page: 1,
    }).pipe(
      map((response) => response.results.map((keyword) => keyword.id).slice(0, 8)),
      catchError(() => of([])),
    );
  }

  search(query: string, page = 1): Observable<PagedMediaResult> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return of({ page: 1, totalPages: 1, totalResults: 0, results: [] });
    }

    return this.get<TmdbPaginatedResponse<TmdbMediaItem>>('/search/multi', {
      query: trimmed,
      page,
      include_adult: 'false',
    }).pipe(
      map((response) => this.mapPaged(response, 'movie', true)),
      catchError((error) => this.handleError(error)),
    );
  }

  searchByType(mediaType: MediaType, query: string, page = 1): Observable<PagedMediaResult> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return of({ page: 1, totalPages: 1, totalResults: 0, results: [] });
    }

    return this.get<TmdbPaginatedResponse<TmdbMediaItem>>(`/search/${mediaType}`, {
      query: trimmed,
      page,
      include_adult: 'false',
    }).pipe(
      map((response) => this.mapPaged(response, mediaType)),
      catchError((error) => this.handleError(error)),
    );
  }

  searchPersonKnownFor(query: string): Observable<PagedMediaResult> {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      return of({ page: 1, totalPages: 1, totalResults: 0, results: [] });
    }

    return this.get<TmdbPaginatedResponse<TmdbPersonSearchResult>>('/search/person', {
      query: trimmed,
      page: 1,
      include_adult: 'false',
    }).pipe(
      map((response) => {
        const results = response.results
          .slice(0, 5)
          .flatMap((person) => person.known_for ?? [])
          .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
          .map((item) => this.mapTmdbMediaItem(item, 'movie'));
        const merged = new Map<string, MediaItem>();
        results.forEach((item) => merged.set(`${item.mediaType}-${item.id}`, item));
        return { page: 1, totalPages: 1, totalResults: merged.size, results: [...merged.values()] };
      }),
      catchError(() => of({ page: 1, totalPages: 1, totalResults: 0, results: [] })),
    );
  }

  details(mediaType: MediaType, id: number): Observable<MediaDetails> {
    const append = mediaType === 'movie'
      ? 'credits,videos,recommendations,release_dates,keywords,alternative_titles,translations'
      : 'credits,videos,recommendations,content_ratings,keywords,alternative_titles,translations';
    return this.get<TmdbMediaDetails>(`/${mediaType}/${id}`, { append_to_response: append }).pipe(
      map((response) => this.mapDetails(response, mediaType)),
      catchError((error) => this.handleError(error)),
    );
  }

  genres(): Observable<Genre[]> {
    return this.cached('genres:movie', () =>
      this.http.get<TmdbGenreResponse>(`${this.baseUrl}/genre/movie/list`, { params: this.params({}) }).pipe(
        map((response) => response.genres.map((genre) => ({ ...genre, mediaType: 'movie' as const }))),
        catchError((error) => this.handleError(error)),
      ),
    ) as Observable<Genre[]>;
  }

  tvGenres(): Observable<Genre[]> {
    return this.cached('genres:tv', () =>
      this.http.get<TmdbGenreResponse>(`${this.baseUrl}/genre/tv/list`, { params: this.params({}) }).pipe(
        map((response) => response.genres.map((genre) => ({ ...genre, mediaType: 'tv' as const }))),
        catchError((error) => this.handleError(error)),
      ),
    ) as Observable<Genre[]>;
  }

  getPosterUrl(path: string | null): string {
    return path ? `${this.imageUrl}/w500${path}` : this.placeholderPoster;
  }

  getBackdropUrl(path: string | null): string {
    return path ? `${this.imageUrl}/original${path}` : this.placeholderBackdrop;
  }

  getProfileUrl(path: string | null): string {
    return path ? `${this.imageUrl}/w185${path}` : this.placeholderProfile;
  }

  getYoutubeEmbedUrl(videoKey: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${videoKey}`);
  }

  mapTmdbMediaItem(item: TmdbMediaItem, fallbackType: MediaType = 'movie', genreMap = new Map<number, string>()): MediaItem {
    const mediaType = item.media_type === 'tv' || item.media_type === 'movie' ? item.media_type : fallbackType;
    const releaseDate = mediaType === 'movie' ? item.release_date ?? null : item.first_air_date ?? null;
    const genreIds = item.genre_ids ?? item.genres?.map((genre) => genre.id) ?? [];
    const description = item.overview || this.lang.t('noDescription');
    const title = mediaType === 'movie' ? item.title ?? this.lang.t('movie') : item.name ?? this.lang.t('tv');
    const originalTitle = mediaType === 'movie' ? item.original_title ?? item.title ?? this.lang.t('movie') : item.original_name ?? item.name ?? this.lang.t('tv');
    const baseText = [
      title,
      originalTitle,
      description,
      genreIds.map((id) => this.genreNames.get(id)).filter(Boolean).join(' '),
      mediaType,
      item.original_language,
      releaseDate?.slice(0, 4) ?? '',
    ].join(' ');
    const hiddenPlot = [baseText, this.storySignalsFromText(baseText), mediaType === 'tv' ? 'series show television episodes seasons' : 'movie film cinema']
      .join(' ')
      .replace(/\s+/g, ' ')
      .toLowerCase();

    return {
      id: item.id,
      mediaType,
      title,
      originalTitle,
      description,
      shortDescription: description.length > 160 ? `${description.slice(0, 157)}...` : description,
      hiddenPlot,
      posterUrl: this.getPosterUrl(item.poster_path),
      backdropUrl: this.getBackdropUrl(item.backdrop_path),
      releaseDate,
      releaseYear: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
      rating: Math.round(item.vote_average * 10) / 10,
      voteCount: item.vote_count,
      popularity: item.popularity,
      genreIds,
      genres: genreIds.map((id) => genreMap.get(id)).filter((name): name is string => Boolean(name)),
      originalLanguage: item.original_language,
    };
  }

  private getPaged(path: string, mediaType: MediaType, params: Record<string, string | number | null>): Observable<PagedMediaResult> {
    return this.get<TmdbPaginatedResponse<TmdbMediaItem>>(path, params).pipe(
      map((response) => this.mapPaged(response, mediaType)),
      catchError((error) => this.handleError(error)),
    );
  }

  private mapPaged(response: TmdbPaginatedResponse<TmdbMediaItem>, fallbackType: MediaType, keepMixed = false): PagedMediaResult {
    const results = response.results
      .filter((item) => !item.adult)
      .filter((item) => (keepMixed ? item.media_type === 'movie' || item.media_type === 'tv' : true))
      .map((item) => this.mapTmdbMediaItem(item, fallbackType));

    return {
      page: response.page,
      totalPages: response.total_pages,
      totalResults: response.total_results,
      results,
    };
  }

  private mapDetails(item: TmdbMediaDetails, mediaType: MediaType): MediaDetails {
    const base = this.mapTmdbMediaItem(item, mediaType);
    const trailerKey = this.pickTrailer(item.videos.results)?.key ?? null;
    const director = item.credits.crew.find((member) => member.job === 'Director')?.name ?? item.created_by?.[0]?.name ?? this.lang.t('unknown');
    const cast: CastMember[] = item.credits.cast.slice(0, 12).map((member) => ({
      id: member.id,
      name: member.name,
      character: member.character,
      imageUrl: this.getProfileUrl(member.profile_path),
    }));
    const seasons: SeasonInfo[] | undefined = item.seasons?.map((season) => ({
      id: season.id,
      name: season.name,
      episodeCount: season.episode_count,
      posterUrl: this.getPosterUrl(season.poster_path),
    }));
    const recommendations = item.recommendations.results
      .filter((recommendation) => recommendation.id !== item.id)
      .map((recommendation) => this.mapTmdbMediaItem(recommendation, mediaType));
    const keywords = item.keywords?.keywords ?? item.keywords?.results ?? [];
    const detailedHiddenPlot = this.buildDetailedHiddenPlot(base, item, mediaType, director, cast, keywords.map((keyword) => keyword.name));

    return {
      ...base,
      hiddenPlot: detailedHiddenPlot,
      duration: this.formatDuration(mediaType === 'movie' ? item.runtime ?? null : item.episode_run_time?.[0] ?? null, mediaType, item),
      ageRating: this.extractAgeRating(item, mediaType),
      director,
      cast,
      country: item.production_countries?.map((country) => country.name).join(', ') || item.origin_country?.join(', ') || this.lang.t('unknown'),
      language: item.spoken_languages?.map((language) => language.english_name).join(', ') || item.original_language.toUpperCase(),
      trailerKey,
      trailerUrl: trailerKey ? this.getYoutubeEmbedUrl(trailerKey) : null,
      recommendations,
      seasons,
      status: item.status,
      networks: item.networks?.map((network) => network.name),
      creators: item.created_by?.map((creator) => creator.name),
    };
  }

  private buildDetailedHiddenPlot(
    base: MediaItem,
    item: TmdbMediaDetails,
    mediaType: MediaType,
    director: string,
    cast: CastMember[],
    keywords: string[],
  ): string {
    const peopleText = [
      director,
      ...(item.created_by?.map((creator) => creator.name) ?? []),
      ...cast.flatMap((member) => [member.name, member.character]),
    ].join(' ');
    const characterAliasText = cast
      .slice(0, 8)
      .flatMap((member) => [
        member.name,
        member.name,
        member.character,
        member.character,
        member.character ? `character ${member.character}` : '',
        member.name && member.character ? `${member.name} plays ${member.character}` : '',
        member.name && member.character ? `${member.character} played by ${member.name}` : '',
      ])
      .join(' ');
    const productionText = [
      item.status,
      ...(item.networks?.map((network) => network.name) ?? []),
      ...(item.origin_country ?? []),
      ...(item.production_countries?.map((country) => country.name) ?? []),
      ...(item.spoken_languages?.map((language) => language.english_name) ?? []),
    ].join(' ');
    const seasonText = [
      item.number_of_seasons ? `${item.number_of_seasons} seasons long running television series` : '',
      item.number_of_episodes ? `${item.number_of_episodes} episodes episodic story character arcs` : '',
      ...(item.seasons?.map((season) => `${season.name} ${season.episode_count} episodes`) ?? []),
    ].join(' ');
    const keywordText = keywords.join(' ');
    const alternativeTitleText = [
      ...(item.alternative_titles?.titles?.map((title) => `${title.title} ${title.type ?? ''}`) ?? []),
      ...(item.alternative_titles?.results?.map((title) => `${title.title} ${title.type ?? ''}`) ?? []),
    ].join(' ');
    const translationText = (item.translations?.translations ?? [])
      .slice(0, 18)
      .flatMap((translation) => [
        translation.name,
        translation.english_name,
        translation.data?.title,
        translation.data?.name,
        translation.data?.tagline,
        translation.data?.overview,
      ])
      .filter(Boolean)
      .join(' ');
    const recommendationText = item.recommendations.results
      .slice(0, 12)
      .map((recommendation) => `${recommendation.title ?? recommendation.name ?? ''} ${recommendation.overview ?? ''}`)
      .join(' ');

    return [
      base.hiddenPlot,
      base.title,
      base.originalTitle,
      base.description,
      item.tagline ?? '',
      base.genres.join(' '),
      keywordText,
      alternativeTitleText,
      translationText,
      peopleText,
      characterAliasText,
      productionText,
      seasonText,
      recommendationText,
      this.storySignalsFromText(`${base.title} ${base.originalTitle} ${base.description} ${base.genres.join(' ')} ${keywordText}`),
      mediaType === 'tv' ? 'series show television episodes seasons character arcs continuing story' : 'movie film feature cinema single story',
    ]
      .join(' ')
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  private storySignalsFromText(value: string): string {
    const text = value.toLowerCase();
    const signals: string[] = [];

    if (/supernatural|paranormal|ghost|spirit|demon|haunted|monster|occult/.test(text)) {
      signals.push('supernatural paranormal ghosts spirits demons monsters haunted occult horror mystery');
    }
    if (/brother|sister|sibling|family|father|mother/.test(text)) {
      signals.push('family siblings brothers sisters parents family bond');
    }
    if (/hunt|hunter|chase|track|investigat|case|detective/.test(text)) {
      signals.push('hunt hunters chasing tracking investigation cases detective search');
    }
    if (/space|mars|astronaut|planet|alien|galaxy/.test(text)) {
      signals.push('space astronaut planet alien galaxy survival mission');
    }
    if (/murder|killer|crime|mafia|heist/.test(text)) {
      signals.push('crime murder killer investigation criminal danger');
    }
    if (/love|romance|relationship|wedding/.test(text)) {
      signals.push('love romance relationship couple emotional');
    }
    if (/war|soldier|army|military|battlefield|resistance|occupation/.test(text)) {
      signals.push('war soldiers army battlefield military resistance occupation survival politics');
    }
    if (/robot|android|artificial intelligence|technology|future|experiment|time travel/.test(text)) {
      signals.push('robot android artificial intelligence technology future experiment time travel science fiction');
    }
    if (/time loop|temporal loop|same day|repeating day|over and over|again and again|reliv|stuck in time|deja vu|groundhog/.test(text)) {
      signals.push('time loop temporal loop repeating same day reliving same day stuck in time again and again deja vu');
    }
    if (/magic|kingdom|dragon|wizard|curse|prophecy|myth/.test(text)) {
      signals.push('magic kingdom dragon wizard curse prophecy myth fantasy quest');
    }
    if (/friend|friends|school|teen|coming of age/.test(text)) {
      signals.push('friends school teen coming of age friendship youth');
    }
    if (/revenge|vengeance|betrayal|justice/.test(text)) {
      signals.push('revenge vengeance betrayal justice conflict');
    }
    if (/amnesia|memory loss|forgotten past|lost memory/.test(text)) {
      signals.push('amnesia memory loss forgotten past identity mystery');
    }
    if (/body swap|switched bodies|identity swap/.test(text)) {
      signals.push('body swap switched bodies identity swap comedy fantasy');
    }
    if (/multiverse|parallel universe|alternate reality|dimension/.test(text)) {
      signals.push('multiverse parallel universe alternate reality other dimension');
    }
    if (/apocalypse|post-apocalyptic|post apocalyptic|end of the world|collapse/.test(text)) {
      signals.push('apocalypse post apocalyptic end of world collapse last survivors');
    }
    if (/zombie|undead|infection|outbreak|virus/.test(text)) {
      signals.push('zombie undead infection outbreak virus apocalypse survival');
    }
    if (/heist|robbery|thieves|bank robbery|steal/.test(text)) {
      signals.push('heist robbery thieves crew plan bank robbery steal');
    }
    if (/prison|jail|wrongly imprisoned|escape from prison/.test(text)) {
      signals.push('prison escape jail break wrongly imprisoned fugitive');
    }
    if (/spy|agent|undercover|secret mission|intelligence/.test(text)) {
      signals.push('spy agent undercover secret mission intelligence agency');
    }
    if (/assassin|hitman|contract killer/.test(text)) {
      signals.push('assassin hitman contract killer professional killer');
    }
    if (/mafia|gangster|cartel|organized crime|crime family/.test(text)) {
      signals.push('mafia gangster cartel organized crime crime family');
    }
    if (/court|lawyer|trial|judge|legal/.test(text)) {
      signals.push('courtroom lawyer trial judge legal drama wrong accusation');
    }
    if (/sport|coach|team|championship|competition|underdog/.test(text)) {
      signals.push('sports team coach championship competition underdog');
    }
    if (/music|singer|band|concert|musician|fame/.test(text)) {
      signals.push('music singer band concert musician fame performance');
    }
    if (/dance|dancer|ballet/.test(text)) {
      signals.push('dance dancer ballet dance competition performance');
    }
    if (/chef|restaurant|cooking|kitchen|food/.test(text)) {
      signals.push('chef restaurant cooking kitchen food');
    }
    if (/rat|mouse|animal|remy|gusteau|linguini/.test(text)) {
      signals.push('rat mouse animal secret talent unlikely hero hidden identity');
    }
    if ((/rat|mouse|animal|remy/.test(text) && /chef|restaurant|cooking|kitchen|food|gusteau|linguini/.test(text)) || /ratatouille/.test(text)) {
      signals.push('rat chef cooking restaurant kitchen paris animation family food dream mentor secret talent');
    }
    if (/school|teen|student|college|coming of age/.test(text)) {
      signals.push('school teen student high school college coming of age');
    }
    if (/road trip|cross-country|cross country|journey by car/.test(text)) {
      signals.push('road trip travel together cross country journey');
    }
    if (/pirate|ship|treasure map|captain|sea adventure/.test(text)) {
      signals.push('pirate ship treasure map captain sea adventure');
    }
    if (/vampire|blood|immortal/.test(text)) {
      signals.push('vampire blood immortal night creature supernatural');
    }
    if (/werewolf|full moon|wolf/.test(text)) {
      signals.push('werewolf wolf transformation full moon curse');
    }
    if (/witch|witchcraft|spell|coven/.test(text)) {
      signals.push('witch witchcraft spell coven dark magic');
    }
    if (/disaster|earthquake|storm|tsunami|volcano|catastrophe/.test(text)) {
      signals.push('disaster catastrophe earthquake storm tsunami volcano survival');
    }
    if (/plane crash|crash landing|airplane|pilot/.test(text)) {
      signals.push('plane crash crash landing airplane pilot survival');
    }
    if (/kidnap|abduct|missing child|ransom/.test(text)) {
      signals.push('kidnapping abduction missing child ransom rescue');
    }
    if (/dystopia|dictatorship|oppressive|rebellion/.test(text)) {
      signals.push('dystopia dictatorship oppressive society rebellion controlled world');
    }
    if (/king|queen|prince|princess|palace|throne|royal/.test(text)) {
      signals.push('royal king queen prince princess palace throne');
    }
    if (/politic|president|government|election|power struggle/.test(text)) {
      signals.push('political president government election power struggle conspiracy');
    }
    if (/doctor|hospital|patient|surgery|medical/.test(text)) {
      signals.push('medical doctor hospital patient surgery disease');
    }
    if (/deadly game|tournament|players|competition to survive/.test(text)) {
      signals.push('deadly game tournament players competition survival');
    }
    if (/hacker|cyber|computer|virtual reality|internet/.test(text)) {
      signals.push('hacker cybercrime computer virtual reality internet technology');
    }
    if (/western|cowboy|sheriff|outlaw|frontier/.test(text)) {
      signals.push('western cowboy sheriff outlaw frontier');
    }
    if (/true story|based on real|biography|real events/.test(text)) {
      signals.push('true story biography based on real events real person');
    }

    return signals.join(' ');
  }

  private formatDuration(runtime: number | null, mediaType: MediaType, item: TmdbMediaDetails): string {
    if (mediaType === 'tv') {
      const episodes = item.number_of_episodes ? `${item.number_of_episodes} ${this.lang.t('episodes')}` : this.lang.t('episodesTba');
      return item.number_of_seasons ? `${item.number_of_seasons} ${this.lang.t('seasons')}, ${episodes}` : episodes;
    }

    if (!runtime) {
      return this.lang.t('runtimeUnavailable');
    }

    return `${Math.floor(runtime / 60)}h ${runtime % 60}m`;
  }

  private extractAgeRating(item: TmdbMediaDetails, mediaType: MediaType): string {
    if (mediaType === 'movie') {
      const us = item.release_dates?.results.find((rating) => rating.iso_3166_1 === 'US');
      return us?.release_dates.find((date) => date.certification)?.certification || 'NR';
    }

    const us = item.content_ratings?.results.find((rating) => rating.iso_3166_1 === 'US');
    return us?.rating || 'NR';
  }

  private pickTrailer(videos: TmdbVideo[]): TmdbVideo | null {
    return (
      videos.find((video) => video.site === 'YouTube' && video.type === 'Trailer' && video.official) ??
      videos.find((video) => video.site === 'YouTube' && video.type === 'Trailer') ??
      videos.find((video) => video.site === 'YouTube' && video.type === 'Teaser') ??
      null
    );
  }

  private get<T>(path: string, rawParams: Record<string, string | number | null | undefined> = {}): Observable<T> {
    const key = `${this.lang.tmdbLanguage()}:${path}:${JSON.stringify(rawParams)}`;
    return this.cached(key, () => this.http.get<T>(`${this.baseUrl}${path}`, { params: this.params(rawParams) })) as Observable<T>;
  }

  private params(rawParams: Record<string, string | number | null | undefined>): HttpParams {
    let params = new HttpParams().set('language', this.lang.tmdbLanguage());
    Object.entries(rawParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return params;
  }

  private cached<T>(key: string, factory: () => Observable<T>): Observable<T> {
    const cached = this.cache.get(key);
    if (cached) {
      return cached as Observable<T>;
    }

    const request$ = factory().pipe(shareReplay({ bufferSize: 1, refCount: true }));
    this.cache.set(key, request$);
    return request$;
  }

  private handleError(error: unknown): Observable<never> {
    let message = 'The movie catalog is temporarily unavailable. Please try again.';
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        message = 'TMDB authentication failed. Add a valid Read Access Token in the environment file.';
      } else if (error.status === 404) {
        message = 'Media not found.';
      } else if (error.status === 429) {
        message = 'TMDB is rate limiting requests right now. Please retry in a moment.';
      }
    }

    return throwError(() => new Error(message));
  }
}
