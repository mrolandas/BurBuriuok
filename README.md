# Moxlai

**A tool to dynamically create curriculum, study material, and tests — everything needed to learn any subject.**

## Quick Links

| Environment | Frontend | Backend |
|-------------|----------|---------||
| Production | [mrolandas.github.io/Moxlai](https://mrolandas.github.io/Moxlai) | [burburiuok.onrender.com](https://burburiuok.onrender.com)\* |
| Local | http://localhost:5173 | http://localhost:3001 |

\* _Legacy Render URL - will be migrated in a future update._

## What is Moxlai?

Moxlai is a multi-subject learning platform that:

- **Dynamically generates curriculum** using AI (Google Gemini)
- **Creates study materials** with definitions, explanations, and media
- **Builds adaptive tests** that respond to learner progress
- **Tracks mastery** across concepts and subjects

### Current Demo: Lithuanian Sailing

The platform currently showcases the LBS (Lithuanian Sailing Association) curriculum as a proof-of-concept. This demonstrates the full content pipeline while the multi-subject architecture is being built.

## Getting Started

```bash
# Clone
git clone https://github.com/mrolandas/Moxlai.git
cd Moxlai

# Install
npm install
npm install --prefix frontend

# Configure (copy .env.example and fill in values)
cp .env.example .env

# Run
npm run backend:dev   # Terminal 1
npm run frontend:dev  # Terminal 2
```

See [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) for detailed setup.

## Documentation

| Document                                      | Purpose               |
| --------------------------------------------- | --------------------- |
| [GETTING_STARTED.md](docs/GETTING_STARTED.md) | Developer setup guide |
| [ROADMAP.md](docs/ROADMAP.md)                 | Feature priorities    |
| [architecture/](docs/architecture/)           | System design docs    |
| [deployment/](docs/deployment/)               | Hosting guides        |

## Tech Stack

- **Frontend**: SvelteKit + TypeScript (GitHub Pages)
- **Backend**: Express.js + TypeScript (Render.com)
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **AI**: Google Gemini for content generation

## Deployment

Frontend deploys automatically to GitHub Pages on push to `main`.
Backend deploys to Render.com from the same branch.

Override the base path with `VITE_APP_BASE_PATH` when testing locally; the default (`/Moxlai`) matches the GitHub Pages project URL.

## License

ISC
