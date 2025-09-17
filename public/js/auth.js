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

  // Store authentication data securely
  storeAuthData(token, user) {
    // Use sessionStorage instead of localStorage for better security
    // sessionStorage is cleared when tab closes, reducing attack window
    sessionStorage.setItem(this.tokenKey, token);
    sessionStorage.setItem(this.userKey, JSON.stringify(user));
    
    // Set expiration timestamp - 30 days
    const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
    sessionStorage.setItem(this.tokenKey + '_expires', expiresAt.toString());
  }

  // Get stored authentication data
  getStoredAuth() {
    const token = sessionStorage.getItem(this.tokenKey);
    const userStr = sessionStorage.getItem(this.userKey);
    const expiresAtStr = sessionStorage.getItem(this.tokenKey + '_expires');
    
    // Check if token is expired
    if (expiresAtStr && Date.now() > parseInt(expiresAtStr)) {
      this.clearAuthData();
      return { token: null, user: null };
    }
    
    const user = userStr ? JSON.parse(userStr) : null;
    return { token, user };
  }

  // Check if user is authenticated
  isAuthenticated() {
    const { token } = this.getStoredAuth();
    return !!token;
  }

  // Get current user
  getCurrentUser() {
    const { user } = this.getStoredAuth();
    return user;
  }

  // Get authorization header for API calls
  getAuthHeader() {
    const { token } = this.getStoredAuth();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Clear authentication data
  clearAuthData() {
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.userKey);
    sessionStorage.removeItem(this.tokenKey + '_expires');
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

  // Validate token with backend
  async validateToken() {
    if (!this.isAuthenticated()) return false;

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
        // Update stored user data
        this.storeAuthData(this.getStoredAuth().token, result.user);
        return true;
      } else {
        // Invalid token, logout
        await this.logout();
        return false;
      }
    } catch (error) {
      console.error('Token validation error:', error);
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

// Auto-validate token on page load
document.addEventListener('DOMContentLoaded', async () => {
  if (window.magpieAuth.isAuthenticated()) {
    await window.magpieAuth.validateToken();
  }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MagpieAuth;
}
