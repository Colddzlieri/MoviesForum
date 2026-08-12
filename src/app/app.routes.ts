import { Routes } from '@angular/router';
import { CatalogPageComponent } from './pages/catalog-page/catalog-page.component';
import { CollectionPageComponent } from './pages/collection-page/collection-page.component';
import { AdminDashboardPageComponent } from './pages/admin-dashboard-page/admin-dashboard-page.component';
import { DetailsPageComponent } from './pages/details-page/details-page.component';
import { HomePageComponent } from './pages/home-page/home-page.component';
import { NotFoundPageComponent } from './pages/not-found-page/not-found-page.component';
import { ProfileSettingsPageComponent } from './pages/profile-settings-page/profile-settings-page.component';
import { ReelsPageComponent } from './pages/reels-page/reels-page.component';
import { SearchPageComponent } from './pages/search-page/search-page.component';
import { UserProfilePageComponent } from './pages/user-profile-page/user-profile-page.component';

export const routes: Routes = [
  { path: '', component: HomePageComponent, title: 'ColdMovie' },
  { path: 'movies', component: CatalogPageComponent, data: { mediaType: 'movie' }, title: 'ფილმები | ColdMovie' },
  { path: 'series', component: CatalogPageComponent, data: { mediaType: 'tv' }, title: 'სერიალები | ColdMovie' },
  { path: 'genre/:genre', component: CatalogPageComponent, title: 'კატალოგი | ColdMovie' },
  { path: 'movie/:id', component: DetailsPageComponent, title: 'დეტალები | ColdMovie' },
  { path: 'favorites', component: CollectionPageComponent, data: { collection: 'favorites' }, title: 'ფავორიტები | ColdMovie' },
  { path: 'watchlist', component: CollectionPageComponent, data: { collection: 'watchlist' }, title: 'სანახავი | ColdMovie' },
  { path: 'reels', component: ReelsPageComponent, title: 'Reels | ColdMovie' },
  { path: 'admin', component: AdminDashboardPageComponent, title: 'ადმინ პანელი | ColdMovie' },
  { path: 'profile', component: ProfileSettingsPageComponent, title: 'პროფილი | ColdMovie' },
  { path: 'users', redirectTo: '', pathMatch: 'full' },
  { path: 'users/:id', component: UserProfilePageComponent, title: 'მომხმარებლის პროფილი | ColdMovie' },
  { path: 'search', component: SearchPageComponent, title: 'ძიება | ColdMovie' },
  { path: '404', component: NotFoundPageComponent, title: 'გვერდი ვერ მოიძებნა | ColdMovie' },
  { path: '**', component: NotFoundPageComponent, title: 'გვერდი ვერ მოიძებნა | ColdMovie' },
];
