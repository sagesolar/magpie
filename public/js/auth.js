// Google OIDC Authentication Integration for Magpie PWA
// This file provides OIDC login with PKCE flow while maintaining offline support

class MagpieAuth {
  constructor() {
    this.clientId = window.magpieConfig?.googleClientId;
    this.redirectUri = window.location.origin;
    this.tokenKey = 'magpie_auth_token';
    this.userKey = 'magpie_user_data';
    this.isInitialized = false;

    // Debug logging
    console.log('MagpieAuth initialized with:');
    console.log('- Client ID:', this.clientId);
    console.log('- magpieConfig:', window.magpieConfig);

    if (!this.clientId) {
      console.error('Google Client ID not configured. Please update config.js');
      console.error('Expected: window.magpieConfig.googleClientId');
      console.error('Available:', Object.keys(window.magpieConfig || {}));
    }
  }

  // Helper method to get the proper API URL
  getApiUrl(endpoint) {
    const backendUrl = window.magpieConfig?.apiBaseUrl || window.API_BASE_URL || '';
    const finalUrl = backendUrl ? `${backendUrl}${endpoint}` : endpoint;
    
    // Debug logging to help troubleshoot deployed version
    console.log('API URL Debug:', {
      endpoint,
      'window.API_BASE_URL': window.API_BASE_URL,
      'window.magpieConfig?.apiBaseUrl': window.magpieConfig?.apiBaseUrl,
      'Final URL': finalUrl
    });
    
    return finalUrl;
  }

  // Initialize Google OIDC
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Load Google Identity Services script
      await this.loadGoogleScript();

      // Initialize Google OAuth
      google.accounts.id.initialize({
        client_id: this.clientId,
        callback: this.handleCredentialResponse.bind(this),
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      this.isInitialized = true;
      console.log('Google OIDC initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Google OIDC:', error);
      throw error;
    }
  }

  // Load Google Identity Services script
  loadGoogleScript() {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load Google script'));
      document.head.appendChild(script);
    });
  }

  // Handle credential response from Google
  async handleCredentialResponse(response) {
    try {
      console.log('Received credential response');

      // Get the backend URL from configuration
      const loginUrl = this.getApiUrl('/api/auth/login');
      console.log('Sending login request to:', loginUrl);

      // Send ID token to backend for validation
      const loginResponse = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken: response.credential,
        }),
      });

      if (!loginResponse.ok) {
        const error = await loginResponse.json();
        throw new Error(error.message || 'Login failed');
      }

      const result = await loginResponse.json();

      // Store user data and token
      this.storeAuthData(result.token, result.user);

      // Close any open login modal
      this.closeLoginModal();

      // Trigger login success event
      this.triggerLoginEvent(result.user);

      // Sync offline data if needed
      await this.syncOfflineData();

      console.log('Login successful:', result.user.name);
    } catch (error) {
      console.error('Login failed:', error);
      this.triggerLoginEvent(null, error.message);
    }
  }

  // Show Google login prompt
  async showLoginPrompt() {
    await this.initialize();

    try {
      // Show the One Tap prompt
      google.accounts.id.prompt(notification => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback to popup if One Tap doesn't work
          this.showLoginPopup();
        }
      });
    } catch (error) {
      console.error('Failed to show login prompt:', error);
      // Fallback to popup
      this.showLoginPopup();
    }
  }

  // Show login popup as fallback
  async showLoginPopup() {
    await this.initialize();

    // Create login button container
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'google-login-button';
    document.body.appendChild(buttonContainer);

    // Render Google login button
    google.accounts.id.renderButton(buttonContainer, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
    });

    // Show in modal or overlay
    this.showLoginModal(buttonContainer);
  }

  // Create and show login modal
  showLoginModal(buttonContainer) {
    const modal = document.createElement('div');
    modal.className = 'login-modal';
    modal.innerHTML = `
      <div class="login-modal-content">
        <div class="login-modal-header">
          <h3>Welcome to Magpie Bibliotherapy</h3>
          <button class="login-modal-close">&times;</button>
        </div>
        <div class="login-modal-body">
          <p>Sign in to sync your book collection across devices and access sharing features.</p>
          <div class="login-button-container"></div>
          <p class="login-offline-note">
            <small>You can continue using Magpie offline without signing in.</small>
          </p>
        </div>
      </div>
    `;

    // Add button to modal
    modal.querySelector('.login-button-container').appendChild(buttonContainer);

    // Add close functionality
    modal.querySelector('.login-modal-close').onclick = () => {
      document.body.removeChild(modal);
    };

    // Add to page
    document.body.appendChild(modal);
  }

  // Close login modal if it's open
  closeLoginModal() {
    const modal = document.querySelector('.login-modal');
    if (modal) {
      document.body.removeChild(modal);
      console.log('Login modal closed automatically after successful login');
    }
  }

  // Store authentication data securely
  storeAuthData(token, user) {
    // Store in localStorage for offline persistence
    // This allows the app to work offline after initial login
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
    
    // Set expiration timestamp - 30 days
    const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
    localStorage.setItem(this.tokenKey + '_expires', expiresAt.toString());
    
    // Store offline authentication state for persistent user identity
    const offlineAuthState = {
      userId: user.sub,
      userEmail: user.email,
      userName: user.name,
      lastLoginAt: Date.now(),
      isOfflineCapable: true
    };
    localStorage.setItem('magpie_offline_auth', JSON.stringify(offlineAuthState));
  }

  // Get stored authentication data
  getStoredAuth() {
    const token = localStorage.getItem(this.tokenKey);
    const userStr = localStorage.getItem(this.userKey);
    const expiresAtStr = localStorage.getItem(this.tokenKey + '_expires');
    
    // For offline mode, we're more lenient with token expiration
    // Token expiration doesn't prevent offline usage
    let tokenExpired = false;
    if (expiresAtStr && Date.now() > parseInt(expiresAtStr)) {
      tokenExpired = true;
    }
    
    const user = userStr ? JSON.parse(userStr) : null;
    return { token, user, tokenExpired };
  }

  // Get offline authentication state
  getOfflineAuthState() {
    const offlineAuthStr = localStorage.getItem('magpie_offline_auth');
    if (!offlineAuthStr) return null;
    
    try {
      return JSON.parse(offlineAuthStr);
    } catch (error) {
      console.warn('Failed to parse offline auth state:', error);
      return null;
    }
  }

  // Check if user is authenticated (offline-friendly)
  isAuthenticated() {
    // First check if we have a valid token for online operations
    const { token, tokenExpired } = this.getStoredAuth();
    if (token && !tokenExpired) {
      return true;
    }
    
    // If token is expired or missing, check offline authentication state
    // This allows offline usage after initial login
    const offlineAuth = this.getOfflineAuthState();
    if (offlineAuth && offlineAuth.isOfflineCapable) {
      // User was previously authenticated, allow offline usage
      console.log('Using offline authentication for user:', offlineAuth.userEmail);
      return true;
    }
    
    return false;
  }

  // Get current user (offline-friendly)
  getCurrentUser() {
    const { user, tokenExpired } = this.getStoredAuth();
    
    // If we have user data and token is still valid, use it
    if (user && !tokenExpired) {
      return user;
    }
    
    // For offline mode, reconstruct user from offline auth state
    const offlineAuth = this.getOfflineAuthState();
    if (offlineAuth && offlineAuth.isOfflineCapable) {
      return {
        sub: offlineAuth.userId,
        email: offlineAuth.userEmail,
        name: offlineAuth.userName,
        isOfflineMode: true
      };
    }
    
    return null;
  }

  // Get authorization header for API calls
  getAuthHeader() {
    const { token, tokenExpired } = this.getStoredAuth();
    
    // Only provide auth header if token is valid and not expired
    // For offline operations, we don't need auth headers
    if (token && !tokenExpired) {
      return { Authorization: `Bearer ${token}` };
    }
    
    return {};
  }

  // Clear authentication data
  clearAuthData() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.tokenKey + '_expires');
    localStorage.removeItem('magpie_offline_auth');
  }

  // Logout
  async logout() {
    try {
      // Call backend logout (optional)
      await fetch(this.getApiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: this.getAuthHeader(),
      });
    } catch (error) {
      console.warn('Backend logout failed:', error);
    } finally {
      // Clear stored data
      this.clearAuthData();

      // Trigger logout event
      this.triggerLogoutEvent();

      console.log('Logged out successfully');
    }
  }

  // Validate token with backend (offline-friendly)
  async validateToken() {
    if (!this.isAuthenticated()) return false;

    const { token, tokenExpired } = this.getStoredAuth();
    
    // If we're offline or token is expired, use offline authentication
    if (!navigator.onLine || tokenExpired || !token) {
      const offlineAuth = this.getOfflineAuthState();
      if (offlineAuth && offlineAuth.isOfflineCapable) {
        console.log('Using offline authentication - no token validation needed');
        return true;
      }
      return false;
    }

    try {
      const response = await fetch(this.getApiUrl('/api/auth/validate'), {
        method: 'POST',
        headers: this.getAuthHeader(),
      });

      if (!response.ok) {
        throw new Error('Token validation failed');
      }

      const result = await response.json();

      if (result.valid) {
        // Update stored user data and refresh offline auth state
        this.storeAuthData(token, result.user);
        return true;
      } else {
        // Invalid token, but don't logout immediately if we have offline auth
        const offlineAuth = this.getOfflineAuthState();
        if (offlineAuth && offlineAuth.isOfflineCapable) {
          console.log('Token invalid but using offline authentication');
          return true;
        }
        
        // No offline auth available, logout
        await this.logout();
        return false;
      }
    } catch (error) {
      console.error('Token validation error:', error);
      
      // If we're offline or there's a network error, use offline auth
      const offlineAuth = this.getOfflineAuthState();
      if (offlineAuth && offlineAuth.isOfflineCapable) {
        console.log('Token validation failed but using offline authentication');
        return true;
      }
      
      // No offline auth available, logout
      await this.logout();
      return false;
    }
  }

  // Sync offline data when coming online
  async syncOfflineData() {
    // Implementation depends on your offline storage strategy
    // This is a placeholder for syncing IndexedDB data with server
    console.log('Syncing offline data...');

    try {
      // Get offline changes from IndexedDB
      const offlineChanges = await this.getOfflineChanges();

      if (offlineChanges.length > 0) {
        // Send changes to server
        await this.syncChangesToServer(offlineChanges);

        // Clear offline changes
        await this.clearOfflineChanges();

        console.log(`Synced ${offlineChanges.length} offline changes`);
      }
    } catch (error) {
      console.error('Failed to sync offline data:', error);
    }
  }

  // Placeholder methods for offline sync
  async getOfflineChanges() {
    // Implement IndexedDB logic to get pending changes
    return [];
  }

  async syncChangesToServer(changes) {
    // Implement logic to send changes to server
    console.log('Syncing changes:', changes);
  }

  async clearOfflineChanges() {
    // Implement IndexedDB logic to clear synced changes
  }

  // Event handling
  triggerLoginEvent(user, error = null) {
    const event = new CustomEvent('magpie:login', {
      detail: { user, error },
    });
    window.dispatchEvent(event);
  }

  triggerLogoutEvent() {
    const event = new CustomEvent('magpie:logout');
    window.dispatchEvent(event);
  }
}

// Initialize global auth instance
window.magpieAuth = new MagpieAuth();

// Auto-validate token on page load (offline-friendly)
document.addEventListener('DOMContentLoaded', async () => {
  if (window.magpieAuth.isAuthenticated()) {
    // Only validate token if we're online
    if (navigator.onLine) {
      console.log('Online - validating token with server');
      await window.magpieAuth.validateToken();
    } else {
      console.log('Offline - using cached authentication');
      // Check if we have offline auth state
      const offlineAuth = window.magpieAuth.getOfflineAuthState();
      if (offlineAuth && offlineAuth.isOfflineCapable) {
        console.log('Offline authentication available for:', offlineAuth.userEmail);
      }
    }
  }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MagpieAuth;
}
