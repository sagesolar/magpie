// Main application logic
import { bookDB } from './db.js';
import { apiService } from './api.js';
import { cameraOCRService } from './camera-ocr.js';

class MagpieApp {
  constructor() {
    this.currentTab = 'collection';
    this.currentBook = null;
    this.books = [];
    this.filteredBooks = [];
    this.isInitialized = false;
    this.currentUser = null;
    this.isAuthenticated = false;

    this.init();
  }

  async init() {
    try {
      // Initialize authentication
      await this.initAuthentication();

      // Initialize IndexedDB
      await bookDB.init();

      // Load initial data
      await this.loadBooks();

      // Setup event listeners
      this.setupEventListeners();

      // Update UI
      this.updateConnectionStatus();
      this.updateAuthUI();
      this.renderBooks();
      this.populateGenreFilter();
      this.updateVersionInfo();

      // Check for pending changes (async)
      this.updateSyncStatus().catch(error => {
        console.warn('Failed to update sync status:', error);
      });

      // Pre-cache cover images for offline use
      this.cacheCoverImages();

      this.isInitialized = true;
      console.log('Magpie app initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showToast('Failed to initialize app', 'error');
    }
  }

  async initAuthentication() {
    try {
      // Initialize auth service
      if (window.magpieAuth) {
        await window.magpieAuth.initialize();

        // Check if user is already authenticated
        this.isAuthenticated = window.magpieAuth.isAuthenticated();
        this.currentUser = window.magpieAuth.getCurrentUser();

        // Setup auth event listeners
        window.addEventListener('magpie:login', event => {
          this.handleLogin(event.detail.user, event.detail.error);
        });

        window.addEventListener('magpie:logout', () => {
          this.handleLogout();
        });

        console.log('Authentication initialized. Logged in:', this.isAuthenticated);
      }
    } catch (error) {
      console.warn('Authentication initialization failed:', error);
      // Continue without auth - offline mode
    }
  }

  setupEventListeners() {
    // Online/offline status
    window.addEventListener('online', () => this.updateConnectionStatus());
    window.addEventListener('offline', () => this.updateConnectionStatus());

    // Sync completion
    window.addEventListener('syncComplete', event => {
      this.showToast(`Synced ${event.detail.syncedCount} changes`, 'success');
      this.loadBooks(); // Refresh data
    });

    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        if (searchInput.value.trim() === '') {
          this.clearSearch();
        }
      });

      searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
          this.searchBooks();
        }
      });
    }
  }

  // Data Management
  async loadBooks() {
    try {
      // Always load from local database first
      this.books = await bookDB.getAllBooks();
      this.filteredBooks = [...this.books];

      // Try to sync with server if online (but don't auto-sync changes)
      if (navigator.onLine) {
        try {
          // Only fetch latest books from server, don't auto-sync changes
          const response = await apiService.getAllBooks();
          if (response && response.data) {
            // Save fetched books to local database using batch method
            await bookDB.saveBooksFromServer(response.data);
            console.log(`Fetched ${response.data.length} books from server`);
          }

          // Reload from local database after server fetch
          this.books = await bookDB.getAllBooks();
          this.filteredBooks = [...this.books];
        } catch (error) {
          console.warn('Server fetch failed, using offline data:', error);
        }
      }

      this.renderBooks();
      this.populateGenreFilter();
      
      // Update sync status after loading
      await this.updateSyncStatus();
    } catch (error) {
      console.error('Failed to load books:', error);
      this.showToast('Failed to load books', 'error');
    }
  }

  // Cache cover images for offline use
  async cacheCoverImages() {
    try {
      if ('serviceWorker' in navigator && this.books.length > 0) {
        const registration = await navigator.serviceWorker.ready;
        if (registration.active) {
          registration.active.postMessage({
            type: 'CACHE_IMAGES',
          });
          console.log('Requested cover image caching');
        }
      }
    } catch (error) {
      console.warn('Failed to cache cover images:', error);
    }
  }

  // UI Updates
  updateConnectionStatus() {
    const statusDot = document.getElementById('connectionStatus');
    const statusText = document.getElementById('connectionText');
    const syncButton = document.getElementById('syncButton');

    if (navigator.onLine) {
      statusDot.classList.remove('offline');
      statusText.textContent = 'Online';
      syncButton.style.display = 'block';
    } else {
      statusDot.classList.add('offline');
      
      // Show different offline status based on authentication
      const isAuthenticated = window.magpieAuth && window.magpieAuth.isAuthenticated();
      if (isAuthenticated) {
        statusText.textContent = 'Offline Mode';
      } else {
        statusText.textContent = 'Offline';
      }
      
      syncButton.style.display = 'none';
    }
  }

  // Update sync status and show pending changes count
  async updateSyncStatus() {
    if (!navigator.onLine) return;
    
    const syncButton = document.getElementById('syncButton');
    const syncBadge = document.getElementById('syncBadge') || this.createSyncBadge();
    
    try {
      const pendingChanges = await bookDB.getUnsyncedChanges();
      const changeCount = pendingChanges.length;
      
      if (changeCount > 0) {
        syncBadge.textContent = changeCount;
        syncBadge.style.display = 'block';
        syncButton.title = `${changeCount} pending changes - Click to review and sync`;
        syncButton.classList.add('has-pending-changes');
      } else {
        syncBadge.style.display = 'none';
        syncButton.title = 'Sync with server';
        syncButton.classList.remove('has-pending-changes');
      }
    } catch (error) {
      console.error('Failed to check sync status:', error);
    }
  }

  // Create sync notification badge
  createSyncBadge() {
    const syncButton = document.getElementById('syncButton');
    const badge = document.createElement('span');
    badge.id = 'syncBadge';
    badge.className = 'sync-badge';
    badge.style.display = 'none';
    
    // Position badge relative to sync button
    syncButton.style.position = 'relative';
    syncButton.appendChild(badge);
    
    return badge;
  }

  updateVersionInfo() {
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      const versionInfo = document.getElementById('versionInfo');

      if (versionInfo && window.APP_VERSION) {
        const buildInfo = window.BUILD_NUMBER ? `b${window.BUILD_NUMBER}` : '';
        const envInfo = window.ENVIRONMENT === 'development' ? ' (dev)' : '';
        const versionText = `${window.APP_VERSION}${buildInfo}${envInfo}`;
        versionInfo.textContent = versionText;

        // Add the dev class if in development
        if (window.ENVIRONMENT === 'development') {
          versionInfo.classList.add('dev');
        } else {
          versionInfo.classList.remove('dev');
        }
      }
    }, 100);
  }

  // Tab Management
  switchTab(tabName) {
    // Check if trying to access shared tab without authentication
    if (tabName === 'shared' && !this.isAuthenticated) {
      this.showToast('Please sign in to view shared books', 'warning');
      return;
    }

    // Remove active class from all tabs and content
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document
      .querySelectorAll('.tab-content')
      .forEach(content => content.classList.remove('active'));

    // Add active class to selected tab and content
    document.querySelector(`[onclick="app.switchTab('${tabName}')"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');

    this.currentTab = tabName;

    // Load tab-specific content
    switch (tabName) {
      case 'collection':
        this.renderBooks();
        break;
      case 'favourites':
        this.renderFavourites();
        break;
      case 'shared':
        this.renderSharedBooks();
        break;
      case 'wishlist':
        this.renderWishlist();
        break;
      case 'loans':
        this.renderLoans();
        break;
    }
  }

  // Book Rendering
  renderBooks() {
    const container = document.getElementById('booksContainer');

    console.log(`[DEBUG] renderBooks: Starting with ${this.filteredBooks.length} filtered books`);

    // Filter books based on authentication and ownership
    const visibleBooks = this.filterUserAccessibleBooks(this.filteredBooks);

    console.log(`[DEBUG] renderBooks: After filtering, ${visibleBooks.length} visible books`);

    if (!visibleBooks.length) {
      const isAuthenticated = window.magpieAuth && window.magpieAuth.isAuthenticated();
      console.log(`[DEBUG] renderBooks: No visible books, authenticated: ${isAuthenticated}`);
      
      if (isAuthenticated) {
        // User is authenticated but has no books
        const currentUser = window.magpieAuth.getCurrentUser();
        const offlineNote = currentUser?.isOfflineMode ? ' (Offline Mode)' : '';
        
        container.innerHTML = `
          <div class="empty-state">
            <h3>No books in your collection${offlineNote}</h3>
            <p>Start building your personal collection by adding books!</p>
            <button class="btn btn-primary" onclick="app.showAddBookModal()">Add Your First Book</button>
          </div>
        `;
      } else {
        // User is not authenticated
        container.innerHTML = `
          <div class="empty-state">
            <h3>Please sign in to view your books</h3>
            <p>Sign in with Google to access your personal book collection.</p>
            <button class="btn btn-primary" onclick="app.showLogin()">Sign In</button>
          </div>
        `;
      }
      return;
    }

    const booksHTML = visibleBooks.map(book => this.renderBookCard(book)).join('');
    container.innerHTML = `<div class="books-grid">${booksHTML}</div>`;
  }

  filterUserAccessibleBooks(books) {
    // Check authentication state (works offline)
    if (!window.magpieAuth || !window.magpieAuth.isAuthenticated()) {
      console.log('[DEBUG] Not authenticated, showing no books');
      return [];
    }

    const currentUser = window.magpieAuth.getCurrentUser();
    if (!currentUser) {
      console.log('[DEBUG] No current user, showing no books');
      return [];
    }

    console.log('[DEBUG] Current user:', currentUser);
    console.log('[DEBUG] Filtering books. Total books:', books.length);

    // Filter books that user owns or has access to
    const filteredBooks = books.filter(book => {
      console.log(`[DEBUG] Checking book: ${book.title} (ownerId: ${book.ownerId})`);
      
      // All books must have an owner - no legacy books
      if (!book.ownerId) {
        console.log(`[DEBUG] Book ${book.title} has no owner, hiding (no legacy books)`);
        return false;
      }

      // Show if user owns the book (works offline with cached user identity)
      if (book.ownerId === currentUser.id) {
        console.log(`[DEBUG] Book ${book.title} owned by user (${currentUser.id}), showing`);
        return true;
      }

      // Show if book is shared with user
      if (book.sharedWith && book.sharedWith.some(share => share.userEmail === currentUser.email)) {
        console.log(`[DEBUG] Book ${book.title} shared with user, showing`);
        return true;
      }

      console.log(`[DEBUG] Book ${book.title} not accessible to user, hiding`);
      return false;
    });

    console.log(`[DEBUG] Filtered ${filteredBooks.length} books from ${books.length} total`);
    return filteredBooks;
  }

  renderBookCard(book) {
    const syncIndicator = book.needsSync
      ? '<span class="sync-indicator pending"></span>'
      : '<span class="sync-indicator"></span>';

    // Generate a consistent color based on the book title
    const getBookColor = title => {
      const colors = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
        'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
        'linear-gradient(135deg, #ff8a80 0%, #ff5722 100%)',
      ];
      let hash = 0;
      for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash);
      }
      return colors[Math.abs(hash) % colors.length];
    };

    const coverElement = book.coverImageUrl
      ? `<img src="${book.coverImageUrl}" alt="${book.title}" class="book-cover-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">`
      : '';

    const placeholderCover = `
      <div class="book-cover-placeholder" style="background: ${getBookColor(book.title)}; ${book.coverImageUrl ? 'display: none;' : ''}">
        <div class="placeholder-title">${book.title.length > 30 ? book.title.substring(0, 27) + '...' : book.title}</div>
        <div class="placeholder-author">${book.authors[0]}</div>
      </div>
    `;

    return `
      <div class="book-card">
        <div class="book-cover-container">
          ${coverElement}
          ${placeholderCover}
        </div>
        <div class="book-content">
          <div class="book-header">
            <div>
              <div class="book-title">${book.title}${syncIndicator}</div>
              <div class="book-authors">${book.authors.join(', ')}</div>
            </div>
            <div class="book-actions">
            <button class="icon-btn favourite ${book.isFavourite ? 'active' : ''}" 
                    onclick="app.toggleFavourite('${book.isbn}')" title="Favourite">
              ⭐
            </button>
            <button class="icon-btn read ${book.isRead ? 'active' : ''}" 
                    onclick="app.toggleRead('${book.isbn}')" title="Mark as read">
              ✓
            </button>
            <button class="icon-btn loan ${book.loanStatus?.isLoaned ? 'active' : ''}" 
                    onclick="app.showLoanModal('${book.isbn}')" title="Loan status">
              👤
            </button>
            <button class="icon-btn" onclick="app.showEditModal('${book.isbn}')" title="Edit">
              ✏️
            </button>
            <button class="icon-btn" onclick="app.deleteBook('${book.isbn}')" title="Delete" style="background: #fee2e2; color: #dc2626;">
              🗑️
            </button>
          </div>
        </div>
        
        ${book.description ? `<p style="color: #6b7280; font-size: 0.9rem; margin: 10px 0;">${book.description.substring(0, 150)}${book.description.length > 150 ? '...' : ''}</p>` : ''}
        
        <div class="book-meta">
          <div><strong>Genre:</strong> ${book.genre || 'N/A'}</div>
          <div><strong>Pages:</strong> ${book.pages || 'N/A'}</div>
          <div><strong>Published:</strong> ${book.publishingYear || 'N/A'}</div>
          <div><strong>Rating:</strong> ${book.rating ? '⭐'.repeat(book.rating) : 'Not rated'}</div>
          ${book.loanStatus?.loanedTo ? `<div><strong>Loaned to:</strong> ${book.loanStatus.loanedTo}</div>` : ''}
          ${this.renderOwnershipInfo(book)}
        </div>
        </div>
      </div>
    `;
  }

  renderFavourites() {
    const container = document.getElementById('favouritesContainer');
    const favourites = this.filterUserAccessibleBooks(this.books.filter(book => book.isFavourite));

    if (!favourites.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No favourite books yet</h3>
          <p>Mark books as favourites to see them here!</p>
        </div>
      `;
      return;
    }

    const booksHTML = favourites.map(book => this.renderBookCard(book)).join('');
    container.innerHTML = `<div class="books-grid">${booksHTML}</div>`;
  }

  renderWishlist() {
    const container = document.getElementById('wishlistContainer');
    // For now, wishlist shows unread books
    const wishlist = this.filterUserAccessibleBooks(this.books.filter(book => !book.isRead));

    if (!wishlist.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>Your wishlist is empty</h3>
          <p>Add books you want to read to your wishlist!</p>
        </div>
      `;
      return;
    }

    const booksHTML = wishlist.map(book => this.renderBookCard(book)).join('');
    container.innerHTML = `<div class="books-grid">${booksHTML}</div>`;
  }

  renderLoans() {
    const container = document.getElementById('loansContainer');
    const loans = this.filterUserAccessibleBooks(this.books.filter(book => book.loanedTo));

    if (!loans.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No books currently loaned</h3>
          <p>Books you've loaned to others will appear here.</p>
        </div>
      `;
      return;
    }

    const booksHTML = loans.map(book => this.renderBookCard(book)).join('');
    container.innerHTML = `<div class="books-grid">${booksHTML}</div>`;
  }

  renderOwnershipInfo(book) {
    // Check if user is authenticated
    if (!window.magpieAuth || !window.magpieAuth.isAuthenticated()) {
      return '';
    }

    const currentUser = window.magpieAuth.getCurrentUser();
    if (!currentUser || !book.ownerId) {
      return '';
    }

    // Check if current user owns the book
    const isOwner = book.ownerId === currentUser.sub;

    // Check if book is shared with current user
    const isShared =
      book.sharedWith && book.sharedWith.some(share => share.userEmail === currentUser.email);

    let ownershipHTML = '';

    if (isOwner) {
      ownershipHTML += `<div><strong>Owner:</strong> You</div>`;

      // Show shared users if any
      if (book.sharedWith && book.sharedWith.length > 0) {
        const sharedUsers = book.sharedWith.map(share => share.userEmail).join(', ');
        ownershipHTML += `<div><strong>Shared with:</strong> ${sharedUsers}</div>`;
      }
    } else if (isShared) {
      const share = book.sharedWith.find(s => s.userEmail === currentUser.email);
      ownershipHTML += `<div><strong>Shared by:</strong> ${book.ownerId}</div>`;
      if (share.permissions) {
        const permissions = share.permissions.join(', ');
        ownershipHTML += `<div><strong>Permissions:</strong> ${permissions}</div>`;
      }
    }

    return ownershipHTML;
  }

  // Search and Filtering
  async searchBooks() {
    const query = document.getElementById('searchInput').value.trim();

    if (!query) {
      this.clearSearch();
      return;
    }

    try {
      const results = await bookDB.searchBooks(query);
      this.filteredBooks = results;
      this.renderBooks();
    } catch (error) {
      console.error('Search failed:', error);
      this.showToast('Search failed', 'error');
    }
  }

  clearSearch() {
    document.getElementById('searchInput').value = '';
    this.filteredBooks = [...this.books];
    this.renderBooks();
  }

  async applyFilters() {
    const genreFilter = document.getElementById('genreFilter').value;
    const readFilter = document.getElementById('readFilter').value;

    const filters = {};
    if (genreFilter) filters.genre = genreFilter;
    if (readFilter !== '') filters.isRead = readFilter === 'true';

    try {
      const results = await bookDB.getBooksByFilter(filters);
      this.filteredBooks = results;
      this.renderBooks();
    } catch (error) {
      console.error('Filter failed:', error);
      this.showToast('Filter failed', 'error');
    }
  }

  clearFilters() {
    document.getElementById('genreFilter').value = '';
    document.getElementById('readFilter').value = '';
    this.filteredBooks = [...this.books];
    this.renderBooks();
  }

  populateGenreFilter() {
    const genreFilter = document.getElementById('genreFilter');
    const genres = [...new Set(this.books.map(book => book.genre).filter(Boolean))];

    genreFilter.innerHTML = '<option value="">All Genres</option>';
    genres.forEach(genre => {
      genreFilter.innerHTML += `<option value="${genre}">${genre}</option>`;
    });
  }

  // Book Actions
  async toggleFavourite(isbn) {
    // Check authentication (works offline)
    if (!this.isAuthenticated || !this.currentUser) {
      this.showToast('Please sign in to manage favourites', 'warning');
      return;
    }

    try {
      const book = await bookDB.getBook(isbn);
      if (book) {
        // Check if user owns this book (works with offline user identity)
        if (book.ownerId !== this.currentUser.sub) {
          this.showToast('You can only modify your own books', 'error');
          return;
        }

        book.isFavourite = !book.isFavourite;
        book.needsSync = true; // Mark for sync when online
        await bookDB.saveBook(book);
        await this.loadBooks();
        await this.updateSyncStatus(); // Update sync badge
        
        const action = book.isFavourite ? 'added to' : 'removed from';
        const syncNote = !navigator.onLine ? ' (will sync when online)' : '';
        this.showToast(`Book ${action} favourites${syncNote}`, 'success');
      }
    } catch (error) {
      console.error('Toggle favourite failed:', error);
      this.showToast('Failed to update favourite status', 'error');
    }
  }

  async toggleRead(isbn) {
    // Check authentication (works offline)
    if (!this.isAuthenticated || !this.currentUser) {
      this.showToast('Please sign in to manage read status', 'warning');
      return;
    }

    try {
      const book = await bookDB.getBook(isbn);
      if (book) {
        // Check if user owns this book (works with offline user identity)
        if (book.ownerId !== this.currentUser.sub) {
          this.showToast('You can only modify your own books', 'error');
          return;
        }

        book.isRead = !book.isRead;
        book.needsSync = true; // Mark for sync when online
        await bookDB.saveBook(book);
        await this.loadBooks();
        await this.updateSyncStatus(); // Update sync badge
        
        const status = book.isRead ? 'read' : 'unread';
        const syncNote = !navigator.onLine ? ' (will sync when online)' : '';
        this.showToast(`Book marked as ${status}${syncNote}`, 'success');
      }
    } catch (error) {
      console.error('Toggle read failed:', error);
      this.showToast('Failed to update read status', 'error');
    }
  }

  async deleteBook(isbn) {
    // Check authentication (works offline)
    if (!this.isAuthenticated || !this.currentUser) {
      this.showToast('Please sign in to delete books', 'warning');
      return;
    }

    // Check if user owns this book (works with offline user identity)
    const book = await bookDB.getBook(isbn);
    if (book && book.ownerId !== this.currentUser.sub) {
      this.showToast('You can only delete your own books', 'error');
      return;
    }

    if (!confirm('Are you sure you want to delete this book?')) return;

    try {
      await bookDB.deleteBook(isbn);
      await this.loadBooks();
      await this.updateSyncStatus(); // Update sync badge
      
      const syncNote = !navigator.onLine ? ' (will sync when online)' : '';
      this.showToast(`Book deleted successfully${syncNote}`, 'success');
    } catch (error) {
      console.error('Delete failed:', error);
      this.showToast('Failed to delete book', 'error');
    }
  }

  // Modal Management
  showAddBookModal() {
    // Check authentication (works offline)
    if (!this.isAuthenticated || !this.currentUser) {
      this.showToast('Please sign in to add books', 'warning');
      return;
    }

    document.getElementById('modalTitle').textContent = 'Add New Book';
    document.getElementById('bookForm').reset();
    document.getElementById('bookModal').classList.add('active');
    this.currentBook = null;
  }

  async showEditModal(isbn) {
    // Check authentication (works offline)
    if (!this.isAuthenticated || !this.currentUser) {
      this.showToast('Please sign in to edit books', 'warning');
      return;
    }

    try {
      const book = await bookDB.getBook(isbn);
      if (!book) return;

      // Check if user owns this book (works with offline user identity)
      if (book.ownerId !== this.currentUser.sub) {
        this.showToast('You can only edit your own books', 'error');
        return;
      }

      document.getElementById('modalTitle').textContent = 'Edit Book';
      document.getElementById('isbnInput').value = book.isbn;
      document.getElementById('titleInput').value = book.title;
      document.getElementById('authorsInput').value = book.authors.join(', ');
      document.getElementById('publicationDateInput').value = book.publicationDate || '';
      document.getElementById('publisherInput').value = book.publisher || '';
      document.getElementById('pageCountInput').value = book.pageCount || '';
      document.getElementById('genreInput').value = book.genre || '';
      document.getElementById('descriptionInput').value = book.description || '';
      document.getElementById('coverImageUrlInput').value = book.coverImageUrl || '';
      document.getElementById('ratingInput').value = book.rating || '';
      document.getElementById('notesInput').value = book.notes || '';
      document.getElementById('isReadInput').checked = book.isRead;
      document.getElementById('isFavouriteInput').checked = book.isFavourite;

      document.getElementById('bookModal').classList.add('active');
      this.currentBook = book;
    } catch (error) {
      console.error('Failed to load book for editing:', error);
      this.showToast('Failed to load book data', 'error');
    }
  }

  closeModal() {
    document.getElementById('bookModal').classList.remove('active');
    this.currentBook = null;
  }

  async saveBook(event) {
    event.preventDefault();

    // Check authentication (works offline)
    if (!this.isAuthenticated || !this.currentUser) {
      this.showToast('Please sign in to save books', 'warning');
      return;
    }

    const formData = new FormData(event.target);
    const bookData = {
      isbn: document.getElementById('isbnInput').value.trim(),
      title: document.getElementById('titleInput').value.trim(),
      authors: document
        .getElementById('authorsInput')
        .value.split(',')
        .map(a => a.trim())
        .filter(Boolean),
      publicationDate: document.getElementById('publicationDateInput').value || undefined,
      publisher: document.getElementById('publisherInput').value.trim() || undefined,
      pageCount: parseInt(document.getElementById('pageCountInput').value) || undefined,
      genre: document.getElementById('genreInput').value.trim() || undefined,
      description: document.getElementById('descriptionInput').value.trim() || undefined,
      coverImageUrl: document.getElementById('coverImageUrlInput').value.trim() || undefined,
      rating: parseInt(document.getElementById('ratingInput').value) || undefined,
      notes: document.getElementById('notesInput').value.trim() || undefined,
      isRead: document.getElementById('isReadInput').checked,
      isFavourite: document.getElementById('isFavouriteInput').checked,
      dateAdded: this.currentBook?.dateAdded || new Date().toISOString(),
      dateUpdated: new Date().toISOString(),
      isOfflineOnly: !navigator.onLine,
      needsSync: true, // Always mark for sync
      // Set owner to current authenticated user (works offline)
      ownerId: this.currentUser.sub,
    };

    try {
      await bookDB.saveBook(bookData);
      await this.loadBooks();
      await this.updateSyncStatus(); // Update sync badge
      this.closeModal();
      
      const syncNote = !navigator.onLine ? ' (will sync when online)' : '';
      this.showToast(`Book saved successfully${syncNote}`, 'success');
    } catch (error) {
      console.error('Save failed:', error);
      this.showToast('Failed to save book', 'error');
    }
  }

  async fetchBookData() {
    const isbn = document.getElementById('isbnInput').value.trim();
    if (!isbn) {
      this.showToast('Please enter an ISBN first', 'error');
      return;
    }

    try {
      const bookData = await apiService.getExternalBookData(isbn);

      if (bookData) {
        document.getElementById('titleInput').value = bookData.title || '';
        document.getElementById('authorsInput').value = bookData.authors?.join(', ') || '';
        document.getElementById('publicationDateInput').value = bookData.publicationDate || '';
        document.getElementById('publisherInput').value = bookData.publisher || '';
        document.getElementById('pageCountInput').value = bookData.pageCount || '';
        document.getElementById('genreInput').value = bookData.genre || '';
        document.getElementById('descriptionInput').value = bookData.description || '';
        document.getElementById('coverImageUrlInput').value = bookData.coverImageUrl || '';

        this.showToast('Book data fetched successfully', 'success');
      }
    } catch (error) {
      console.error('Fetch book data failed:', error);
      this.showToast('Failed to fetch book data. Please enter manually.', 'error');
    }
  }

  // Camera/OCR Functions
  showCameraModal() {
    if (!cameraOCRService.constructor.isSupported()) {
      this.showToast('Camera not supported on this device', 'error');
      return;
    }

    document.getElementById('cameraModal').classList.add('active');
    this.initCamera();
  }

  async initCamera() {
    try {
      const video = document.getElementById('cameraVideo');
      await cameraOCRService.initCamera(video);
      document.getElementById('scanStatus').textContent =
        'Camera ready. Click "Start Scanning" to begin.';
    } catch (error) {
      console.error('Camera init failed:', error);
      this.showToast('Failed to access camera', 'error');
      document.getElementById('scanStatus').textContent = 'Camera access failed.';
    }
  }

  async startISBNScan() {
    const startBtn = document.getElementById('startScanBtn');
    const stopBtn = document.getElementById('stopScanBtn');
    const status = document.getElementById('scanStatus');

    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    status.textContent = 'Scanning for ISBN...';

    try {
      await cameraOCRService.startScanning(
        isbn => {
          this.closeCameraModal();
          this.showAddBookModal();
          document.getElementById('isbnInput').value = isbn;
          this.fetchBookData();
          this.showToast(`ISBN ${isbn} detected!`, 'success');
        },
        error => {
          console.error('Scan error:', error);
          status.textContent = 'Scan failed. Try again.';
        }
      );
    } catch (error) {
      console.error('Start scan failed:', error);
      this.showToast('Failed to start scanning', 'error');
      this.stopISBNScan();
    }
  }

  stopISBNScan() {
    const startBtn = document.getElementById('startScanBtn');
    const stopBtn = document.getElementById('stopScanBtn');
    const status = document.getElementById('scanStatus');

    cameraOCRService.stopScanning();

    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    status.textContent = 'Scanning stopped.';
  }

  closeCameraModal() {
    this.stopISBNScan();
    cameraOCRService.stopCamera();
    document.getElementById('cameraModal').classList.remove('active');
  }

  // Loan Management
  showLoanModal(isbn) {
    this.currentBook = { isbn };
    const book = this.books.find(b => b.isbn === isbn);

    if (book?.loanedTo) {
      document.getElementById('loanedToInput').value = book.loanedTo;
      document.getElementById('loanDateInput').value = book.loanDate || '';
    } else {
      document.getElementById('loanForm').reset();
      document.getElementById('loanDateInput').value = new Date().toISOString().split('T')[0];
    }

    document.getElementById('loanModal').classList.add('active');
  }

  async saveLoan(event) {
    event.preventDefault();

    const loanedTo = document.getElementById('loanedToInput').value.trim();
    const loanDate = document.getElementById('loanDateInput').value;

    try {
      const book = await bookDB.getBook(this.currentBook.isbn);
      if (book) {
        book.loanedTo = loanedTo || undefined;
        book.loanDate = loanDate || undefined;
        await bookDB.saveBook(book);
        await this.loadBooks();
        this.closeLoanModal();

        if (loanedTo) {
          this.showToast(`Book loaned to ${loanedTo}`, 'success');
        } else {
          this.showToast('Loan status cleared', 'success');
        }
      }
    } catch (error) {
      console.error('Save loan failed:', error);
      this.showToast('Failed to save loan status', 'error');
    }
  }

  closeLoanModal() {
    document.getElementById('loanModal').classList.remove('active');
    this.currentBook = null;
  }

  // Utility Functions
  async manualSync() {
    if (!navigator.onLine) {
      this.showToast('Cannot sync while offline', 'error');
      return;
    }

    if (!window.magpieAuth.isAuthenticated()) {
      this.showToast('Please sign in to sync', 'error');
      return;
    }

    // Check for pending changes
    const pendingChanges = await bookDB.getUnsyncedChanges();
    
    if (pendingChanges.length > 0) {
      // Show review modal for pending changes
      console.log(`[DEBUG] Found ${pendingChanges.length} pending changes, showing review modal`);
      this.showSyncReviewModal(pendingChanges);
    } else {
      // No pending changes, perform a refresh sync to get latest data from server
      console.log('[DEBUG] No pending changes, performing refresh sync');
      await this.performRefreshSync();
    }
  }

  // Perform a refresh sync when no local changes exist
  async performRefreshSync() {
    try {
      this.showToast('Syncing with server...', 'info');
      this.updateSyncStatus(true); // Show syncing indicator

      // Fetch latest books from server
      console.log('[DEBUG] Fetching latest books from server');
      const response = await fetch(window.API.getUrl('/api/books'), {
        headers: window.magpieAuth.getAuthHeader()
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.showToast('Authentication required. Please sign in again.', 'error');
          await window.magpieAuth.logout();
          return;
        }
        throw new Error(`Server response: ${response.status}`);
      }

      const latestBooks = await response.json();
      console.log(`[DEBUG] Received ${latestBooks.length} books from server`);

      // Update local database with latest server data
      for (const serverBook of latestBooks) {
        await bookDB.syncBookFromServer(serverBook);
      }

      // Check if there are any books locally that are no longer on server
      const localBooks = await bookDB.getAllBooks();
      const serverISBNs = new Set(latestBooks.map(book => book.isbn));
      
      for (const localBook of localBooks) {
        if (!serverISBNs.has(localBook.isbn) && localBook.ownerId === window.magpieAuth.getCurrentUser()?.id) {
          // Book exists locally but not on server - user might have deleted it elsewhere
          console.log(`[DEBUG] Book ${localBook.title} exists locally but not on server`);
          // Could prompt user about this discrepancy, but for now just keep local copy
        }
      }

      // Refresh the UI with updated data
      await this.loadAndDisplayBooks();
      
      this.showToast('✅ Sync completed successfully', 'success');
      console.log('[DEBUG] Refresh sync completed successfully');

    } catch (error) {
      console.error('Refresh sync failed:', error);
      this.showToast(`Sync failed: ${error.message}`, 'error');
    } finally {
      this.updateSyncStatus(false); // Hide syncing indicator
    }
  }

  // Sync review and confirmation
  showSyncReviewModal(pendingChanges) {
    const modal = document.createElement('div');
    modal.className = 'sync-review-modal';
    modal.id = 'syncReviewModal';
    
    const changesSummary = this.createChangesSummary(pendingChanges);
    
    modal.innerHTML = `
      <div class="sync-review-content">
        <div class="sync-review-header">
          <h3>Review Offline Changes</h3>
          <p>Review the following ${pendingChanges.length} changes before syncing to the server:</p>
          <button class="sync-review-close" onclick="app.closeSyncReviewModal()">&times;</button>
        </div>
        <div class="sync-review-body">
          ${changesSummary}
        </div>
        <div class="sync-review-footer">
          <button class="btn btn-secondary" onclick="app.closeSyncReviewModal()">Cancel</button>
          <button class="btn btn-primary" onclick="app.confirmSync()">Sync ${pendingChanges.length} Changes</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  createChangesSummary(pendingChanges) {
    const grouped = this.groupChangesByAction(pendingChanges);
    let summary = '';
    
    // Created books
    if (grouped.create.length > 0) {
      summary += `
        <div class="changes-section">
          <h4>📚 Books to Create (${grouped.create.length})</h4>
          <div class="changes-list">
            ${grouped.create.map(change => this.renderChangeItem(change)).join('')}
          </div>
        </div>
      `;
    }
    
    // Updated books
    if (grouped.update.length > 0) {
      summary += `
        <div class="changes-section">
          <h4>✏️ Books to Update (${grouped.update.length})</h4>
          <div class="changes-list">
            ${grouped.update.map(change => this.renderChangeItem(change)).join('')}
          </div>
        </div>
      `;
    }
    
    // Deleted books
    if (grouped.delete.length > 0) {
      summary += `
        <div class="changes-section">
          <h4>🗑️ Books to Delete (${grouped.delete.length})</h4>
          <div class="changes-list">
            ${grouped.delete.map(change => this.renderChangeItem(change)).join('')}
          </div>
        </div>
      `;
    }
    
    return summary || '<p>No changes to sync.</p>';
  }

  groupChangesByAction(changes) {
    return {
      create: changes.filter(c => c.action === 'create'),
      update: changes.filter(c => c.action === 'update'),
      delete: changes.filter(c => c.action === 'delete')
    };
  }

  renderChangeItem(change) {
    const book = change.data;
    const timestamp = new Date(change.timestamp).toLocaleString();
    
    const actionIcons = {
      create: '➕',
      update: '✏️',
      delete: '🗑️'
    };
    
    const actionColors = {
      create: '#10b981',
      update: '#f59e0b', 
      delete: '#ef4444'
    };
    
    return `
      <div class="change-item" style="border-left: 3px solid ${actionColors[change.action]}">
        <div class="change-header">
          <span class="change-action">${actionIcons[change.action]} ${change.action.toUpperCase()}</span>
          <span class="change-timestamp">${timestamp}</span>
        </div>
        <div class="change-book">
          <strong>${book.title || 'Unknown Title'}</strong>
          ${book.authors ? `<br><small>by ${book.authors.join(', ')}</small>` : ''}
          <br><small>ISBN: ${book.isbn}</small>
          ${change.action !== 'delete' ? `<button class="btn btn-link" onclick="app.viewBookDetails('${book.isbn}')">View Details</button>` : ''}
        </div>
      </div>
    `;
  }

  async viewBookDetails(isbn) {
    try {
      const book = await bookDB.getBook(isbn);
      if (book) {
        // Show book details in a modal or expand inline
        alert(`Book Details:\n\nTitle: ${book.title}\nAuthors: ${book.authors.join(', ')}\nISBN: ${book.isbn}\nGenre: ${book.genre || 'N/A'}\nRead: ${book.isRead ? 'Yes' : 'No'}\nFavourite: ${book.isFavourite ? 'Yes' : 'No'}`);
      }
    } catch (error) {
      console.error('Failed to load book details:', error);
      this.showToast('Failed to load book details', 'error');
    }
  }

  closeSyncReviewModal() {
    const modal = document.getElementById('syncReviewModal');
    if (modal) {
      document.body.removeChild(modal);
    }
  }

  async confirmSync() {
    const syncButton = document.querySelector('.sync-review-footer .btn-primary');
    syncButton.textContent = 'Syncing...';
    syncButton.disabled = true;
    
    try {
      await apiService.syncOfflineChanges();
      await this.loadBooks();
      await this.updateSyncStatus();
      this.closeSyncReviewModal();
      this.showToast('Sync completed successfully', 'success');
    } catch (error) {
      console.error('Sync failed:', error);
      this.showToast('Sync failed: ' + error.message, 'error');
      syncButton.textContent = 'Retry Sync';
      syncButton.disabled = false;
    }
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');

    // Add icon based on toast type
    let icon = '';
    switch (type) {
      case 'success':
        icon = '✓';
        break;
      case 'error':
        icon = '<img src="images/magpie-square-icon.png" alt="" class="toast-icon">';
        break;
      case 'info':
      default:
        icon = 'ℹ';
        break;
    }

    toast.innerHTML = `${icon} ${message}`;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // Authentication event handlers
  handleLogin(user, error) {
    if (error) {
      console.error('Login failed:', error);
      this.showToast(`Login failed: ${error}`, 'error');
      return;
    }

    this.isAuthenticated = true;
    this.currentUser = user;
    this.updateAuthUI();
    this.showToast(`Welcome back, ${user.name}!`, 'success');

    // Refresh data with user context
    this.loadBooks();
  }

  handleLogout() {
    this.isAuthenticated = false;
    this.currentUser = null;
    this.updateAuthUI();
    this.showToast('Logged out successfully', 'info');

    // Refresh data (will show offline data only)
    this.loadBooks();
  }

  // Authentication UI methods
  updateAuthUI() {
    const userProfile = document.getElementById('userProfile');
    const loginSection = document.getElementById('loginSection');
    const sharedTab = document.getElementById('sharedTab');
    const sharedAuthMessage = document.getElementById('sharedAuthMessage');
    const sharedContent = document.getElementById('sharedContent');

    if (this.isAuthenticated && this.currentUser) {
      // Show user profile
      userProfile.classList.remove('hidden');
      loginSection.classList.add('hidden');

      // Update user info
      document.getElementById('userName').textContent = this.currentUser.name;
      document.getElementById('userEmail').textContent = this.currentUser.email;
      document.getElementById('userAvatar').src =
        this.currentUser.profilePictureUrl || 'images/default-avatar.png';

      // Show shared tab content
      sharedTab.classList.remove('disabled');
      if (this.currentTab === 'shared') {
        sharedAuthMessage.classList.add('hidden');
        sharedContent.classList.remove('hidden');
      }
    } else {
      // Show login section
      userProfile.classList.add('hidden');
      loginSection.classList.remove('hidden');

      // Hide shared content, show auth message
      sharedTab.classList.add('disabled');
      if (this.currentTab === 'shared') {
        sharedAuthMessage.classList.remove('hidden');
        sharedContent.classList.add('hidden');
      }
    }
  }

  async showLogin() {
    try {
      if (window.magpieAuth) {
        await window.magpieAuth.showLoginPrompt();
      } else {
        this.showToast('Authentication service not available', 'error');
      }
    } catch (error) {
      console.error('Failed to show login:', error);
      this.showToast('Failed to show login', 'error');
    }
  }

  async logout() {
    try {
      if (window.magpieAuth) {
        await window.magpieAuth.logout();
      }
    } catch (error) {
      console.error('Logout failed:', error);
      this.showToast('Logout failed', 'error');
    }
  }

  // User settings methods
  showUserSettings() {
    if (!this.isAuthenticated) {
      this.showToast('Please sign in to access settings', 'warning');
      return;
    }

    const modal = document.getElementById('userSettingsModal');
    modal.classList.add('active');

    // Populate current settings
    this.populateUserSettings();
  }

  closeUserSettings() {
    const modal = document.getElementById('userSettingsModal');
    modal.classList.remove('active');
  }

  populateUserSettings() {
    if (!this.currentUser?.preferences) return;

    const prefs = this.currentUser.preferences;

    document.getElementById('booksPerPageSetting').value = prefs.booksPerPage || 20;
    document.getElementById('defaultViewSetting').value = prefs.defaultView || 'grid';
    document.getElementById('sortingStyleSetting').value = prefs.sortingStyle || 'alphabetical';
    document.getElementById('themeSetting').value = prefs.theme || 'auto';
    document.getElementById('sharingVisibilitySetting').value =
      prefs.sharingVisibility || 'private';

    document.getElementById('newBooksNotification').checked = prefs.notifications?.newBooks ?? true;
    document.getElementById('loanRemindersNotification').checked =
      prefs.notifications?.loanReminders ?? true;
    document.getElementById('sharedCollectionsNotification').checked =
      prefs.notifications?.sharedCollections ?? false;
  }

  async saveUserSettings(event) {
    event.preventDefault();

    if (!this.isAuthenticated) {
      this.showToast('Please sign in to save settings', 'warning');
      return;
    }

    try {
      const preferences = {
        booksPerPage: parseInt(document.getElementById('booksPerPageSetting').value),
        defaultView: document.getElementById('defaultViewSetting').value,
        sortingStyle: document.getElementById('sortingStyleSetting').value,
        theme: document.getElementById('themeSetting').value,
        sharingVisibility: document.getElementById('sharingVisibilitySetting').value,
        notifications: {
          newBooks: document.getElementById('newBooksNotification').checked,
          loanReminders: document.getElementById('loanRemindersNotification').checked,
          sharedCollections: document.getElementById('sharedCollectionsNotification').checked,
        },
      };

      // Update user preferences via API
      const response = await apiService.updateUserProfile({ preferences });

      // Update local user data
      this.currentUser.preferences = { ...this.currentUser.preferences, ...preferences };

      this.closeUserSettings();
      this.showToast('Settings saved successfully', 'success');

      // Apply theme if changed
      this.applyTheme(preferences.theme);
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showToast('Failed to save settings', 'error');
    }
  }

  applyTheme(theme) {
    const body = document.body;
    body.classList.remove('theme-light', 'theme-dark');

    if (theme === 'light') {
      body.classList.add('theme-light');
    } else if (theme === 'dark') {
      body.classList.add('theme-dark');
    }
    // 'auto' uses system preference (default CSS)
  }

  // Book sharing methods
  showShareModal() {
    if (!this.isAuthenticated) {
      this.showToast('Please sign in to share books', 'warning');
      return;
    }

    const modal = document.getElementById('shareModal');
    modal.classList.add('active');

    // Populate books for selection
    this.populateBookSelection();
  }

  closeShareModal() {
    const modal = document.getElementById('shareModal');
    modal.classList.remove('active');
  }

  populateBookSelection() {
    const container = document.getElementById('bookSelectionContainer');
    const userBooks = this.books.filter(book => book.ownerId === this.currentUser?.sub);

    container.innerHTML = userBooks
      .map(
        book => `
      <label class="book-selection-item">
        <input type="checkbox" name="selectedBooks" value="${book.isbn}" />
        <span class="book-title">${book.title}</span>
        <span class="book-author">${book.authors.join(', ')}</span>
      </label>
    `
      )
      .join('');
  }

  async shareBooks(event) {
    event.preventDefault();

    try {
      const emails = document
        .getElementById('shareEmailsInput')
        .value.split(',')
        .map(email => email.trim())
        .filter(email => email);

      const selectedBooks = Array.from(
        document.querySelectorAll('input[name="selectedBooks"]:checked')
      ).map(input => input.value);

      const permissions = {
        canView: true,
        canEdit: document.getElementById('canEditPermission').checked,
        canShare: document.getElementById('canSharePermission').checked,
      };

      if (emails.length === 0) {
        this.showToast('Please enter at least one email address', 'warning');
        return;
      }

      if (selectedBooks.length === 0) {
        this.showToast('Please select at least one book to share', 'warning');
        return;
      }

      // Share books via API
      for (const isbn of selectedBooks) {
        await apiService.shareBook(isbn, { emails, permissions });
      }

      this.closeShareModal();
      this.showToast(`Successfully shared ${selectedBooks.length} books`, 'success');
    } catch (error) {
      console.error('Failed to share books:', error);
      this.showToast('Failed to share books', 'error');
    }
  }

  async renderSharedBooks() {
    if (!this.isAuthenticated) return;

    try {
      const sharedBooks = await apiService.getSharedBooks();
      const container = document.getElementById('sharedBooksContainer');

      if (sharedBooks.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <h3>No shared books yet</h3>
            <p>Books shared with you or by you will appear here.</p>
          </div>
        `;
        return;
      }

      // Render shared books with sharing info
      container.innerHTML = sharedBooks.map(book => this.createBookCard(book, true)).join('');
    } catch (error) {
      console.error('Failed to load shared books:', error);
      this.showToast('Failed to load shared books', 'error');
    }
  }

  applySharedFilters() {
    const filter = document.getElementById('sharedFilter').value;
    // Implementation for filtering shared books
    this.renderSharedBooks();
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new MagpieApp();
});

export default MagpieApp;
