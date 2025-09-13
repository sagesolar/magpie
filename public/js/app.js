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

    this.init();
  }

  async init() {
    try {
      // Initialize IndexedDB
      await bookDB.init();

      // Load initial data
      await this.loadBooks();

      // Setup event listeners
      this.setupEventListeners();

      // Update UI
      this.updateConnectionStatus();
      this.renderBooks();
      this.populateGenreFilter();

      // Pre-cache cover images for offline use
      this.cacheCoverImages();

      this.isInitialized = true;
      console.log('Magpie app initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showToast('Failed to initialize app', 'error');
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

      // Try to sync with server if online
      if (navigator.onLine) {
        try {
          await apiService.syncOfflineChanges();
          // Reload after sync
          this.books = await bookDB.getAllBooks();
          this.filteredBooks = [...this.books];
        } catch (error) {
          console.warn('Sync failed, using offline data:', error);
        }
      }

      this.renderBooks();
      this.populateGenreFilter();
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
      statusText.textContent = 'Offline';
      syncButton.style.display = 'none';
    }
  }

  // Tab Management
  switchTab(tabName) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document
      .querySelectorAll('.tab-content')
      .forEach(content => content.classList.remove('active'));

    // Add active class to selected tab and content
    event.target.classList.add('active');
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

    if (!this.filteredBooks.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No books found</h3>
          <p>Start building your collection by adding books!</p>
          <button class="btn btn-primary" onclick="app.showAddBookModal()">Add Your First Book</button>
        </div>
      `;
      return;
    }

    const booksHTML = this.filteredBooks.map(book => this.renderBookCard(book)).join('');
    container.innerHTML = `<div class="books-grid">${booksHTML}</div>`;
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
        </div>
        </div>
      </div>
    `;
  }

  renderFavourites() {
    const container = document.getElementById('favouritesContainer');
    const favourites = this.books.filter(book => book.isFavourite);

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
    const wishlist = this.books.filter(book => !book.isRead);

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
    const loans = this.books.filter(book => book.loanedTo);

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
    try {
      const book = await bookDB.getBook(isbn);
      if (book) {
        book.isFavourite = !book.isFavourite;
        await bookDB.saveBook(book);
        await this.loadBooks();
        this.showToast(
          `Book ${book.isFavourite ? 'added to' : 'removed from'} favourites`,
          'success'
        );
      }
    } catch (error) {
      console.error('Toggle favourite failed:', error);
      this.showToast('Failed to update favourite status', 'error');
    }
  }

  async toggleRead(isbn) {
    try {
      const book = await bookDB.getBook(isbn);
      if (book) {
        book.isRead = !book.isRead;
        await bookDB.saveBook(book);
        await this.loadBooks();
        this.showToast(`Book marked as ${book.isRead ? 'read' : 'unread'}`, 'success');
      }
    } catch (error) {
      console.error('Toggle read failed:', error);
      this.showToast('Failed to update read status', 'error');
    }
  }

  async deleteBook(isbn) {
    if (!confirm('Are you sure you want to delete this book?')) return;

    try {
      await bookDB.deleteBook(isbn);
      await this.loadBooks();
      this.showToast('Book deleted successfully', 'success');
    } catch (error) {
      console.error('Delete failed:', error);
      this.showToast('Failed to delete book', 'error');
    }
  }

  // Modal Management
  showAddBookModal() {
    document.getElementById('modalTitle').textContent = 'Add New Book';
    document.getElementById('bookForm').reset();
    document.getElementById('bookModal').classList.add('active');
    this.currentBook = null;
  }

  async showEditModal(isbn) {
    try {
      const book = await bookDB.getBook(isbn);
      if (!book) return;

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
      needsSync: true,
    };

    try {
      await bookDB.saveBook(bookData);
      await this.loadBooks();
      this.closeModal();
      this.showToast('Book saved successfully', 'success');
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

    const syncButton = document.getElementById('syncButton');
    syncButton.textContent = '🔄 Syncing...';
    syncButton.disabled = true;

    try {
      await apiService.syncOfflineChanges();
      await this.loadBooks();
      this.showToast('Sync completed successfully', 'success');
    } catch (error) {
      console.error('Manual sync failed:', error);
      this.showToast('Sync failed', 'error');
    } finally {
      syncButton.textContent = '🔄 Sync Now';
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
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new MagpieApp();
});

export default MagpieApp;
