import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { createBareServer } from "@nebula-services/bare-server-node";
import chalk from "chalk";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import basicAuth from "express-basic-auth";
import mime from "mime";
import fetch from "node-fetch";
import bcrypt from "bcrypt";
import pg from "pg";
// import { setupMasqr } from "./Masqr.js";
import config from "./config.js";

console.log(chalk.yellow("🚀 Starting server..."));

const __dirname = process.cwd();
const server = http.createServer();
const app = express();
const bareServer = createBareServer("/ca/");
const PORT = process.env.PORT || 5000;
const cache = new Map();
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // Cache for 30 Days

// Database setup
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS user_sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      );
    `);
    console.log(chalk.green("✅ Database tables initialized"));
  } catch (error) {
    console.error(chalk.red("Database initialization error:"), error);
  }
}

initDatabase();

// Enable trust proxy for correct IP detection
app.set('trust proxy', true);

// Active user tracking
const activeSessions = new Map();
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

function trackUser(req, res, next) {
  let sessionId = req.cookies.sessionId;
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36)}`;
    res.cookie('sessionId', sessionId, { maxAge: SESSION_TIMEOUT, httpOnly: true });
  }
  const now = Date.now();
  activeSessions.set(sessionId, now);
  next();
}

// Clean up old sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, lastSeen] of activeSessions.entries()) {
    if (now - lastSeen > SESSION_TIMEOUT) {
      activeSessions.delete(sessionId);
    }
  }
}, 60 * 1000); // Clean up every minute

if (config.challenge !== false) {
  console.log(chalk.green("🔒 Password protection is enabled! Listing logins below"));
  // biome-ignore lint: idk
  Object.entries(config.users).forEach(([username, password]) => {
    console.log(chalk.blue(`Username: ${username}, Password: ${password}`));
  });
  app.use(basicAuth({ users: config.users, challenge: true }));
}

app.get("/e/*", async (req, res, next) => {
  try {
    if (cache.has(req.path)) {
      const { data, contentType, timestamp } = cache.get(req.path);
      if (Date.now() - timestamp > CACHE_TTL) {
        cache.delete(req.path);
      } else {
        res.writeHead(200, { "Content-Type": contentType });
        return res.end(data);
      }
    }

    const baseUrls = {
      "/e/1/": "https://raw.githubusercontent.com/qrs/x/fixy/",
      "/e/2/": "https://raw.githubusercontent.com/3v1/V5-Assets/main/",
      "/e/3/": "https://raw.githubusercontent.com/3v1/V5-Retro/master/",
    };

    let reqTarget;
    for (const [prefix, baseUrl] of Object.entries(baseUrls)) {
      if (req.path.startsWith(prefix)) {
        reqTarget = baseUrl + req.path.slice(prefix.length);
        break;
      }
    }

    if (!reqTarget) {
      return next();
    }

    const asset = await fetch(reqTarget);
    if (!asset.ok) {
      return next();
    }

    const data = Buffer.from(await asset.arrayBuffer());
    const ext = path.extname(reqTarget);
    const no = [".unityweb"];
    const contentType = no.includes(ext) ? "application/octet-stream" : mime.getType(ext);

    cache.set(req.path, { data, contentType, timestamp: Date.now() });
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch (error) {
    console.error("Error fetching asset:", error);
    res.setHeader("Content-Type", "text/html");
    res.status(500).send("Error fetching the asset");
  }
});

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(trackUser);

/* if (process.env.MASQR === "true") {
  console.log(chalk.green("Masqr is enabled"));
  setupMasqr(app);
} */

// Disable caching for static files so visual changes appear immediately on proxy
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(express.static(path.join(__dirname, "static")));
app.use("/ca", cors({ origin: true }));

// Authentication middleware
async function requireAuth(req, res, next) {
  const authSessionId = req.cookies.authSession;
  if (!authSessionId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const sessionResult = await pool.query(
      'SELECT s.*, u.username, u.email, u.created_at FROM user_sessions s JOIN users u ON s.user_id = u.id WHERE s.id = $1 AND s.expires_at > NOW()',
      [authSessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }
    
    req.user = {
      username: sessionResult.rows[0].username,
      email: sessionResult.rows[0].email,
      createdAt: sessionResult.rows[0].created_at
    };
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

// Register endpoint
app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  try {
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)',
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)',
      [username, email, passwordHash]
    );
    
    console.log(chalk.green(`✅ New user registered: ${username}`));
    res.json({ success: true, message: 'Registration successful' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login endpoint
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const user = userResult.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    await pool.query(
      'INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
      [sessionId, user.id, expiresAt]
    );
    
    res.cookie('authSession', sessionId, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    console.log(chalk.blue(`🔓 User logged in: ${username}`));
    
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout endpoint
app.post("/api/logout", async (req, res) => {
  const authSessionId = req.cookies.authSession;
  if (authSessionId) {
    try {
      await pool.query('DELETE FROM user_sessions WHERE id = $1', [authSessionId]);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  res.clearCookie('authSession');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Profile endpoint
app.get("/api/profile", requireAuth, (req, res) => {
  res.json(req.user);
});

// Standings endpoint - Fetch from ESPN API
app.get("/api/standings/:league", async (req, res) => {
  const league = req.params.league;
  const leagueUrlMap = {
    'eng.1': 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/standings',
    'esp.1': 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/standings',
    'ita.1': 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/standings',
    'ger.1': 'https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/standings',
    'fra.1': 'https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/standings'
  };
  
  if (!leagueUrlMap[league]) {
    return res.status(400).json({ error: 'Invalid league' });
  }

  try {
    const response = await fetch(leagueUrlMap[league]);
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }
    const data = await response.json();
    console.log(chalk.green(`✅ Standings data ready - ${data.standings?.[0]?.entries?.length || 0} teams`));
    res.json(data);
  } catch (error) {
    console.error('Error fetching standings:', error);
    res.status(500).json({ error: 'Failed to fetch standings data' });
  }
});

// Active users endpoint
app.get("/api/active-users", (req, res) => {
  res.json({ count: activeSessions.size, ready: true });
});

// Proxy endpoint for ESPN API to avoid CORS issues
app.get("/api/sports/:sport", async (req, res) => {
  const sportEndpoints = {
    'nfl': 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    'nba': 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    'mlb': 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
    'nhl': 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
    'soccer': 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',
    'college-football': 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard'
  };

  const sport = req.params.sport;
  if (!sportEndpoints[sport]) {
    return res.status(400).json({ error: 'Invalid sport' });
  }

  try {
    // Fetch matches for a 7-day range (2 days back, 5 days forward)
    const allEvents = [];
    for (let i = -2; i <= 4; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      // Format: YYYYMMDD for ESPN API
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;
      
      const url = `${sportEndpoints[sport]}?dates=${dateStr}`;
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.events && data.events.length > 0) {
            allEvents.push(...data.events);
          }
        }
      } catch (dateError) {
        console.warn(`Failed to fetch ${sport} for date ${dateStr}:`, dateError.message);
      }
    }
    
    // Remove duplicates (in case same event appears in multiple date ranges)
    const uniqueEvents = Array.from(new Map(allEvents.map(e => [e.id, e])).values());
    uniqueEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    console.log(chalk.blue(`📊 ${sport.toUpperCase()} - ${uniqueEvents.length} events found (7-day range)`));
    res.json({ events: uniqueEvents });
  } catch (error) {
    console.error(`Error fetching ${sport} data:`, error.message);
    res.status(500).json({ error: 'Failed to fetch sports data', details: error.message });
  }
});

// Game details endpoint
app.get("/api/game-details/:sport/:eventId", async (req, res) => {
  const { sport, eventId } = req.params;
  console.log(`[GAME DETAILS] Request for sport: ${sport}, eventId: ${eventId}`);
  
  const sportEndpoints = {
    'nfl': 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    'nba': 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    'mlb': 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
    'nhl': 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
    'soccer': 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',
    'college-football': 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard'
  };

  if (!sportEndpoints[sport]) {
    return res.status(400).json({ error: 'Invalid sport' });
  }

  try {
    const url = sportEndpoints[sport];
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`[GAME DETAILS] Failed to fetch - status ${response.status}`);
      return res.status(404).json({ error: 'Failed to fetch scoreboard' });
    }
    const data = await response.json();
    console.log(`[GAME DETAILS] Fetched ${data.events?.length || 0} events`);
    
    // Find the event in the scoreboard data
    let foundEvent = null;
    if (data.events) {
      console.log(`[GAME DETAILS] Looking for event ID: ${eventId}`);
      console.log(`[GAME DETAILS] Available IDs:`, data.events.map(e => e.id).slice(0, 3));
      foundEvent = data.events.find(e => e.id === eventId);
    }
    
    if (!foundEvent) {
      console.log(`[GAME DETAILS] Event not found!`);
      return res.status(404).json({ error: 'Game not found' });
    }
    
    console.log(`[GAME DETAILS] Found event, returning data`);
    res.json({ event: foundEvent });
  } catch (error) {
    console.error('[GAME DETAILS] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const routes = [
  { path: "/b", file: "apps.html" },
  { path: "/a", file: "games.html" },
  { path: "/play.html", file: "games.html" },
  { path: "/c", file: "settings.html" },
  { path: "/d", file: "tabs.html" },
  { path: "/m", file: "matches.html" },
  { path: "/matches", file: "matches.html" },
  { path: "/", file: "index.html" },
];

// biome-ignore lint: idk
routes.forEach(route => {
  app.get(route.path, (_req, res) => {
    res.sendFile(path.join(__dirname, "static", route.file));
  });
});

app.use((req, res, next) => {
  res.status(404).sendFile(path.join(__dirname, "static", "404.html"));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).sendFile(path.join(__dirname, "static", "404.html"));
});

server.on("request", (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

server.on("upgrade", (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

server.on("listening", () => {
  console.log(chalk.green(`🌍 Server is running on http://localhost:${PORT}`));
});

server.listen({ port: PORT });
