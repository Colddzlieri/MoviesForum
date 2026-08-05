import { Injectable, computed, inject } from '@angular/core';
import { LocalStorageService } from './local-storage.service';

export type AppLanguage = 'en' | 'ka';

type TranslationKey =
  | 'home'
  | 'movies'
  | 'series'
  | 'genres'
  | 'favorites'
  | 'watchlist'
  | 'search'
  | 'login'
  | 'register'
  | 'logout'
  | 'profile'
  | 'settings'
  | 'email'
  | 'password'
  | 'currentPassword'
  | 'newPassword'
  | 'name'
  | 'welcome'
  | 'needLogin'
  | 'writeReview'
  | 'addFavorite'
  | 'removeFavorite'
  | 'addWatchlist'
  | 'removeWatchlist'
  | 'watchTrailer'
  | 'details'
  | 'language'
  | 'saveChanges'
  | 'account'
  | 'preferences'
  | 'security'
  | 'deleteAccount'
  | 'featured'
  | 'movie'
  | 'tv'
  | 'trendingNow'
  | 'popularMovies'
  | 'topRated'
  | 'newReleases'
  | 'upcoming'
  | 'popularSeries'
  | 'topRatedSeries'
  | 'catalogCopy'
  | 'searchCopy'
  | 'noDescription'
  | 'unknown'
  | 'notListed'
  | 'released'
  | 'runtimeUnavailable'
  | 'episodesTba'
  | 'seasons'
  | 'episodes'
  | 'backToCatalog'
  | 'originalTitle'
  | 'trailerUnavailable'
  | 'cast'
  | 'country'
  | 'status'
  | 'directorCreator'
  | 'creators'
  | 'networks'
  | 'similarMovies'
  | 'profileCopy'
  | 'localProfile'
  | 'profileUpdated'
  | 'profilePhoto'
  | 'avatar'
  | 'avatarHelp'
  | 'uploadPhoto'
  | 'removePhoto'
  | 'avatarUpdated'
  | 'avatarRemoved'
  | 'avatarTypeError'
  | 'avatarSizeError'
  | 'avatarReadError'
  | 'passwordUpdated'
  | 'passwordHelp'
  | 'deleteHelp';

const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  en: {
    home: 'Home',
    movies: 'Movies',
    series: 'Series',
    genres: 'Genres',
    favorites: 'Favorites',
    watchlist: 'Watchlist',
    search: 'Search',
    login: 'Log in',
    register: 'Register',
    logout: 'Log out',
    profile: 'Profile',
    settings: 'Settings',
    email: 'Email',
    password: 'Password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    name: 'Name',
    welcome: 'Welcome',
    needLogin: 'Log in to use favorites, watchlist and reviews.',
    writeReview: 'Write a review',
    addFavorite: 'Add to Favorites',
    removeFavorite: 'Remove Favorite',
    addWatchlist: 'Add to Watchlist',
    removeWatchlist: 'Remove Watchlist',
    watchTrailer: 'Watch Trailer',
    details: 'Details',
    language: 'Language',
    saveChanges: 'Save Changes',
    account: 'Account',
    preferences: 'Preferences',
    security: 'Security',
    deleteAccount: 'Delete Account',
    featured: 'Featured',
    movie: 'Movie',
    tv: 'Series',
    trendingNow: 'Trending Now',
    popularMovies: 'Popular Movies',
    topRated: 'Top Rated',
    newReleases: 'New Releases',
    upcoming: 'Upcoming',
    popularSeries: 'Popular Series',
    topRatedSeries: 'Top Rated Series',
    catalogCopy: 'Explore movies and series by mood, genre and rating in one polished cinema space.',
    searchCopy: 'Find movies and series from TMDB with debounced live results.',
    noDescription: 'No description is available for this title yet.',
    unknown: 'Unknown',
    notListed: 'Not listed',
    released: 'Released',
    runtimeUnavailable: 'Runtime unavailable',
    episodesTba: 'episodes TBA',
    seasons: 'seasons',
    episodes: 'episodes',
    backToCatalog: 'Back to catalog',
    originalTitle: 'Original title',
    trailerUnavailable: 'Trailer is not available.',
    cast: 'Cast',
    country: 'Country',
    status: 'Status',
    directorCreator: 'Director / Creator',
    creators: 'Creators',
    networks: 'Networks',
    similarMovies: 'Similar Movies',
    profileCopy: 'Manage your ColdMovie account, language and local profile preferences.',
    localProfile: 'Welcome to your local ColdMovie profile.',
    profileUpdated: 'Profile updated.',
    profilePhoto: 'Profile photo',
    avatar: 'Avatar',
    avatarHelp: 'Upload an image from your computer up to 5 MB. It stays saved in this browser.',
    uploadPhoto: 'Upload from Computer',
    removePhoto: 'Remove Photo',
    avatarUpdated: 'Profile photo updated.',
    avatarRemoved: 'Profile photo removed.',
    avatarTypeError: 'Choose an image file.',
    avatarSizeError: 'Image must be 5 MB or smaller.',
    avatarReadError: 'Could not read this image.',
    passwordUpdated: 'Password updated.',
    passwordHelp: 'Enter the current password and a new password with at least 4 characters.',
    deleteHelp: 'This removes the local account from this browser. Favorites, watchlist and reviews remain stored on this device.',
  },
  ka: {
    home: 'მთავარი',
    movies: 'ფილმები',
    series: 'სერიალები',
    genres: 'ჟანრები',
    favorites: 'ფავორიტები',
    watchlist: 'სანახავი',
    search: 'ძიება',
    login: 'შესვლა',
    register: 'რეგისტრაცია',
    logout: 'გასვლა',
    profile: 'პროფილი',
    settings: 'პარამეტრები',
    email: 'ელფოსტა',
    password: 'პაროლი',
    currentPassword: 'მიმდინარე პაროლი',
    newPassword: 'ახალი პაროლი',
    name: 'სახელი',
    welcome: 'მოგესალმები',
    needLogin: 'ფავორიტებისთვის, სანახავი სიისთვის და კომენტარებისთვის გაიარე ავტორიზაცია.',
    writeReview: 'კომენტარის დაწერა',
    addFavorite: 'ფავორიტებში დამატება',
    removeFavorite: 'ფავორიტებიდან წაშლა',
    addWatchlist: 'სანახავ სიაში დამატება',
    removeWatchlist: 'სანახავი სიიდან წაშლა',
    watchTrailer: 'ტრეილერი',
    details: 'დეტალები',
    language: 'ენა',
    saveChanges: 'შენახვა',
    account: 'ანგარიში',
    preferences: 'პარამეტრები',
    security: 'უსაფრთხოება',
    deleteAccount: 'ანგარიშის წაშლა',
    featured: 'რჩეული',
    movie: 'ფილმი',
    tv: 'სერიალი',
    trendingNow: 'ახლა პოპულარული',
    popularMovies: 'პოპულარული ფილმები',
    topRated: 'ყველაზე მაღალი შეფასება',
    newReleases: 'ახალი რელიზები',
    upcoming: 'მალე გამოვა',
    popularSeries: 'პოპულარული სერიალები',
    topRatedSeries: 'საუკეთესო სერიალები',
    catalogCopy: 'აღმოაჩინე ფილმები და სერიალები განწყობის, ჟანრისა და რეიტინგის მიხედვით.',
    searchCopy: 'იპოვე ფილმები და სერიალები TMDB-დან სწრაფი ძიებით.',
    noDescription: 'ამ სათაურისთვის აღწერა ჯერ არ არის ხელმისაწვდომი.',
    unknown: 'უცნობია',
    notListed: 'მითითებული არ არის',
    released: 'გამოშვებულია',
    runtimeUnavailable: 'ხანგრძლივობა მიუწვდომელია',
    episodesTba: 'ეპიზოდები მოგვიანებით',
    seasons: 'სეზონი',
    episodes: 'ეპიზოდი',
    backToCatalog: 'კატალოგში დაბრუნება',
    originalTitle: 'ორიგინალი სათაური',
    trailerUnavailable: 'ტრეილერი ხელმისაწვდომი არ არის.',
    cast: 'მსახიობები',
    country: 'ქვეყანა',
    status: 'სტატუსი',
    directorCreator: 'რეჟისორი / შემქმნელი',
    creators: 'შემქმნელები',
    networks: 'ქსელები',
    similarMovies: 'მსგავსი სათაურები',
    profileCopy: 'მართე შენი ColdMovie ანგარიში, ენა და ადგილობრივი პროფილის პარამეტრები.',
    localProfile: 'მოგესალმები შენს ადგილობრივ ColdMovie პროფილში.',
    profileUpdated: 'პროფილი განახლდა.',
    profilePhoto: 'პროფილის ფოტო',
    avatar: 'ავატარი',
    avatarHelp: 'ატვირთე ფოტო კომპიუტერიდან მაქსიმუმ 5 MB-მდე. ფოტო ამ ბრაუზერში შეინახება.',
    uploadPhoto: 'კომპიუტერიდან ატვირთვა',
    removePhoto: 'ფოტოს წაშლა',
    avatarUpdated: 'პროფილის ფოტო განახლდა.',
    avatarRemoved: 'პროფილის ფოტო წაიშალა.',
    avatarTypeError: 'აირჩიე სურათის ფაილი.',
    avatarSizeError: 'სურათი უნდა იყოს 5 MB ან ნაკლები.',
    avatarReadError: 'ამ სურათის წაკითხვა ვერ მოხერხდა.',
    passwordUpdated: 'პაროლი განახლდა.',
    passwordHelp: 'შეიყვანე მიმდინარე პაროლი და ახალი პაროლი მინიმუმ 4 სიმბოლოთი.',
    deleteHelp: 'ეს წაშლის ადგილობრივ ანგარიშს ამ ბრაუზერიდან. ფავორიტები, სანახავი სია და კომენტარები ამ მოწყობილობაზე დარჩება.',
  },
};

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly storage = inject(LocalStorageService);
  private readonly languageStore = this.storage.createSignal<AppLanguage>('ColdMovie:language', 'ka');
  readonly language = computed<AppLanguage>(() => 'ka');
  readonly label = computed(() => this.language().toUpperCase());
  readonly tmdbLanguage = computed(() => 'ka-GE');

  constructor() {
    this.languageStore.set('ka');
    this.applyDocumentLanguage('ka');
  }

  setLanguage(_language: AppLanguage, _reload = true): void {
    this.languageStore.set('ka');
    this.applyDocumentLanguage('ka');
  }

  toggle(): void {
    this.setLanguage('ka', false);
  }

  t(key: TranslationKey): string {
    return translations[this.language()][key];
  }

  private applyDocumentLanguage(language: AppLanguage): void {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }
}
