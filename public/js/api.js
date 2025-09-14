// API service for communication with backend
import { bookDB } from './db.js';

class APIService {
  constructor() {
    // Use window.API_BASE_URL from config.js or fallback to relative path for development
    this.baseUrl = (window.API_BASE_URL || '') + '/api';
    this.isOnline = navigator.onLine;

    console.log('API Base URL:', this.baseUrl);

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncOfflineChanges();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    // Get authentication headers if user is logged in
    const authHeaders =
      window.magpieAuth && window.magpieAuth.isAuthenticated()
        ? window.magpieAuth.getAuthHeader()
        : {};

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      // Handle authentication errors
      if (response.status === 401) {
        console.warn('Authentication failed or token expired');
        if (window.magpieAuth && window.magpieAuth.isAuthenticated()) {
          // Token expired, logout user
          await window.magpieAuth.logout();
        }
        throw new Error('Authentication required');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (!this.isOnline) {
        throw new Error('Network unavailable. Working in offline mode.');
      }
      throw error;
    }
  }

  // Book API methods
  async getAllBooks(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/books?${queryString}` : '/books';
    return this.request(endpoint);
  }

  async getBook(isbn) {
    return this.request(`/books/${isbn}`);
  }

  async createBook(book) {
    return this.request('/books', {
      method: 'POST',
      body: JSON.stringify(book),
    });
  }

  async updateBook(isbn, book) {
    return this.request(`/books/${isbn}`, {
      method: 'PUT',
      body: JSON.stringify(book),
    });
  }

  async deleteBook(isbn) {
    return this.request(`/books/${isbn}`, {
      method: 'DELETE',
    });
  }

  async searchBooks(query) {
    return this.request(`/search?q=${encodeURIComponent(query)}`);
  }

  async getExternalBookData(isbn) {
    return this.request(`/external/${isbn}`);
  }

  async toggleFavourite(isbn) {
    return this.request(`/books/${isbn}/favourite`, {
      method: 'PUT',
    });
  }

  async updateLoanStatus(isbn, loanData) {
    return this.request(`/books/${isbn}/loan`, {
      method: 'PUT',
      body: JSON.stringify(loanData),
    });
  }

  // Sync offline changes
  async syncOfflineChanges() {
    if (!this.isOnline) return;

    try {
      const changes = await bookDB.getUnsyncedChanges();
      console.log(`Syncing ${changes.length} offline changes`);

      for (const change of changes) {
        try {
          let result;

          switch (change.action) {
            case 'create':
              result = await this.createBook(change.data);
              break;
            case 'update':
              result = await this.updateBook(change.isbn, change.data);
              break;
            case 'delete':
              result = await this.deleteBook(change.isbn);
              break;
          }

          // Mark as synced
          await bookDB.markChangeAsSynced(change.id);

          // Update local copy with server response
          if (change.action !== 'delete' && result) {
            const localBook = await bookDB.getBook(change.isbn);
            if (localBook) {
              localBook.needsSync = false;
              localBook.lastSynced = new Date().toISOString();
              await bookDB.saveBook(localBook);
            }
          }
        } catch (error) {
          console.error(`Failed to sync change ${change.id}:`, error);
          // Continue with other changes
        }
      }

      // Clean up synced changes
      await bookDB.clearSyncedChanges();

      // Only dispatch sync complete event if there were changes to sync
      if (changes.length > 0) {
        window.dispatchEvent(
          new CustomEvent('syncComplete', {
            detail: { syncedCount: changes.length },
          })
        );
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  // Check if we're in offline mode
  isOfflineMode() {
    return !this.isOnline;
  }

  // Authentication API methods
  async updateUserProfile(updateData) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  async getUserProfile() {
    return this.request('/auth/profile');
  }

  // Book sharing API methods
  async shareBook(isbn, shareData) {
    return this.request(`/books/${isbn}/share`, {
      method: 'POST',
      body: JSON.stringify(shareData),
    });
  }

  async getSharedBooks() {
    return this.request('/books/shared');
  }

  async updateBookPermissions(isbn, permissions) {
    return this.request(`/books/${isbn}/permissions`, {
      method: 'PUT',
      body: JSON.stringify(permissions),
    });
  }

  async removeBookAccess(isbn, userEmail) {
    return this.request(`/books/${isbn}/access`, {
      method: 'DELETE',
      body: JSON.stringify({ userEmail }),
    });
  }
}

export const apiService = new APIService();
