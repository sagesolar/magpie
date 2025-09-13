// API service for communication with backend
class APIService {
  constructor() {
    this.baseUrl = '/api';
    this.isOnline = navigator.onLine;
    
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
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      
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
      body: JSON.stringify(book)
    });
  }

  async updateBook(isbn, book) {
    return this.request(`/books/${isbn}`, {
      method: 'PUT',
      body: JSON.stringify(book)
    });
  }

  async deleteBook(isbn) {
    return this.request(`/books/${isbn}`, {
      method: 'DELETE'
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
      method: 'PUT'
    });
  }

  async updateLoanStatus(isbn, loanData) {
    return this.request(`/books/${isbn}/loan`, {
      method: 'PUT',
      body: JSON.stringify(loanData)
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
      
      // Dispatch sync complete event
      window.dispatchEvent(new CustomEvent('syncComplete', {
        detail: { syncedCount: changes.length }
      }));
      
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  // Check if we're in offline mode
  isOfflineMode() {
    return !this.isOnline;
  }
}

export const apiService = new APIService();
