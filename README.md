# GRID//15 — High-Speed Multiplayer 3D Formula Racing

A high-speed, server-authoritative 3D formula racing web application built with React, Three.js, and WebSocket multiplayer synchronization.

## Features

- **Server-Authoritative Physics & 30Hz Netcode**: Client-side prediction, authoritative lag compensation, anti-cheat validation, and seamless disconnect/reconnect recovery.
- **Three.js 3D Engine**: Procedural high-downforce open-wheel race cars, dynamic shadows, Ackermann steering geometry, camera shake, slipstream drafts, and particle exhaust flames.
- **Dynamic Race Control & Room Setup**: Customizable lap counts (1–20), 4 driving physics presets (Casual, Standard, Competitive, Custom), power-up drop toggles, kinetic boost tuning, and car collision rules.
- **Multiplayer Lobby & Garage**: 15-player starting grids, customized liveries, aerodynamic body styles, wheel compounds, and persistent local storage profiles.

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` to race!

## Production Build & Run

```bash
# Build client and server bundles
npm run build

# Start production server
npm start
```

## Docker Deployment (Railway / Render / VPS)

The project includes an optimized multi-stage `Dockerfile`:

```bash
docker build -t grid15 .
docker run -p 3000:3000 grid15
```
