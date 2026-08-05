import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const absoluteUrlPattern = /^[a-z][a-z\d+\-.]*:\/\//i;

export const apiBaseUrlInterceptor: HttpInterceptorFn = (request, next) => {
  const apiBaseUrl = environment.apiBaseUrl.replace(/\/+$/, '');
  const isRelativeApiRequest = request.url.startsWith('/api/');

  if (!apiBaseUrl || !isRelativeApiRequest || absoluteUrlPattern.test(request.url)) {
    return next(request);
  }

  return next(
    request.clone({
      url: `${apiBaseUrl}${request.url}`,
    }),
  );
};
