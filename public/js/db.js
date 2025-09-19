// IndexedDB wrapper for offline book storage

class BookDB {
  constructor() {
    this.db = null;
    this.dbName = 'MagpieBooks';
    this.version = 1;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = event => {
        const db = event.target.result;

        // Books store
        if (!db.objectStoreNames.contains('books')) {
          const booksStore = db.createObjectStore('books', { keyPath: 'isbn' });
          booksStore.createIndex('title', 'title', { unique: false });
          booksStore.createIndex('authors', 'authors', { unique: false, multiEntry: true });
          booksStore.createIndex('genre', 'genre', { unique: false });
          booksStore.createIndex('isRead', 'isRead', { unique: false });
          booksStore.createIndex('isFavourite', 'isFavourite', { unique: false });
          booksStore.createIndex('loanedTo', 'loanedTo', { unique: false });
          booksStore.createIndex('needsSync', 'needsSync', { unique: false });
        }

        // Offline changes queue
        if (!db.objectStoreNames.contains('changes')) {
          const changesStore = db.createObjectStore('changes', { keyPath: 'id' });
          changesStore.createIndex('isbn', 'isbn', { unique: false });
          changesStore.createIndex('synced', 'synced', { unique: false });
          changesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // App metadata
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  getTransaction(stores, mode = 'readonly') {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.transaction(stores, mode);
  }

  // Book operations
  async getAllBooks() {
    const transaction = this.getTransaction(['books']);
    const store = transaction.objectStore('books');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getBook(isbn) {
    const transaction = this.getTransaction(['books']);
    const store = transaction.objectStore('books');

    return new Promise((resolve, reject) => {
      const request = store.get(isbn);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveBook(book) {
    const transaction = this.getTransaction(['books', 'changes'], 'readwrite');
    const booksStore = transaction.objectStore('books');
    const changesStore = transaction.objectStore('changes');

    // Save book
    const existingBook = await this.getBook(book.isbn);
    const isUpdate = !!existingBook;

    book.dateUpdated = new Date().toISOString();
    book.needsSync = true;
    book.syncAction = isUpdate ? 'update' : 'create';

    // Save change for sync
    const change = {
      id: `${book.isbn}-${Date.now()}`,
      isbn: book.isbn,
      action: book.syncAction,
      data: book,
      timestamp: new Date().toISOString(),
      synced: false,
    };

    return new Promise((resolve, reject) => {
      booksStore.put(book);
      changesStore.add(change);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async saveBooksFromServer(books) {
    if (!books || books.length === 0) return;

    const transaction = this.getTransaction(['books'], 'readwrite');
    const booksStore = transaction.objectStore('books');

    return new Promise((resolve, reject) => {
      books.forEach(book => {
        // Don't set sync flags for books from server
        const cleanBook = { ...book };
        delete cleanBook.needsSync;
        delete cleanBook.syncAction;
        booksStore.put(cleanBook);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Save single book from server (for refresh sync)
  async syncBookFromServer(book) {
    if (!book) return;

    const transaction = this.getTransaction(['books'], 'readwrite');
    const booksStore = transaction.objectStore('books');

    return new Promise((resolve, reject) => {
      // Don't set sync flags for books from server
      const cleanBook = { ...book };
      delete cleanBook.needsSync;
      delete cleanBook.syncAction;
      
      booksStore.put(cleanBook);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async deleteBook(isbn) {
    const transaction = this.getTransaction(['books', 'changes'], 'readwrite');
    const booksStore = transaction.objectStore('books');
    const changesStore = transaction.objectStore('changes');

    // Save delete change for sync
    const change = {
      id: `${isbn}-delete-${Date.now()}`,
      isbn,
      action: 'delete',
      data: { isbn },
      timestamp: new Date().toISOString(),
      synced: false,
    };

    return new Promise((resolve, reject) => {
      booksStore.delete(isbn);
      changesStore.add(change);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async searchBooks(query) {
    const books = await this.getAllBooks();
    const lowerQuery = query.toLowerCase();

    return books.filter(
      book =>
        book.title.toLowerCase().includes(lowerQuery) ||
        book.authors.some(author => author.toLowerCase().includes(lowerQuery)) ||
        (book.genre && book.genre.toLowerCase().includes(lowerQuery)) ||
        book.isbn.includes(query)
    );
  }

  async getBooksByFilter(filter) {
    const books = await this.getAllBooks();

    return books.filter(book => {
      if (filter.isRead !== undefined && book.isRead !== filter.isRead) return false;
      if (filter.isFavourite !== undefined && book.isFavourite !== filter.isFavourite) return false;
      if (filter.loanedTo !== undefined && book.loanedTo !== filter.loanedTo) return false;
      if (filter.genre !== undefined && book.genre !== filter.genre) return false;
      return true;
    });
  }

  // Sync operations
  async getUnsyncedChanges() {
    const transaction = this.getTransaction(['changes']);
    const store = transaction.objectStore('changes');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        // Filter unsynced changes in memory since IndexedDB boolean indexing is problematic
        const allChanges = request.result;
        const unsyncedChanges = allChanges.filter(change => change.synced === false);
        resolve(unsyncedChanges);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markChangeAsSynced(changeId) {
    const transaction = this.getTransaction(['changes'], 'readwrite');
    const store = transaction.objectStore('changes');

    return new Promise((resolve, reject) => {
      const getRequest = store.get(changeId);
      getRequest.onsuccess = () => {
        const change = getRequest.result;
        if (change) {
          change.synced = true;
          store.put(change);
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async clearSyncedChanges() {
    const changes = await this.getUnsyncedChanges();
    const syncedChanges = changes.filter(c => c.synced);

    if (syncedChanges.length === 0) return;

    const transaction = this.getTransaction(['changes'], 'readwrite');
    const store = transaction.objectStore('changes');

    return new Promise((resolve, reject) => {
      syncedChanges.forEach(change => store.delete(change.id));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Metadata operations
  async getMetadata(key) {
    const transaction = this.getTransaction(['metadata']);
    const store = transaction.objectStore('metadata');

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  async setMetadata(key, value) {
    const transaction = this.getTransaction(['metadata'], 'readwrite');
    const store = transaction.objectStore('metadata');

    return new Promise((resolve, reject) => {
      store.put({ key, value });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export const bookDB = new BookDB();
