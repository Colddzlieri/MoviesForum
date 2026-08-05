import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const tokenPlaceholder = 'YOUR_TMDB_READ_ACCESS_TOKEN';

export const tmdbAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const isTmdbRequest = request.url.startsWith(environment.tmdbApiUrl);
  const shouldAttachToken = isTmdbRequest && !environment.useTmdbProxy && environment.tmdbReadToken !== tokenPlaceholder;

  if (!shouldAttachToken) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${environment.tmdbReadToken}`,
        Accept: 'application/json',
      },
    }),
  );
};
