// home.js
// Particles
document.addEventListener("DOMContentLoaded", event => {
  if (window.localStorage.getItem("Particles") === "true") {
    const particlesConfig = {
      particles: {
        number: {
          value: 200,
          density: {
            enable: true,
            value_area: 600,
          },
        },
        color: {
          value: "#ffffff",
        },
        shape: {
          type: "circle",
          stroke: {
            width: 0,
            color: "#000000",
          },
          polygon: {
            nb_sides: 5,
          },
          image: {
            src: "img/github.svg",
            width: 100,
            height: 100,
          },
        },
        opacity: {
          value: 1,
          random: true,
          anim: {
            enable: false,
            speed: 1,
            opacity_min: 0.1,
            sync: false,
          },
        },
        size: {
          value: 3,
          random: true,
          anim: {
            enable: false,
            speed: 40,
            size_min: 0.1,
            sync: false,
          },
        },
        line_linked: {
          enable: false,
          distance: 150,
          color: "#ffffff",
          opacity: 0.4,
          width: 1,
        },
        move: {
          enable: true,
          speed: 2,
          direction: "bottom",
          random: true,
          straight: false,
          out_mode: "out",
          bounce: false,
          attract: {
            enable: false,
            rotateX: 600,
            rotateY: 1200,
          },
        },
      },
      interactivity: {
        detect_on: "canvas",
        events: {
          onhover: {
            enable: true,
            mode: "repulse",
          },
          onclick: {
            enable: false,
            mode: "push",
          },
          resize: true,
        },
        modes: {
          grab: {
            distance: 400,
            line_linked: {
              opacity: 1,
            },
          },
          bubble: {
            distance: 400,
            size: 40,
            duration: 2,
            opacity: 8,
            speed: 3,
          },
          repulse: {
            distance: 40,
            duration: 0.4,
          },
          push: {
            particles_nb: 4,
          },
          remove: {
            particles_nb: 2,
          },
        },
      },
      retina_detect: true,
    };
    particlesJS("particles-js", particlesConfig);
  }
});
// Splash texts
let activeUserCount = 0;
let activeUserReady = false;

async function fetchActiveUsers() {
  try {
    const response = await fetch('/api/active-users');
    const data = await response.json();
    activeUserCount = data.count;
    activeUserReady = data.ready;
    
    // Update splash if currently showing active users
    if (SplashI === 0 && SplashE) {
      SplashE.innerText = SplashT[0]();
    }
  } catch (error) {
    console.error('Failed to fetch active users:', error);
    activeUserReady = false;
  }
}

fetchActiveUsers();
setInterval(fetchActiveUsers, 10000); // Update every 10 seconds

const SplashT = [
  () => activeUserReady ? `${activeUserCount} active users right now` : "Loading user count...",
  "Fastest growing proxy server",
  "Made by agent",
  "Check out discord.gg/interstellar :)",
  "Thanks for using the site",
  "Follow us on Tiktok (@useinterstellar)",
  "Subscribe to us on YouTube (@unblocking)",
  "Made by agent",
  "Check out the settings page",
  "Check out our Patreon (https://www.patreon.com/gointerstellar)",
];

let SplashI = Math.floor(Math.random() * SplashT.length);
const SplashE = document.getElementById("splash");

function US() {
  SplashI = (SplashI + 1) % SplashT.length;
  const splash = SplashT[SplashI];
  SplashE.innerText = typeof splash === 'function' ? splash() : splash;
}

const splash = SplashT[SplashI];
SplashE.innerText = typeof splash === 'function' ? splash() : splash;

SplashE.addEventListener("click", US);
// Random URL
function getRandomUrl() {
  const randomUrls = [
    "https://kahoot.it",
    "https://classroom.google.com",
    "https://drive.google.com",
    "https://google.com",
    "https://docs.google.com",
    "https://slides.google.com",
    "https://www.nasa.gov",
    "https://blooket.com",
    "https://clever.com",
    "https://edpuzzle.com",
    "https://khanacademy.org",
    "https://wikipedia.org",
    "https://dictionary.com",
  ];
  return randomUrls[randRange(0, randomUrls.length)];
}

function randRange(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}
