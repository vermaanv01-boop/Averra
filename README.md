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
| `AUTH_RATE_LIMIT_MAX` | No | `10` | Maximum registration/login requests per window per IP |
| `MESSAGE_RATE_LIMIT_WINDOW_MS` | No | `60000` | Message rate-limit window in milliseconds |
| `MESSAGE_RATE_LIMIT_MAX` | No | `30` | Maximum messages a user may send per message window (REST and Socket.IO) |
| `JWT_SECRET` | Production only | none | Secret used to sign access tokens; required in production |
| `JWT_EXPIRES_IN` | No | `7d` | Access token lifetime |
| `BCRYPT_SALT_ROUNDS` | No | `12` | Password hashing cost |

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
| `npm run test --workspace server` | Run the backend test suite against an in-memory MongoDB |

## API

Successful responses use `{ "success": true, "data": ... }`; errors use `{ "success": false, "message": ..., "details": ... }`.

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | No | Server status, uptime, timestamp, and database state |
| `POST` | `/api/auth/register` | No | Create an account and receive a token |
| `POST` | `/api/auth/login` | No | Log in and receive a token |
| `POST` | `/api/auth/logout` | Yes | Revoke the current token |
| `GET` | `/api/users/me` | Yes | Get the authenticated user's profile |
| `PATCH` | `/api/users/me` | Yes | Edit the authenticated user's profile |
| `GET` | `/api/users/:username` | No | Get a public profile |
| `GET` | `/api/skills` | Yes | List the authenticated user's skills |
| `POST` | `/api/skills` | Yes | Add a teach or learn skill |
| `PATCH` | `/api/skills/:id` | Yes | Edit one of the authenticated user's skills |
| `DELETE` | `/api/skills/:id` | Yes | Delete one of the authenticated user's skills |
| `GET` | `/api/discovery/users` | No | Search public profiles by skill, category, and proficiency |
| `GET` | `/api/discovery/matches` | Yes | Find users who teach the current user's wanted skills |
| `POST` | `/api/exchange-requests` | Yes | Send an exchange request |
| `GET` | `/api/exchange-requests` | Yes | List incoming, outgoing, or all requests |
| `GET` | `/api/exchange-requests/:id` | Yes | Get a request the user participates in |
| `PATCH` | `/api/exchange-requests/:id/accept` | Yes | Accept an incoming pending request |
| `PATCH` | `/api/exchange-requests/:id/reject` | Yes | Reject an incoming pending request |
| `PATCH` | `/api/exchange-requests/:id/cancel` | Yes | Cancel an outgoing pending request |
| `PATCH` | `/api/exchange-requests/:id/complete` | Yes | Complete an accepted request |
| `POST` | `/api/sessions` | Yes | Propose a session for an accepted exchange request |
| `GET` | `/api/sessions` | Yes | List sessions with status, date-range, sort, and pagination filters |
| `GET` | `/api/sessions/upcoming` | Yes | List confirmed or awaiting-reschedule future sessions |
| `GET` | `/api/sessions/pending-invitations` | Yes | List pending proposals received by the user |
| `GET` | `/api/sessions/completed` | Yes | List completed sessions |
| `GET` | `/api/sessions/cancelled` | Yes | List cancelled sessions |
| `GET` | `/api/sessions/:id` | Yes | Get a session the user participates in |
| `PATCH` | `/api/sessions/:id/accept` | Yes | Accept a pending session proposal |
| `PATCH` | `/api/sessions/:id/decline` | Yes | Decline a pending session proposal |
| `POST` | `/api/sessions/:id/reschedule-requests` | Yes | Propose a new date, time, duration, or timezone |
| `PATCH` | `/api/sessions/:id/reschedule-requests/:proposalId/accept` | Yes | Accept a rescheduling proposal |
| `PATCH` | `/api/sessions/:id/reschedule-requests/:proposalId/reject` | Yes | Reject a rescheduling proposal |
| `PATCH` | `/api/sessions/:id/cancel` | Yes | Cancel an active session |
| `PATCH` | `/api/sessions/:id/complete` | Yes | Mark a confirmed session as completed |
| `GET` | `/api/conversations` | Yes | List the user's conversations with unread counts |
| `GET` | `/api/conversations/unread-count` | Yes | Get total and per-conversation unread counts |
| `GET` | `/api/conversations/:id` | Yes | Get one conversation the user participates in |
| `GET` | `/api/conversations/:id/messages` | Yes | List non-deleted messages chronologically (`page`, `limit`) |
| `POST` | `/api/conversations/:id/messages` | Yes | Send a message (`content`, `clientMessageId`, optional `messageType`) |
| `PATCH` | `/api/conversations/:id/read` | Yes | Mark the other participant's messages as read |
| `PATCH` | `/api/messages/:id` | Yes | Edit one of the user's own messages (`content`) |
| `DELETE` | `/api/messages/:id` | Yes | Soft-delete one of the user's own messages |

Session proposals require an accepted exchange request and derive both participants from that request. Times are sent as a local `scheduledDate`, `startTime`, `duration`, and IANA `timezone`; the service stores `startAt`/`endAt` in UTC, rejects invalid or DST-nonexistent local times, and blocks overlapping confirmed sessions for the same participants.

## Real-time messaging

Conversations are created automatically when an exchange request is accepted. Each accepted request has exactly one conversation, and only its two participants can read or write messages. Messages are persisted before being broadcast; deleted messages are kept in MongoDB with `deletedAt` set but are removed from history and previews.

### Authentication

All conversation and message REST routes require `Authorization: Bearer <token>`. Socket.IO uses the same JWT: pass it during the handshake as `auth: { token }` or as an `Authorization: Bearer <token>` header. Revoked and expired tokens are rejected. Socket connections automatically join all conversation rooms the user is a member of; sockets also have a personal room for presence and read events.

### Socket events

Client to server (events with an acknowledgement callback receive `{ ok, ... }`):

| Event | Payload | Description |
| --- | --- | --- |
| `conversation:join` | `{ conversationId }` | Join a conversation room after membership verification |
| `conversation:leave` | `{ conversationId }` | Leave a conversation room |
| `message:send` | `{ conversationId, content, clientMessageId, messageType? }` | Persist and broadcast a text message; duplicate keys return the original message |
| `message:read` | `{ conversationId, messageId? }` | Mark one message or all unread messages in the conversation as read |
| `typing:start` | `{ conversationId }` | Start a temporary typing indicator (expires after 3 seconds) |
| `typing:stop` | `{ conversationId }` | Clear the typing indicator |

Server to client:

| Event | Payload | Description |
| --- | --- | --- |
| `message:new` | Message object | A message was saved and delivered |
| `message:updated` | Message object | A message was edited by its sender |
| `message:deleted` | `{ id, conversationId, deletedAt }` | A message was soft-deleted |
| `message:read` | `{ conversationId, messageIds, readBy, messageId? }` | Read receipts for one or more messages |
| `typing:start` | `{ conversationId, user }` | Another participant started typing |
| `typing:stop` | `{ conversationId, user }` | Another participant stopped typing or the indicator expired |
| `presence:online` | `{ userId }` | An authorized contact came online |
| `presence:offline` | `{ userId }` | An authorized contact went offline after their final socket disconnected |

Presence and typing are in-memory only and are never written to MongoDB. Multiple connections per user are supported. Message sending is rate-limited per user across both REST and Socket.IO.

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
    ├── socket/             Socket.IO authentication, presence and typing
    ├── utils/              Shared helpers
    └── validators/         Input and environment validation
```

The backend core (authentication, profiles, skills, discovery, exchange requests, and session scheduling) is implemented. The frontend remains a minimal foundation.
