// Splash Screen Manager
class SplashScreen {
  constructor(duration = 5000) {
    this.duration = duration;
    this.startTime = null;
    this.animationFrameId = null;
    this.isActive = true;
  }

  init() {
    // Create splash screen HTML if it doesn't exist
    if (!document.getElementById('splash-screen')) {
      this.createSplashScreen();
    }

    document.body.classList.add('splash-active');
    this.startTime = Date.now();
    this.animate();
  }

  createSplashScreen() {
    const splashHTML = `
      <div id="splash-screen">
        <div class="splash-content">
          <div class="splash-logo-container">
            <img src="/assets/images/ar-logo.png" alt="AR Logo" class="splash-logo-img">
            <h1 class="splash-name">APEXRELAY</h1>
          </div>
          <div class="splash-progress-container">
            <div class="splash-percentage">0%</div>
            <div class="splash-progress-bar">
              <div class="splash-progress-fill"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', splashHTML);
  }

  animate() {
    const elapsed = Date.now() - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);
    const percentage = Math.round(progress * 100);

    // Update progress bar
    const progressFill = document.querySelector('.splash-progress-fill');
    const percentageText = document.querySelector('.splash-percentage');

    if (progressFill) {
      progressFill.style.width = percentage + '%';
    }

    if (percentageText) {
      percentageText.textContent = percentage + '%';
    }

    if (progress < 1) {
      this.animationFrameId = requestAnimationFrame(() => this.animate());
    } else {
      this.finish();
    }
  }

  finish() {
    const splashScreen = document.getElementById('splash-screen');
    if (splashScreen) {
      splashScreen.classList.add('fade-out');
    }

    // Fade out overlay and show main content
    setTimeout(() => {
      document.body.classList.remove('splash-active');
      document.body.style.overflow = 'auto';
      this.isActive = false;

      // Remove splash screen after fade out
      setTimeout(() => {
        if (splashScreen && splashScreen.parentNode) {
          splashScreen.parentNode.removeChild(splashScreen);
        }
      }, 200);
    }, 5000);
  }
}

// Initialize splash screen when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const splash = new SplashScreen(5000); // 5 seconds
  splash.init();
});

// Handle page visibility changes for tab switching
document.addEventListener('visibilitychange', () => {
  // You can add logic here to restart splash screen when returning to tab
  // For now, the splash screen only shows once per page load
});
