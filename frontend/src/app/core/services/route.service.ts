import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '@core/tokens/api-base-url';
import { Route } from '@shared/models';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class RouteService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  listMine(): Observable<Route[]> {
    return this.api.get('/routes');
  }

  get(id: string): Observable<Route> {
    return this.api.get(`/routes/${id}`);
  }

  create(dto: { name: string; description?: string }): Observable<Route> {
    return this.api.post('/routes', dto);
  }

  update(id: string, dto: { name?: string; description?: string | null }): Observable<Route> {
    return this.api.patch(`/routes/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.api.delete(`/routes/${id}`);
  }

  addFile(id: string, file: File): Observable<Route> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<Route>(`${this.base}/routes/${id}/files`, form);
  }

  removeFile(id: string, fileId: string): Observable<Route> {
    return this.api.delete(`/routes/${id}/files/${fileId}`);
  }

  /** Fetches the GPX with the user's session (the endpoint is access-checked) and saves it. */
  download(id: string, fileId: string, label: string): void {
    this.http
      .get(`${this.base}/routes/${id}/files/${fileId}/download`, { responseType: 'blob' })
      .subscribe((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${label}.gpx`;
        link.click();
        URL.revokeObjectURL(url);
      });
  }
}
