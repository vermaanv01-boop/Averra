# SkillSwap

SkillSwap is a full-stack application scaffold built as an npm workspaces monorepo. The client and server are independent JavaScript projects that can be developed and run separately.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer

## Getting started

1. Install all workspace dependencies from the repository root:

   ```bash
   npm install
   ```

2. Create your local environment files (never commit the filled-in copies):

   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

   On Windows PowerShell, use:

   ```powershell
   Copy-Item server/.env.example server/.env
   Copy-Item client/.env.example client/.env
   ```

3. Start both applications in development mode:

   ```bash
   npm run dev
   ```

   - Client: http://localhost:5173
   - Server health check: http://localhost:5000/health

## Environment variables

### Server (`server/.env`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | No | `5000` | HTTP port for the Express server |
| `MONGODB_URI` | No | none | MongoDB connection string; connection is skipped when empty |
| `CLIENT_ORIGIN` | No | `http://localhost:5173` | Allowed origin for CORS |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate-limit window in milliseconds |
| `RATE_LIMIT_MAX` | No | `100` | Maximum requests per window per IP |
| `JWT_SECRET` | No | none | Reserved for future authentication; supply your own secret |
| `JWT_EXPIRES_IN` | No | `7d` | Reserved for future authentication |

### Client (`client/.env`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_API_URL` | No | `http://localhost:5000` | Base URL used by the Axios service |

## Scripts

Run these from the repository root:

| Script | Description |
| --- | --- |
| `npm run dev` | Run the client and server together with live reload |
| `npm run dev:server` | Run only the Express server |
| `npm run dev:client` | Run only the Vite client |
| `npm run build` | Create the production client build in `client/dist` |
| `npm run start` | Start the Express server in production mode |
| `npm run preview` | Preview the production client build locally |

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Returns server status, uptime, timestamp, and database state |

## Project structure

```text
skillswap/
├── client/                 React + Vite + Tailwind CSS
│   └── src/
│       ├── assets/         Images, fonts, and static files
│       ├── components/     Reusable UI components
│       ├── contexts/       React contexts
│       ├── hooks/          Custom React hooks
│       ├── layouts/        Page layout wrappers
│       ├── pages/          Route-level pages
│       ├── sections/       Page sections
│       ├── services/       API clients
│       └── utils/          Frontend helpers
└── server/                 Node.js + Express
    ├── config/             Environment and database configuration
    ├── controllers/        Request handlers
    ├── middleware/         Express middleware
    ├── models/             Mongoose schemas
    ├── routes/             Route definitions
    ├── services/           Business logic
    ├── utils/              Shared helpers
    └── validators/         Input and environment validation
```

This repository intentionally contains only infrastructure and placeholder folders; application features are added later.
