import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom, Observable } from 'rxjs';
import { ApiService } from './api.service';

export type PushCategory = 'invites' | 'membership' | 'events' | 'community';
export type PushPreferences = Record<PushCategory, boolean>;

/**
 * - `loading`: not checked yet
 * - `unsupported`: this browser or build cannot receive push (or the server has no keys)
 * - `needs-install`: iPhone/iPad: push only works for an app added to the Home Screen
 * - `denied`: the browser blocks notifications for this site
 * - `off`: possible, but not enabled on this device
 * - `on`: this device receives push
 */
export type PushState = 'loading' | 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

/** Remembers on this device that push was turned on, and for which endpoint. */
const DEVICE_KEY = 'velocal.push.endpoint';

@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly api = inject(ApiService);
  private readonly swPush = inject(SwPush);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly state = signal<PushState>('loading');
  private publicKey = '';

  /** Works out the state for this device and, if push is on, re-registers the subscription. */
  async refresh(): Promise<void> {
    if (!this.isBrowser) return;
    if (this.isIos() && !this.isStandalone()) {
      this.state.set('needs-install');
      return;
    }
    if (!this.swPush.isEnabled || !('Notification' in window)) {
      this.state.set('unsupported');
      return;
    }
    try {
      const config = await firstValueFrom(
        this.api.get<{ enabled: boolean; publicKey: string }>('/push/config'),
      );
      if (!config.enabled) {
        this.state.set('unsupported');
        return;
      }
      this.publicKey = config.publicKey;
    } catch {
      this.state.set('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      this.state.set('denied');
      return;
    }
    if (Notification.permission !== 'granted' || !this.wasEnabled()) {
      this.state.set('off');
      return;
    }
    // Permission was granted earlier: renew the subscription silently. The
    // browser may have dropped it (iOS does this) and the server may not know it.
    try {
      let sub = await firstValueFrom(this.swPush.subscription);
      if (!sub) {
        await this.subscribeAndRegister();
      } else {
        await this.register(sub);
      }
      this.state.set('on');
    } catch {
      this.state.set('off');
    }
  }

  /** Asks the browser for permission (call from a click) and registers this device. */
  async enable(): Promise<boolean> {
    if (!this.publicKey) await this.refresh();
    if (this.state() === 'needs-install' || this.state() === 'unsupported') return false;
    try {
      await this.subscribeAndRegister();
      this.state.set('on');
      return true;
    } catch {
      this.state.set(
        'Notification' in window && Notification.permission === 'denied' ? 'denied' : 'off',
      );
      return false;
    }
  }

  async disable(): Promise<void> {
    const endpoint = this.storedEndpoint();
    try {
      const sub = await firstValueFrom(this.swPush.subscription);
      if (sub) {
        await sub.unsubscribe();
        await this.removeFromServer(sub.endpoint);
      } else if (endpoint) {
        await this.removeFromServer(endpoint);
      }
    } catch {
      // The device is off either way; the server drops dead endpoints itself.
    }
    this.clearDevice();
    this.state.set('off');
  }

  /** Called on logout, before the token is removed, so the next user on this device gets nothing. */
  detachOnLogout(): void {
    const endpoint = this.storedEndpoint();
    if (!endpoint) return;
    this.removeFromServer(endpoint).catch(() => undefined);
    this.swPush.subscription.subscribe((sub) => void sub?.unsubscribe().catch(() => undefined));
    this.clearDevice();
    this.state.set('off');
  }

  getPreferences(): Observable<PushPreferences> {
    return this.api.get<PushPreferences>('/push/preferences');
  }

  updatePreferences(changes: Partial<PushPreferences>): Observable<PushPreferences> {
    return this.api.patch<PushPreferences>('/push/preferences', changes);
  }

  sendTest(): Observable<{ sent: number }> {
    return this.api.post<{ sent: number }>('/push/test', {});
  }

  private async subscribeAndRegister(): Promise<void> {
    const sub = await this.swPush.requestSubscription({ serverPublicKey: this.publicKey });
    await this.register(sub);
  }

  private async register(sub: PushSubscription): Promise<void> {
    const json = sub.toJSON();
    await firstValueFrom(
      this.api.post<void>('/push/subscriptions', {
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.['p256dh'], auth: json.keys?.['auth'] },
      }),
    );
    this.safeStorage((s) => s.setItem(DEVICE_KEY, sub.endpoint));
  }

  private removeFromServer(endpoint: string): Promise<unknown> {
    return firstValueFrom(
      this.api.delete(`/push/subscriptions?endpoint=${encodeURIComponent(endpoint)}`),
    );
  }

  private wasEnabled(): boolean {
    return !!this.storedEndpoint();
  }

  private storedEndpoint(): string | null {
    let value: string | null = null;
    this.safeStorage((s) => (value = s.getItem(DEVICE_KEY)));
    return value;
  }

  private clearDevice(): void {
    this.safeStorage((s) => s.removeItem(DEVICE_KEY));
  }

  private safeStorage(fn: (storage: Storage) => void): void {
    try {
      fn(localStorage);
    } catch {
      // storage can be blocked (private mode); push then works for this visit only
    }
  }

  private isIos(): boolean {
    const ua = navigator.userAgent;
    // iPadOS reports itself as a Mac with a touch screen.
    return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }

  private isStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }
}
