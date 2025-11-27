// ==== Simple Donkey Login System ====

// Load encrypted credentials
let credentials = [];

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function () {
  console.log('🐴 Donkey Login Starting...');

  // Load credentials
  loadCredentials();

  // Setup form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Focus username
  setTimeout(() => {
    const usernameInput = document.getElementById('username');
    if (usernameInput) usernameInput.focus();
  }, 500);
});

// Load credentials from JSON file
async function loadCredentials() {
  try {
    const response = await fetch('credentials.json');
    credentials = await response.json();
    console.log(`✅ Loaded ${credentials.length} credentials`);
  } catch (error) {
    console.error('❌ Failed to load credentials:', error);
    showMessage('Failed to load credentials. Please try again.', 'error');
  }
}

// Handle login
async function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  console.log('🔍 Login attempt for:', username);

  // Validation
  if (!username || !password) {
    showMessage('Please enter both username and password.', 'error');
    return;
  }

  if (credentials.length === 0) {
    showMessage('System not ready. Please wait...', 'error');
    return;
  }

  try {
    showLoading(true);

    // Encode username and hash password
    const encodedUsername = btoa(username);
    const hashedPassword = await sha256(password);

    console.log('🔐 Encoded username:', encodedUsername);
    console.log('🔐 Hashed password:', hashedPassword);

    // Find matching credentials
    const match = credentials.find(cred =>
      cred.u === encodedUsername && cred.p === hashedPassword
    );

    if (match) {
      console.log('✅ Login successful!');
      showMessage('Welcome to Donkey! Redirecting...', 'success');

      // Store login status
      localStorage.setItem('donkeyLoggedIn', 'true');
      localStorage.setItem('donkeyUsername', username);

      // Redirect to side panel after delay
      setTimeout(() => {
        redirectToSidePanel();
      }, 1500);

    } else {
      console.log('❌ Invalid credentials');
      showMessage('Invalid username or password.', 'error');
    }

  } catch (error) {
    console.error('💥 Login error:', error);
    showMessage('Login failed. Please try again.', 'error');
  } finally {
    showLoading(false);
  }
}

// SHA-256 hash function
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Redirect to side panel
function redirectToSidePanel() {
  console.log('🚀 Redirecting to side panel...');

  try {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        action: 'redirectToSidePanel'
      });
    }

    // Close login window
    setTimeout(() => {
      if (window.location.href.includes('auth/index.html')) {
        window.close();
      }
    }, 500);

  } catch (error) {
    console.log('Chrome runtime not available:', error);
    showMessage('Login successful! Please open Donkey extension.', 'success');
  }
}

// Show message
function showMessage(text, type = 'info') {
  console.log(`💬 ${type.toUpperCase()}: ${text}`);

  const messageEl = document.getElementById('message');
  if (!messageEl) return;

  messageEl.textContent = text;
  messageEl.className = `message ${type}`;

  // Show with animation
  setTimeout(() => {
    messageEl.classList.add('show');
  }, 100);

  // Auto-hide after 5 seconds
  setTimeout(() => {
    messageEl.classList.remove('show');
  }, 5000);
}

// Show loading state
function showLoading(loading) {
  const loginBtn = document.querySelector('.login-btn');
  if (!loginBtn) return;

  if (loading) {
    loginBtn.disabled = true;
    loginBtn.classList.add('loading');
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
  } else {
    loginBtn.disabled = false;
    loginBtn.classList.remove('loading');
    loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
  }
}

// Toggle password visibility
window.togglePassword = function () {
  const passwordInput = document.getElementById('password');
  const toggleIcon = document.getElementById('toggleIcon');

  if (!passwordInput || !toggleIcon) return;

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleIcon.className = 'fas fa-eye-slash';
  } else {
    passwordInput.type = 'password';
    toggleIcon.className = 'fas fa-eye';
  }
};

console.log('🚀 Donkey Login System Ready');
