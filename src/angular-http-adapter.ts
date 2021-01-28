import {
    Observable,
    throwError,
} from 'rxjs';
import {
    catchError,
    map,
} from 'rxjs/operators';
import {
    HttpAdapterInterface,
    HttpHeadersInterface,
    HttpRequestInterface,
    HttpResponseInterface,
    ClientError,
    CORSError,
    HttpError,
    HttpHeaders,
    HttpResponse, HttpRequestOptionsInterface,
} from '@runopencode/http';
import {
    HttpClient as AngularHttpClient,
    HttpErrorResponse as AngularHttpErrorResponse,
    HttpResponse as AngularHttpResponse,
    HttpHeaders as AngularHttpHeaders,
    HttpParams as AngularHttpParams,
} from '@angular/common/http';

export class AngularHttpAdapter implements HttpAdapterInterface {

    private readonly _http: AngularHttpClient;

    public constructor(http: AngularHttpClient) {
        this._http = http;
    }

    public execute<T>(request: HttpRequestInterface, options: HttpRequestOptionsInterface): Observable<HttpResponseInterface<T>> {
        let angularRequestOptions: {
            body?: any;
            headers?: AngularHttpHeaders | {
                [header: string]: string | string[];
            };
            params?: AngularHttpParams | {
                [param: string]: string | string[];
            };
            observe: 'events' | 'response';
            reportProgress?: boolean;
            responseType: 'arraybuffer' | 'text' | 'blob' | 'json';
            withCredentials?: boolean;
        } = {
            observe:      'response',
            responseType: options.responseType,
        };

        if (request.body) {
            angularRequestOptions.body = request.body;
        }

        if (request.headers) {
            angularRequestOptions.headers = AngularHttpAdapter.transform(request.headers);
        }

        return this
            ._http
            .request(request.method, request.url, angularRequestOptions)
            .pipe(catchError((error: AngularHttpErrorResponse) => throwError(AngularHttpAdapter.transformError(request, error, options))))
            .pipe(map((response: AngularHttpResponse<any>) => AngularHttpAdapter.transformResponse<T>(response)));
    }

    private static transformResponse<T>(response: AngularHttpResponse<any>): HttpResponseInterface<T> {
        return new HttpResponse<T>(
            response.url,
            response.status,
            AngularHttpAdapter.reverse(response.headers),
            Promise.resolve(204 === response.status ? null : response.body),
        );
    }

    private static transformError(request: HttpRequestInterface, error: AngularHttpErrorResponse, options: HttpRequestOptionsInterface): Error {
        if (error.error instanceof ErrorEvent || 0 === error.status) {
            return new ClientError(
                request.url,
                request.method,
                request.headers,
                error.error.message,
            );
        }

        let headers: Map<string, string[]> = new Map<string, string[]>();
        error.headers.keys().forEach((name: string) => {
            headers.set(name, error.headers.getAll(name));
        });

        if (0 === error.status) {
            return new CORSError(
                error.url,
                request.method,
                new HttpHeaders(headers),
                error.message,
            );
        }

        return new HttpError(
            error.url,
            error.status,
            request.method,
            new HttpHeaders(headers),
            error.message,
            (): Promise<string | object> => {
                if ('text' === options.errorType) {
                    return Promise.resolve(error.error);
                }

                return new Promise<string | object>((resolve: (arg: object) => void, reject: (e: Error) => void) => {
                    try {
                        resolve(JSON.parse(error.error));
                    } catch (e) {
                        reject(e);
                    }
                });
            },
        );
    }

    /**
     * Transform headers into angular headers.
     */
    private static transform(headers?: HttpHeadersInterface): AngularHttpHeaders {
        if (!headers) {
            return new AngularHttpHeaders();
        }

        let keys: string[]                       = headers.keys();
        let result: { [name: string]: string[] } = {};

        keys.forEach((key: string) => {
            result[key] = headers.getAll(key);
        });

        return new AngularHttpHeaders(result);
    }

    /**
     * Transform angular headers into headers.
     */
    private static reverse(headers?: AngularHttpHeaders): HttpHeadersInterface {
        let headersMap: Map<string, string[]> = new Map<string, string[]>();
        headers.keys().forEach((name: string) => {
            headers.set(name, headers.getAll(name));
        });

        return new HttpHeaders(headersMap);
    }

}
