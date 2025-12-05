# Novaworks Proxy Server

## Overview
Novaworks (formerly Interstellar) is an Express.js-based proxy server with asset caching, active user tracking, and live sports scores. Migrated from Vercel to Replit on November 12, 2025.

## Recent Changes
- **2025-11-12**: Full rebrand and feature additions
  - Rebranded from "Interstellar" to "Novaworks"
  - Changed logo from "IN" to "NW" and increased size to 8vh
  - Changed credits from "xBubbo" to "agent"
  - Added cookie-based active user tracking with 5-minute session timeout
  - Implemented live active user count in splash text rotation
  - Created live sports scores page (/matches) with ESPN API integration
  - Added backend proxy endpoint (/api/sports/:sport) to avoid CORS issues
  - Enabled trust proxy for accurate IP detection
  - Migrated from Vercel to Replit with port 5000 configuration
  - Upgraded Node.js from v16 to v20
  - Removed all ads and analytics (Google AdSense and Google Analytics)

## Project Structure
- `index.js` - Main server file with Express app, Bare server, active user tracking, and ESPN API proxy
- `config.js` - Configuration for password protection
- `static/` - Static files served by the application
  - `index.html` - Main homepage with Novaworks branding
  - `matches.html` - Live sports scores page with multi-sport support
  - `assets/js/h1.js` - Homepage JavaScript with active user count integration
  - `assets/js/m1.js` - Navigation module with Matches tab
  - `assets/media/favicon/main.png` - Novaworks logo (NW)
- `Masqr.js` - Masquerading functionality (currently disabled)

## Environment Configuration
### Port Settings
- The server runs on port **5000** in the Replit environment
- This is configured via `process.env.PORT || 5000`

### Optional Environment Variables
- `MASQR` - Set to "true" to enable masquerading features (currently commented out)

## Password Protection
The server supports optional basic authentication:
- Set `challenge: true` in `config.js` to enable
- Configure usernames and passwords in the `users` object
- Default credentials: `username: interstellar, password: password`

## Running the Application
The server starts automatically via the configured workflow:
```bash
npm start
```

## Dependencies
- Express.js for web server
- @nebula-services/bare-server-node for proxy functionality
- Additional utilities: chalk, cors, cookie-parser, mime, node-fetch

## New Features

### Active User Tracking
- Cookie-based session tracking with unique session IDs
- 5-minute session timeout with automatic cleanup
- Real-time active user count via `/api/active-users` endpoint
- Live count displayed in rotating splash text on homepage
- Fallback handling for loading states

### Live Sports Scores
- Dedicated matches page at `/matches` accessible via navigation
- Support for multiple sports: NFL, NBA, MLB, NHL, Soccer, College Football
- Real-time score updates via ESPN API backend proxy
- Auto-refresh every 30 seconds for live games
- Responsive card-based UI with live indicators
- Backend proxy at `/api/sports/:sport` prevents CORS issues

## API Endpoints
- `/api/active-users` - Returns current active user count and ready status
- `/api/sports/:sport` - Proxies ESPN API for sports scores (sport: nfl, nba, mlb, nhl, soccer, college-football)

## Security Notes
- Password protection is disabled by default (`challenge: false`)
- Trust proxy enabled for accurate IP detection behind reverse proxies
- Session cookies are httpOnly for security
- No secrets or API keys are currently required
- Basic auth credentials are logged to console when enabled (review for production use)
