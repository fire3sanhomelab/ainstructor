# ainstructor

AI Language Instructor — learn Cantonese & Mandarin with AI dialogue and pronunciation feedback.

## Features

- 🤖 AI conversation practice (Cantonese / Mandarin)
- 🎤 Speech recognition & pronunciation feedback
- 🎭 Scenario-based roleplay (restaurant, taxi, shopping, etc.)
- 💾 Chat history & progress tracking
- 📱 PWA — install on mobile/desktop

## Architecture

```
ainstructor/
├── src/              # Vue 3 frontend
├── backend/          # Express.js API
├── docker/           # Docker configs
└── docker-compose.yml
```

## Quick Start

### Local Dev

```bash
# Terminal 1 - backend
cd backend
npm install
npm run dev

# Terminal 2 - frontend
cd ..
npm install
npm run dev
# Opens at http://localhost:3001
```

### Docker

```bash
docker-compose up -d
# Frontend: http://localhost:3001
# Backend API: http://localhost:3456
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://host.docker.internal:11434` | Local Ollama instance |
| `LLM_STUDIO_URL` | `http://192.168.1.100:1234` | LM Studio fallback |

## Tech Stack

- **Frontend:** Vue 3, Vite, Vite PWA
- **Backend:** Express, WebSocket, node-fetch
- **AI:** Ollama (opencode-go/kimi-k2.6), LM Studio

## License

MIT
