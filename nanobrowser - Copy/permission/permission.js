document.addEventListener('DOMContentLoaded', () => {
  console.log('🎤 Donkey AI Permission Page Initializing...');

  // Set up i18n text content
  const titleElement = document.getElementById('title');
  const descriptionElement = document.getElementById('description');
  const requestButton = document.getElementById('requestPermission');
  const statusText = document.getElementById('status');

  // Check if chrome.i18n is available (extension context)
  const isExtension = typeof chrome !== 'undefined' && chrome.i18n;

  if (isExtension) {
    titleElement.textContent = chrome.i18n.getMessage('permissions_microphone_title');
    descriptionElement.textContent = chrome.i18n.getMessage('permissions_microphone_description');
    requestButton.textContent = chrome.i18n.getMessage('permissions_microphone_grantButton');
  } else {
    // Fallback text for testing
    titleElement.textContent = 'Enable Voice Input';
    descriptionElement.textContent = 'Donkey AI needs microphone access to convert your speech to text and enable voice commands for seamless automation.';
    requestButton.innerHTML = '<i class="fas fa-microphone"></i> Grant Microphone Permission';
  }

  requestButton.addEventListener('click', async () => {
    console.log('🎤 Microphone permission requested');

    // Show loading state
    showStatus('waiting', 'Requesting microphone permission...', true);
    disableButton(requestButton);

    try {
      // Request microphone permission
      console.log('🎯 Calling getUserMedia...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('✅ Microphone permission granted successfully');

      // Permission granted - stop the tracks immediately
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('🔇 Stopped audio track:', track.label);
      });

      // Update UI with success
      showStatus('success', '🎉 Microphone permission granted! Donkey AI is ready for voice input.', false);
      updateButton(requestButton, 'success', '✅ Permission Granted');

      // Add success animation
      animateSuccess();

      // Close window after a delay
      setTimeout(() => {
        if (isExtension && window.close) {
          window.close();
        } else {
          console.log('🎊 In production, this would close the permission window');
        }
      }, 3000);

    } catch (error) {
      console.error('❌ Permission error:', error);

      let errorMessage = 'Microphone access was denied.';
      let errorCode = '';

      if (error.name === 'NotAllowedError') {
        errorMessage = '❌ Microphone permission was denied by the user.';
        errorCode = 'NOT_ALLOWED';
      } else if (error.name === 'NotFoundError') {
        errorMessage = '❌ No microphone was found on this device.';
        errorCode = 'NOT_FOUND';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = '❌ Microphone access is not supported on this browser.';
        errorCode = 'NOT_SUPPORTED';
      } else if (error.name === 'NotReadableError') {
        errorMessage = '❌ Microphone is being used by another application.';
        errorCode = 'NOT_READABLE';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = '❌ Microphone constraints could not be satisfied.';
        errorCode = 'OVERCONSTRAINED';
      } else {
        errorMessage = `❌ Unexpected error: ${error.message}`;
        errorCode = 'UNKNOWN';
      }

      showStatus('error', errorMessage, false);
      updateButton(requestButton, 'error', '❌ Try Again');

      // Re-enable button for retry
      enableButton(requestButton);

      // Log error for debugging
      console.error(`🎤 Microphone permission error (${errorCode}):`, error);
    }
  });

  // Check if permission is already granted
  checkExistingPermission();

  // Add visual feedback for button interactions
  addButtonInteractions();
});

/**
 * Show status message with loading animation
 */
function showStatus(type, message, showLoading = false) {
  const statusText = document.getElementById('status');

  if (showLoading) {
    statusText.innerHTML = `
      <div class="loading"></div>
      ${message}
    `;
  } else {
    statusText.innerHTML = message;
  }

  statusText.className = `status ${type}`;
  statusText.style.display = 'block';

  // Trigger slide animation
  setTimeout(() => {
    statusText.style.animation = 'statusSlide 0.5s ease-out';
  }, 10);
}

/**
 * Update button appearance and state
 */
function updateButton(button, state, text) {
  button.disabled = true;

  switch (state) {
    case 'success':
      button.style.background = 'linear-gradient(135deg, #10ff00 0%, #00cc00 100%)';
      button.style.borderColor = '#10ff00';
      break;
    case 'error':
      button.style.background = 'linear-gradient(135deg, #ff4757 0%, #ff3838 100%)';
      button.style.borderColor = '#ff4757';
      break;
    default:
      button.style.background = '';
      button.style.borderColor = '';
  }

  button.innerHTML = text;
}

/**
 * Disable button with visual feedback
 */
function disableButton(button) {
  button.disabled = true;
  button.style.opacity = '0.6';
  button.style.cursor = 'not-allowed';

  // Change to loading state
  button.innerHTML = '<div class="loading"></div> Processing...';
}

/**
 * Enable button for retry
 */
function enableButton(button) {
  button.disabled = false;
  button.style.opacity = '1';
  button.style.cursor = 'pointer';

  // Reset to original state
  button.innerHTML = '<i class="fas fa-microphone"></i> Grant Microphone Permission';
}

/**
 * Add success animation effects
 */
function animateSuccess() {
  // Add success glow effect
  document.body.style.animation = 'successGlow 2s ease-out';

  // Animate microphone icon
  const micIcon = document.querySelector('.mic-icon');
  if (micIcon) {
    micIcon.style.animation = 'micSuccess 1s ease-out';
  }

  // Add confetti effect (simple version)
  createConfetti();
}

/**
 * Create simple confetti effect
 */
function createConfetti() {
  const colors = ['#FFD700', '#FFFF00', '#FFA500', '#10ff00'];

  for (let i = 0; i < 20; i++) {
    const confetti = document.createElement('div');
    confetti.style.cssText = `
      position: fixed;
      width: 10px;
      height: 10px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      top: 50%;
      left: 50%;
      z-index: 1000;
      pointer-events: none;
      border-radius: 50%;
      animation: confettiFall 3s ease-out forwards;
    `;

    // Random direction
    const angle = (Math.PI * 2 * i) / 20;
    const velocity = 100 + Math.random() * 100;
    confetti.style.setProperty('--velocity-x', Math.cos(angle) * velocity + 'px');
    confetti.style.setProperty('--velocity-y', Math.sin(angle) * velocity + 'px');

    document.body.appendChild(confetti);

    // Remove after animation
    setTimeout(() => {
      if (confetti.parentNode) {
        confetti.parentNode.removeChild(confetti);
      }
    }, 3000);
  }
}

/**
 * Check if permission is already granted
 */
function checkExistingPermission() {
  if ('permissions' in navigator) {
    navigator.permissions
      .query({ name: 'microphone' })
      .then(permissionStatus => {
        console.log('🔍 Current permission status:', permissionStatus.state);

        if (permissionStatus.state === 'granted') {
          const statusText = document.getElementById('status');
          statusText.textContent = '✅ Microphone permission already granted!';
          statusText.className = 'status success';
          statusText.style.display = 'block';

          updateButton(document.getElementById('requestPermission'), 'success', '✅ Already Granted');
        }
      })
      .catch(err => {
        console.log('ℹ️ Permission query not supported:', err);
      });
  }
}

/**
 * Add button interaction effects
 */
function addButtonInteractions() {
  const button = document.getElementById('requestPermission');

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-5px) scale(1.05)';
  });

  button.addEventListener('mouseleave', () => {
    if (!button.disabled) {
      button.style.transform = 'translateY(0) scale(1)';
    }
  });

  button.addEventListener('mousedown', () => {
    if (!button.disabled) {
      button.style.transform = 'translateY(-2px) scale(1.02)';
    }
  });

  button.addEventListener('mouseup', () => {
    if (!button.disabled) {
      button.style.transform = 'translateY(-5px) scale(1.05)';
    }
  });
}

// Add CSS animations for success effects
const style = document.createElement('style');
style.textContent = `
  @keyframes successGlow {
    0% { box-shadow: 0 0 50px rgba(255, 215, 0, 0.5); }
    50% { box-shadow: 0 0 100px rgba(16, 255, 0, 0.8), 0 0 150px rgba(255, 215, 0, 0.6); }
    100% { box-shadow: 0 0 50px rgba(255, 215, 0, 0.5); }
  }
  
  @keyframes micSuccess {
    0% { transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 20px var(--neon-yellow)); }
    50% { transform: scale(1.3) rotate(10deg); filter: drop-shadow(0 0 40px #10ff00); }
    100% { transform: scale(1.1) rotate(0deg); filter: drop-shadow(0 0 30px #10ff00); }
  }
  
  @keyframes confettiFall {
    0% {
      transform: translate(-50%, -50%) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translate(calc(-50% + var(--velocity-x)), calc(-50% + var(--velocity-y))) rotate(360deg);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

console.log('🎤 Donkey AI Permission Page Ready');
