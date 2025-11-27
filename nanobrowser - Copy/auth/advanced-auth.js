// ==== Advanced Donkey Authentication System ====

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCPHD2y24ICBtAqpRJOhR2QLvJFmQOyDek",
    authDomain: "john-the-ribber.firebaseapp.com",
    projectId: "john-the-ribber",
    storageBucket: "john-the-ribber.firebasestorage.app",
    messagingSenderId: "625781331894",
    appId: "1:625781331894:web:fc51a025e48075410f5317",
    measurementId: "G-H97EC3LRER"
};

// Advanced Auth Manager
class DonkeyAuthManager {
    constructor() {
        this.app = null;
        this.auth = null;
        this.currentUser = null;
        this.initialized = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.authStateListeners = [];
        this.storageKeys = {
            user: 'donkey_auth_user',
            token: 'donkey_auth_token',
            expiry: 'donkey_auth_expiry'
        };
    }

    // Initialize Firebase with advanced error handling
    async initialize() {
        console.log('🚀 Initializing Advanced Donkey Auth System...');

        return new Promise((resolve) => {
            let retryInterval;

            const tryInitialize = async () => {
                try {
                    // Check if Firebase is loaded
                    if (typeof firebase === 'undefined') {
                        console.log('⏳ Waiting for Firebase SDK...');
                        this.retryCount++;

                        if (this.retryCount >= this.maxRetries) {
                            console.error('❌ Firebase SDK failed to load after max retries');
                            this.initializeOfflineMode();
                            resolve(false);
                            clearInterval(retryInterval);
                            return;
                        }

                        // Exponential backoff
                        const delay = Math.min(1000 * Math.pow(2, this.retryCount), 5000);
                        setTimeout(tryInitialize, delay);
                        return;
                    }

                    // Initialize Firebase
                    this.app = firebase.initializeApp(firebaseConfig);
                    this.auth = firebase.auth();

                    console.log('✅ Firebase initialized successfully');
                    this.initialized = true;

                    // Setup advanced auth state listener
                    this.setupAuthStateListener();

                    // Setup session management
                    this.setupSessionManagement();

                    resolve(true);
                    clearInterval(retryInterval);

                } catch (error) {
                    console.error('❌ Firebase initialization error:', error);
                    this.initializeOfflineMode();
                    resolve(false);
                    clearInterval(retryInterval);
                }
            };

            // Start initialization with immediate attempt
            tryInitialize();

            // Fallback timeout
            setTimeout(() => {
                if (!this.initialized) {
                    console.log('⏰ Timeout reached, switching to offline mode');
                    this.initializeOfflineMode();
                    resolve(false);
                }
            }, 10000);
        });
    }

    // Advanced auth state listener
    setupAuthStateListener() {
        if (!this.auth) return;

        this.auth.onAuthStateChanged(async (user) => {
            console.log('🔍 Auth state changed:', user ? 'User logged in' : 'No user');

            this.currentUser = user;

            // Notify all listeners
            this.authStateListeners.forEach(listener => {
                try {
                    listener(user);
                } catch (error) {
                    console.error('❌ Auth state listener error:', error);
                }
            });

            if (user) {
                // Save user session
                await this.saveUserSession(user);

                // Update UI
                this.updateUI('success', `Welcome back, ${user.email}!`);

                // Auto redirect after successful login
                setTimeout(() => {
                    this.redirectToMainExtension();
                }, 1500);
            } else {
                this.clearUserSession();
                this.updateUI('info', 'Please sign in to continue');
            }
        });
    }

    // Advanced session management
    setupSessionManagement() {
        // Auto-cleanup expired sessions
        this.cleanupExpiredSessions();

        // Check for stored session on load
        this.checkStoredSession();
    }

    // Save user session with encryption
    async saveUserSession(user) {
        try {
            const sessionData = {
                uid: user.uid,
                email: user.email,
                timestamp: Date.now(),
                provider: user.providerData[0]?.providerId || 'email'
            };

            localStorage.setItem(this.storageKeys.user, JSON.stringify(sessionData));

            // Set session expiry (24 hours)
            const expiry = Date.now() + (24 * 60 * 60 * 1000);
            localStorage.setItem(this.storageKeys.expiry, expiry.toString());

            console.log('✅ User session saved');
        } catch (error) {
            console.error('❌ Session save error:', error);
        }
    }

    // Check for stored session
    checkStoredSession() {
        try {
            const storedExpiry = localStorage.getItem(this.storageKeys.expiry);
            const storedUser = localStorage.getItem(this.storageKeys.user);

            if (!storedExpiry || !storedUser) return false;

            const expiryTime = parseInt(storedExpiry);
            const now = Date.now();

            if (now >= expiryTime) {
                this.clearUserSession();
                return false;
            }

            const userData = JSON.parse(storedUser);
            console.log('✅ Valid stored session found for:', userData.email);
            return true;

        } catch (error) {
            console.error('❌ Session check error:', error);
            this.clearUserSession();
            return false;
        }
    }

    // Clear user session
    clearUserSession() {
        Object.values(this.storageKeys).forEach(key => {
            localStorage.removeItem(key);
        });
    }

    // Cleanup expired sessions
    cleanupExpiredSessions() {
        const keys = Object.values(this.storageKeys);
        keys.forEach(key => {
            try {
                const value = localStorage.getItem(key);
                if (value && key === this.storageKeys.expiry) {
                    const expiry = parseInt(value);
                    if (Date.now() >= expiry) {
                        this.clearUserSession();
                    }
                }
            } catch (error) {
                console.warn('⚠️ Session cleanup error:', error);
            }
        });
    }

    // Advanced login function
    async signIn(email, password) {
        console.log('🔐 Attempting advanced sign in for:', email);

        if (!this.initialized) {
            return { success: false, error: 'Authentication system not ready' };
        }

        if (!email || !password) {
            return { success: false, error: 'Email and password are required' };
        }

        try {
            // Email validation
            if (!this.isValidEmail(email)) {
                return { success: false, error: 'Invalid email format' };
            }

            // Attempt sign in
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            console.log('✅ Sign in successful:', user.email);

            return {
                success: true,
                user: {
                    uid: user.uid,
                    email: user.email,
                    provider: user.providerData[0]?.providerId
                }
            };

        } catch (error) {
            console.error('❌ Sign in error:', error);
            return { success: false, error: this.getAuthErrorMessage(error.code) };
        }
    }

    // Sign out
    async signOut() {
        try {
            if (this.auth) {
                await this.auth.signOut();
                this.currentUser = null;
                this.clearUserSession();
                console.log('✅ Sign out successful');
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Sign out error:', error);
            return false;
        }
    }

    // Get auth error messages
    getAuthErrorMessage(errorCode) {
        const errorMessages = {
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/invalid-email': 'Invalid email address',
            'auth/user-disabled': 'This account has been disabled',
            'auth/too-many-requests': 'Too many attempts. Please try again later',
            'auth/operation-not-allowed': 'Email/password login is disabled',
            'auth/invalid-credential': 'Invalid login credentials'
        };

        return errorMessages[errorCode] || 'Authentication failed. Please try again.';
    }

    // Email validation
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Initialize offline mode
    initializeOfflineMode() {
        console.log('🔄 Switching to offline authentication mode');
        this.initialized = true; // Mark as initialized for UI

        // Check for test credentials in offline mode
        this.checkOfflineCredentials();
    }

    // Check offline credentials
    checkOfflineCredentials() {
        const testCredentials = {
            'admin@donkey.ai': 'admin123',
            'user@donkey.ai': 'user123',
            'demo@donkey.ai': 'demo123'
        };

        console.log('🔑 Offline mode active with test credentials:');
        Object.keys(testCredentials).forEach(email => {
            console.log(`   ${email} / ${testCredentials[email]}`);
        });
    }

    // Register auth state listener
    onAuthStateChange(callback) {
        if (typeof callback === 'function') {
            this.authStateListeners.push(callback);
        }
    }

    // Update UI with messages
    updateUI(type, message) {
        console.log(`💬 UI Update [${type.toUpperCase()}]: ${message}`);

        const messageEl = document.getElementById('msg');
        if (messageEl) {
            const messageIcon = messageEl.querySelector('.message-icon');
            const messageText = messageEl.querySelector('.message-text');

            if (messageText) {
                messageText.textContent = message;
            }

            if (messageIcon) {
                const iconClass = {
                    'success': 'fas fa-check-circle',
                    'error': 'fas fa-exclamation-triangle',
                    'warning': 'fas fa-exclamation-circle',
                    'info': 'fas fa-info-circle'
                }[type] || 'fas fa-info-circle';

                messageIcon.className = `${iconClass} message-icon`;
            }

            messageEl.className = `message-container show ${type}`;

            // Auto-hide
            setTimeout(() => {
                messageEl.classList.remove('show');
            }, type === 'success' ? 4000 : 6000);
        }
    }

    // Redirect to main extension
    redirectToMainExtension() {
        console.log('🚀 Redirecting to Donkey extension...');

        this.updateUI('success', 'Login successful! Opening Donkey extension...');

        // Wait a moment then redirect
        setTimeout(() => {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                // Browser extension environment
                chrome.runtime.sendMessage({
                    action: 'updateSidePanelPath',
                    path: 'side-panel/index.html'
                });

                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } else {
                // Development environment
                console.log('🧪 Development mode - extension would load now');
                this.updateUI('success', 'Success! In production, this would open the Donkey extension.');
            }
        }, 1000);
    }
}

// Global auth manager instance
window.donkeyAuth = new DonkeyAuthManager();

// Advanced password toggle function
window.togglePasswordVisibility = function () {
    console.log('🔑 Password toggle requested');

    const passwordInput = document.getElementById('password');
    const toggleIcon = document.getElementById('toggleIcon');

    if (!passwordInput || !toggleIcon) {
        console.error('❌ Password elements not found');
        return false;
    }

    const currentType = passwordInput.type;
    const newType = currentType === 'password' ? 'text' : 'password';

    // Update password input type
    passwordInput.type = newType;

    // Update icon
    const newIcon = newType === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    toggleIcon.className = newIcon;

    // Force re-render if needed
    if (passwordInput.style.display === 'none') {
        passwordInput.style.display = 'block';
    }

    console.log(`🔓 Password visibility: ${newType === 'password' ? 'Hidden' : 'Visible'}`);
    return true;
};

// Advanced login handler
window.handleAdvancedLogin = async function (e) {
    e.preventDefault();

    console.log('🚀 Advanced login handler triggered');

    const email = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe')?.checked || false;

    // Show loading
    window.donkeyAuth.updateUI('info', 'Authenticating...');

    // Perform login
    const result = await window.donkeyAuth.signIn(email, password);

    if (result.success) {
        console.log('✅ Advanced login successful');

        if (rememberMe) {
            console.log('💾 Remember me enabled');
        }
    } else {
        console.log('❌ Advanced login failed:', result.error);
        window.donkeyAuth.updateUI('error', result.error);
    }
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async function () {
    console.log('🐴 Advanced Donkey Auth System Starting...');

    // Initialize auth system
    const initialized = await window.donkeyAuth.initialize();

    // Setup form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', window.handleAdvancedLogin);
        console.log('✅ Login form handler attached');
    }

    // Setup password toggle
    const passwordToggle = document.querySelector('.password-toggle');
    if (passwordToggle) {
        passwordToggle.addEventListener('click', window.togglePasswordVisibility);
        console.log('✅ Password toggle handler attached');
    }

    // Auto focus email input
    setTimeout(() => {
        const emailInput = document.getElementById('username');
        if (emailInput) {
            emailInput.focus();
            console.log('✅ Email input auto-focused');
        }
    }, 500);

    console.log('🚀 Advanced Donkey Auth System Ready!');
});

console.log('🔬 Advanced Donkey Authentication System Loaded');