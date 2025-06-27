// Service Worker Registration and Management
class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private updateAvailable = false;

  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return null;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registered successfully:', this.registration);

      // Handle service worker updates
      this.setupUpdateHandling();

      // Handle service worker messages
      this.setupMessageHandling();

      return this.registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }

  private setupUpdateHandling(): void {
    if (!this.registration) return;

    // Check for updates on page load
    this.registration.addEventListener('updatefound', () => {
      console.log('Service Worker update found');
      
      const newWorker = this.registration!.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          this.updateAvailable = true;
          this.notifyUpdateAvailable();
        }
      });
    });

    // Handle controller change
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service Worker controller changed');
      window.location.reload();
    });
  }

  private setupMessageHandling(): void {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, data } = event.data;

      switch (type) {
        case 'CACHE_STATS':
          console.log('Cache stats:', data);
          break;
        case 'OFFLINE_ACTION_QUEUED':
          console.log('Offline action queued:', data);
          break;
        case 'SYNC_COMPLETED':
          console.log('Background sync completed:', data);
          break;
        default:
          console.log('Unknown SW message:', type, data);
      }
    });
  }

  private notifyUpdateAvailable(): void {
    // Dispatch custom event for the app to handle
    const event = new CustomEvent('swUpdateAvailable', {
      detail: { registration: this.registration }
    });
    window.dispatchEvent(event);
  }

  async update(): Promise<void> {
    if (!this.registration) return;

    try {
      await this.registration.update();
      console.log('Service Worker update requested');
    } catch (error) {
      console.error('Service Worker update failed:', error);
    }
  }

  async skipWaiting(): Promise<void> {
    if (!this.registration?.waiting) return;

    try {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      console.log('Skip waiting message sent');
    } catch (error) {
      console.error('Skip waiting failed:', error);
    }
  }

  async getCacheStats(): Promise<any> {
    if (!this.registration?.active) return null;

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      this.registration!.active!.postMessage(
        { type: 'GET_CACHE_STATS' },
        [channel.port2]
      );
    });
  }

  async clearCache(): Promise<void> {
    if (!this.registration?.active) return;

    try {
      this.registration.active.postMessage({ type: 'CLEAR_CACHE' });
      console.log('Cache clear message sent');
    } catch (error) {
      console.error('Cache clear failed:', error);
    }
  }

  async cacheApiResponse(url: string, response: any): Promise<void> {
    if (!this.registration?.active) return;

    try {
      this.registration.active.postMessage({
        type: 'CACHE_API_RESPONSE',
        data: { url, response }
      });
    } catch (error) {
      console.error('Cache API response failed:', error);
    }
  }

  // Background sync for offline actions
  async requestBackgroundSync(tag: string, data?: any): Promise<void> {
    if (!this.registration || !('sync' in this.registration)) {
      console.log('Background sync not supported');
      return;
    }

    try {
      await this.registration.sync.register(tag);
      console.log('Background sync registered:', tag);
    } catch (error) {
      console.error('Background sync registration failed:', error);
    }
  }

  // Push notification subscription
  async subscribeToPushNotifications(): Promise<PushSubscription | null> {
    if (!this.registration || !('pushManager' in this.registration)) {
      console.log('Push notifications not supported');
      return null;
    }

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(process.env.VITE_VAPID_PUBLIC_KEY || '')
      });

      console.log('Push notification subscription created:', subscription);
      return subscription;
    } catch (error) {
      console.error('Push notification subscription failed:', error);
      return null;
    }
  }

  async unsubscribeFromPushNotifications(): Promise<boolean> {
    if (!this.registration?.pushManager) return false;

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        console.log('Push notification subscription removed');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Push notification unsubscription failed:', error);
      return false;
    }
  }

  // Convert VAPID public key to Uint8Array
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Check if app is online
  isOnline(): boolean {
    return navigator.onLine;
  }

  // Get registration status
  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }

  // Check if update is available
  hasUpdate(): boolean {
    return this.updateAvailable;
  }

  // Get service worker state
  getState(): string | null {
    return this.registration?.active?.state || null;
  }
}

// Export singleton instance
export const swManager = new ServiceWorkerManager();

// Auto-register service worker when module is imported
if (typeof window !== 'undefined') {
  // Register service worker after page load
  window.addEventListener('load', () => {
    swManager.register();
  });

  // Handle online/offline events
  window.addEventListener('online', () => {
    console.log('App is online');
    // Trigger background sync when coming back online
    swManager.requestBackgroundSync('background-sync');
  });

  window.addEventListener('offline', () => {
    console.log('App is offline');
  });
} 