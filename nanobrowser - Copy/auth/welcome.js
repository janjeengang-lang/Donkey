// ==== Welcome Page JavaScript ====

console.log('Welcome.js loaded');

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOMContentLoaded event fired');

    // Add entrance animations
    initAnimations();

    // Setup event listeners
    setupEventListeners();

    // Initialize particle effects
    initParticleEffects();
});

// ==== Animation Initialization ====
function initAnimations() {
    // Add stagger animation to feature cards
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
        card.style.animation = 'fadeInUp 0.6s ease-out forwards';
    });

    // Add stagger animation to stats
    const statItems = document.querySelectorAll('.stat-item');
    statItems.forEach((item, index) => {
        item.style.animationDelay = `${0.5 + index * 0.1}s`;
        item.style.animation = 'fadeInUp 0.6s ease-out forwards';
    });
}

// ==== Event Listeners Setup ====
function setupEventListeners() {
    console.log('Setting up event listeners...');

    // Close modal when clicking outside
    const modalOverlay = document.getElementById('demoModal');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function (e) {
            if (e.target === modalOverlay) {
                closeDemo();
            }
        });
    }

    // Close modal with Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeDemo();
        }
    });

    // Add click event listeners to specific buttons
    const launchAppBtn = document.getElementById('launchAppBtn');
    const viewDemoBtn = document.getElementById('viewDemoBtn');
    const modalCloseBtn = document.getElementById('modalCloseBtn');

    console.log('Launch App button found:', launchAppBtn);
    console.log('View Demo button found:', viewDemoBtn);
    console.log('Modal close button found:', modalCloseBtn);

    if (launchAppBtn) {
        launchAppBtn.addEventListener('click', proceedToLogin);
        console.log('Click listener added to Launch App button');
    }

    if (viewDemoBtn) {
        viewDemoBtn.addEventListener('click', learnMore);
        console.log('Click listener added to View Demo button');
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeDemo);
        console.log('Click listener added to modal close button');
    }

    // Add hover effects to buttons
    const buttons = document.querySelectorAll('.cta-btn');
    console.log('Found', buttons.length, 'total CTA buttons');

    buttons.forEach((button, index) => {
        button.addEventListener('mouseenter', function () {
            this.style.transform = 'translateY(-2px) scale(1.02)';
        });

        button.addEventListener('mouseleave', function () {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
}

// ==== Particle Effects ====
function initParticleEffects() {
    // Create floating particles
    createParticles();

    // Add cursor glow effect
    document.addEventListener('mousemove', function (e) {
        createCursorGlow(e.clientX, e.clientY);
    });
}

function createParticles() {
    const particleContainer = document.querySelector('.bg-container');
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.cssText = `
            position: absolute;
            width: 4px;
            height: 4px;
            background: rgba(255, 215, 0, 0.6);
            border-radius: 50%;
            pointer-events: none;
            animation: floatParticle ${15 + Math.random() * 10}s infinite linear;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation-delay: ${Math.random() * 5}s;
        `;
        particleContainer.appendChild(particle);
    }
}

function createCursorGlow(x, y) {
    const glow = document.createElement('div');
    glow.style.cssText = `
        position: fixed;
        left: ${x - 50}px;
        top: ${y - 50}px;
        width: 100px;
        height: 100px;
        background: radial-gradient(circle, rgba(255, 215, 0, 0.1) 0%, transparent 70%);
        pointer-events: none;
        z-index: 1;
        border-radius: 50%;
        animation: glowFade 1s ease-out forwards;
    `;

    document.body.appendChild(glow);

    setTimeout(() => {
        if (glow.parentNode) {
            glow.parentNode.removeChild(glow);
        }
    }, 1000);
}

// ==== Main Functions ====

// Proceed to login page - FIXED VERSION
function proceedToLogin(event) {
    console.log('proceedToLogin called');
    console.log('Event:', event);

    if (event) {
        event.preventDefault();
    }

    // Add loading animation to launch button
    const button = document.getElementById('launchAppBtn');
    console.log('Button found:', button);

    if (button) {
        const originalText = button.innerHTML;
        console.log('Original button text:', originalText);

        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Loading Donkey...</span>';
        button.disabled = true;
        console.log('Button updated with loading state');
    } else {
        console.error('Launch App button not found!');
    }

    // Store welcome screen as visited
    localStorage.setItem('donkeyWelcomeVisited', 'true');
    console.log('Welcome visited status saved');

    // Navigate to side panel after a brief delay
    setTimeout(() => {
        console.log('Attempting navigation to side panel');

        try {
            // Try to redirect to side panel directly
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    action: 'redirectToSidePanel'
                });
                console.log('Side panel redirect message sent');
            }
        } catch (error) {
            console.log('Chrome runtime not available:', error);
        }

        // Alternative: try to open side panel directly
        try {
            if (typeof chrome !== 'undefined' && chrome.sidePanel) {
                chrome.sidePanel.open({ path: 'side-panel/index.html' });
                console.log('Side panel opened directly');
            }
        } catch (error) {
            console.log('Direct side panel open failed:', error);
        }

        // Close welcome window
        setTimeout(() => {
            window.close();
            console.log('Welcome page closing...');
        }, 1000);
    }, 1500);
}

// Show demo modal
function learnMore() {
    const modal = document.getElementById('demoModal');
    if (modal) {
        modal.classList.add('active');

        // Add entrance animation
        setTimeout(() => {
            modal.querySelector('.modal').style.animation = 'modalSlideIn 0.3s ease-out';
        }, 10);
    }
}

// Close demo modal
function closeDemo() {
    const modal = document.getElementById('demoModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// ==== Utility Functions ====

// Check if user has visited welcome before
function checkWelcomeStatus() {
    const visited = localStorage.getItem('donkeyWelcomeVisited');
    return visited === 'true';
}

// Show welcome stats animation
function animateStats() {
    const statNumbers = document.querySelectorAll('.stat-number');

    statNumbers.forEach(stat => {
        const finalValue = stat.textContent;
        const isPercentage = finalValue.includes('%');
        const isMultiplier = finalValue.includes('x');
        const isTime = finalValue.includes('/');

        let currentValue = 0;
        let targetValue;

        if (isPercentage) {
            targetValue = parseInt(finalValue);
        } else if (isMultiplier) {
            targetValue = parseFloat(finalValue);
        } else {
            targetValue = finalValue;
        }

        const increment = targetValue / 30; // 30 frames animation
        const timer = setInterval(() => {
            currentValue += increment;

            if (currentValue >= targetValue) {
                currentValue = targetValue;
                clearInterval(timer);
            }

            if (isPercentage) {
                stat.textContent = Math.floor(currentValue) + '%';
            } else if (isMultiplier) {
                stat.textContent = currentValue.toFixed(1) + 'x';
            } else {
                stat.textContent = finalValue; // Keep time format as is
            }
        }, 50);
    });
}

// Initialize stats animation when in view
function initStatsAnimation() {
    const statsSection = document.querySelector('.stats-dashboard');
    if (statsSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateStats();
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        observer.observe(statsSection);
    }
}

// Start stats animation after DOM load
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(initStatsAnimation, 1000);
});

// ==== CSS Animations (added dynamically) ====
const style = document.createElement('style');
style.textContent = `
    @keyframes floatParticle {
        0% {
            transform: translateY(0px) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translateY(-100vh) rotate(360deg);
            opacity: 0;
        }
    }
    
    @keyframes glowFade {
        0% {
            opacity: 1;
            transform: scale(1);
        }
        100% {
            opacity: 0;
            transform: scale(1.5);
        }
    }
    
    @keyframes modalSlideIn {
        0% {
            transform: translateY(-50px) scale(0.9);
            opacity: 0;
        }
        100% {
            transform: translateY(0) scale(1);
            opacity: 1;
        }
    }
    
    .particle {
        z-index: 0;
    }
`;
document.head.appendChild(style);

// ==== Advanced Features ====

// Keyboard navigation support
document.addEventListener('keydown', function (e) {
    switch (e.key) {
        case 'Enter':
            if (e.target.id === 'launchAppBtn') {
                e.preventDefault();
                proceedToLogin(e);
            }
            break;
        case ' ':
            if (e.target.id === 'viewDemoBtn') {
                e.preventDefault();
                learnMore();
            }
            break;
    }
});

// Performance monitoring
window.addEventListener('load', function () {
    const loadTime = performance.now();
    console.log(`Donkey Welcome loaded in ${Math.round(loadTime)}ms`);

    // Report performance metrics
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
            action: 'reportPerformance',
            metric: 'welcomeLoadTime',
            value: loadTime
        });
    }
});

// Accessibility improvements
document.addEventListener('DOMContentLoaded', function () {
    // Add ARIA labels to interactive elements
    const buttons = document.querySelectorAll('.cta-btn');
    buttons.forEach((button, index) => {
        if (button.id === 'launchAppBtn') {
            button.setAttribute('aria-label', 'Launch Donkey - Enter Application');
        } else if (button.id === 'viewDemoBtn') {
            button.setAttribute('aria-label', 'Watch Demo - See Donkey in action');
        } else if (button.id === 'modalCloseBtn') {
            button.setAttribute('aria-label', 'Close demo modal');
        } else {
            button.setAttribute('aria-label', `Welcome action ${index + 1}`);
        }

        // Add focus management for each button
        button.addEventListener('focus', function () {
            this.style.outline = '2px solid var(--primary-yellow)';
            this.style.outlineOffset = '2px';
        });

        button.addEventListener('blur', function () {
            this.style.outline = 'none';
        });
    });
});