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
| `REVIEW_REPORT_THRESHOLD` | No | `3` | Number of unique reports that automatically flags a review for moderation |
| `JWT_SECRET` | Production only | none | Secret used to sign access tokens; required in production |
| `JWT_EXPIRES_IN` | No | `7d` | Access token lifetime (`<number><s/m/h/d/w/y>`) |
| `BCRYPT_SALT_ROUNDS` | No | `12` | Password hashing cost |
| `SENSITIVE_RATE_LIMIT_MAX` | No | `20` | Maximum requests per window on admin and review write routes |
| `REDIS_URL` | Production (unless fallback enabled) | none | `redis://` or `rediss://` URL for Socket.IO, presence, typing, and distributed rate limits |
| `ALLOW_INSECURE_NO_REDIS` | No | `false` | Explicitly allow a single-instance production deployment without Redis |
| `TRUST_PROXY` | No | `false` | Express trust-proxy setting (`true`, `false`, or hop count) |
| `LOG_LEVEL` | No | `info` | `silent`, `error`, `warn`, `info`, or `debug`; production logs are structured JSON |
| `MONGO_CONNECT_TIMEOUT_MS` | No | `10000` | Server-selection timeout for MongoDB startup |
| `MONGO_CONNECT_RETRIES` | No | `3` | Additional MongoDB connection attempts before startup fails |
| `MONGO_TRANSACTIONS_DISABLED` | No | `false` | Force the non-transactional fallback even on a replica set |
| `OUTBOX_WORKER_ENABLED` | No | `true` | Enable the notification outbox recovery/dispatch worker outside tests |
| `OUTBOX_POLL_INTERVAL_MS` | No | `5000` | Outbox worker poll interval |
| `OUTBOX_MAX_ATTEMPTS` | No | `5` | Failed deliveries before an outbox event is dead-lettered |
| `OUTBOX_CLAIM_TIMEOUT_MS` | No | `60000` | Age after which a processing claim can be recovered |
| `SHUTDOWN_TIMEOUT_MS` | No | `10000` | Forced shutdown deadline |

The `ADMIN_NAME`, `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` variables are used only by the `npm run admin:bootstrap` command. They are intentionally not part of the running server configuration and should never be committed with real values.

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
| `npm run admin:bootstrap` | Create or promote the first administrator from `ADMIN_*` variables |
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
| `GET` | `/api/notifications` | Yes | List the user's notifications (`page`, `limit`, `isRead`, `type`) with unread count |
| `GET` | `/api/notifications/unread-count` | Yes | Get the user's unread notification count |
| `PATCH` | `/api/notifications/:id/read` | Yes | Mark one of the user's notifications as read |
| `PATCH` | `/api/notifications/read-all` | Yes | Mark all of the user's notifications as read |
| `DELETE` | `/api/notifications/:id` | Yes | Delete one of the user's notifications |
| `GET` | `/api/notifications/preferences` | Yes | Get notification category preferences |
| `PATCH` | `/api/notifications/preferences` | Yes | Update `exchangeRequests`, `sessions`, and/or `messages` preferences |
| `POST` | `/api/reviews` | Yes | Review the other participant of a completed exchange |
| `GET` | `/api/reviews/user/:userId` | Yes | List visible reviews received by a user (`page`, `limit`, `sort`) |
| `GET` | `/api/reviews/exchange/:exchangeRequestId` | Yes | List visible reviews for a completed exchange (`page`, `limit`, `sort`) |
| `GET` | `/api/reviews/:id` | Yes | Get one visible review |
| `PATCH` | `/api/reviews/:id` | Yes | Edit the authenticated user's own review |
| `DELETE` | `/api/reviews/:id` | Yes | Delete the authenticated user's own review |
| `POST` | `/api/reviews/:id/report` | Yes | Report a review (`reason`, optional `details`) |
| `GET` | `/api/admin/users` | Admin | List users (`page`, `limit`, `search`, `role`, `status`, `sort`) |
| `GET` | `/api/admin/users/:id` | Admin | Get one user's administrative details |
| `PATCH` | `/api/admin/users/:id/suspend` | Admin | Suspend a user (`reason`) |
| `PATCH` | `/api/admin/users/:id/restore` | Admin | Restore a suspended user (optional `reason`) |
| `GET` | `/api/admin/reviews` | Admin | List flagged, hidden, or reported reviews (`page`, `limit`, `status`) |
| `GET` | `/api/admin/reviews/:id` | Admin | Get any review, including hidden or flagged ones |
| `PATCH` | `/api/admin/reviews/:id/moderate` | Admin | Hide or restore a review (`status`, optional `reason`) |
| `GET` | `/api/admin/reports` | Admin | List reports (`page`, `limit`, `status`, `reason`) |
| `GET` | `/api/admin/reports/:id` | Admin | Get one report with review and reporter details |
| `PATCH` | `/api/admin/reports/:id` | Admin | Resolve, dismiss, or escalate a report (`action`, `reason`) |
| `GET` | `/api/admin/statistics` | Admin | Platform counts from live database data |
| `GET` | `/api/admin/audit-logs` | Admin | List administrative audit records (`page`, `limit`, `action`, `targetType`) |

Session proposals require an accepted exchange request and derive both participants from that request. Times are sent as a local `scheduledDate`, `startTime`, `duration`, and IANA `timezone`; the service stores `startAt`/`endAt` in UTC, rejects invalid or DST-nonexistent local times, and blocks overlapping confirmed sessions for the same participants.

## Reviews, ratings and reputation

Reviews can only be created for a completed exchange request, and the reviewee is always derived from that request; clients cannot choose who is reviewed. Each participant may leave one review per exchange, self-reviews are rejected, and only the original reviewer can edit or delete a review. Ratings (`overallRating`, `teachingRating`, `learningRating`) are integers from 1 to 5, and a non-empty comment of at most 2000 characters is required.

`GET /api/reviews/user/:userId` and `GET /api/reviews/exchange/:exchangeRequestId` accept `page` (default 1), `limit` (default 20, maximum 50), and `sort` (`newest`, `oldest`, `highest`, `lowest`). Only `visible` reviews are returned publicly; `flagged` and `hidden` reviews are excluded immediately.

The `rating.service` aggregates visible reviews with a MongoDB `$facet` and stores derived stats in `User.reputation`: review count, average overall/teaching/learning ratings, a 1–5 rating distribution, completed exchange count, and a reputation score. The score is deterministic and blends review quality with exchange activity using a neutral rating of 3:

```text
score = totalReviews + completedExchanges === 0
  ? 0
  : round2((averageOverallRating * totalReviews + 3 * completedExchanges) / (totalReviews + completedExchanges))
```

Stats are recalculated when a review is created, updated, deleted, reported into a flagged state, or moderated, and when an exchange request transitions to `completed`. Users with no reviews but completed exchanges therefore have a neutral score of 3, while users with no activity have 0. The derived `reputation` object is included in public profile responses.

Any authenticated non-reviewer can report a review once using `reason` (`spam`, `abuse`, `inappropriate`, `fake`, `off_topic`, `other`) and optional `details`. Reports increment `reportCount` and preserve the reporting user. When the count reaches `REVIEW_REPORT_THRESHOLD`, the review becomes `flagged` and all moderation transitions are appended to `moderationHistory`. `reviewService.listForModeration` returns flagged, hidden, and reported reviews, and `reviewService.moderate(reviewId, status, moderatorId, note)` hides or restores a review while recording who changed it.

Creating a review stores a `review_received` notification for the reviewee through the centralized notification service, including REST history and authenticated Socket.IO delivery. The notification respects the existing `exchangeRequests` preference and is suppressed if the recipient disabled that category.

## Admin and platform management

Administrative access is a stored `User.role` of `admin` (the default is `user`). Public registration and profile updates cannot set or change `role`, `accountStatus`, or `suspension`; both the Zod validators and the user service reject those fields. `middleware/requireAdmin` checks the role on every `/api/admin` route, and every function in `services/admin.service.js` independently calls `assertAdmin` so authorization is not route-only.

There is no public admin-registration endpoint. The initial administrator is created with a controlled command that requires `MONGODB_URI` and the `ADMIN_NAME`, `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` environment variables:

```bash
npm run admin:bootstrap
```

The bootstrap refuses to run if any administrator already exists. It creates a new admin with a bcrypt-hashed password, or promotes an existing non-suspended account matching the supplied email/username without changing its password. Credentials are never hardcoded or logged. There is intentionally no role-change API; additional administrators require a separate controlled offline process, not a client request.

Suspended accounts retain their records but cannot log in, use authenticated REST routes, or connect to Socket.IO. `User.accountStatus` and `User.suspension` store the status, reason, timestamps, and responsible admin. Administrators cannot suspend themselves. Restoring preserves the original suspension details and appends restoration metadata.

`/api/admin/reviews` exposes the existing moderation service: it lists flagged, hidden, or reported reviews, returns any review by id without affecting the original record, and hides or restores reviews while appending to `moderationHistory`. `/api/admin/reports` lists and filters reports, returns report details, and records a moderator, action, reason, and timestamp for each decision; a decided report cannot be decided again.

`/api/admin/statistics` returns live counts for users (including active/suspended/admin), skills, exchange requests by status, sessions by status, messages (including soft-deleted), reviews by moderation status, and reports by status. All values come from MongoDB via `countDocuments`.

Administrative actions are appended to `AuditLog` with actor, action, target, reason, metadata, and timestamps. `GET /api/admin/audit-logs` is read-only; there are no admin update or delete routes, and Mongoose middleware rejects direct updates, deletions, or saves of existing audit records.

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

Presence, typing, and message rate-limit counters use a Redis-backed shared store when `REDIS_URL` is configured and a local in-process store otherwise; none of them are written to MongoDB. Multiple connections per user are supported, and Socket.IO uses the Redis adapter in multi-instance deployments. Message sending is rate-limited per user across both REST and Socket.IO.

## Notifications

Notifications are generated centrally by backend services from business events and stored in MongoDB before any real-time delivery. Supported types are `exchange_request`, `exchange_accepted`, `exchange_rejected`, `exchange_cancelled`, `session_invitation`, `session_confirmed`, `session_declined`, `session_rescheduled`, `session_cancelled`, `session_completed`, `new_message`, and `review_received`. A notification stores its recipient, optional acting user, type, title, message, optional related entity, creation timestamp, read state, and a read timestamp.

Generated events:

| Source | Events |
| --- | --- |
| Exchange requests | New request, accepted, rejected, cancelled |
| Sessions | Invitation, confirmed, declined, rescheduling requested, rescheduling accepted/rejected, cancelled, completed |
| Messaging | New message received |
| Reviews | Review received |

Notifications are never generated for a user's own actions, and repeated business events with the same event key create only one notification. Users cannot notify each other directly: recipients are always derived from persisted business entities. `GET /api/notifications` supports `page` (default 1), `limit` (default 20, maximum 50), `isRead` (`true`/`false`), and `type`, and returns `notifications`, `unreadCount`, and `pagination`.

Preferences are stored on the user and default to enabled for `exchangeRequests`, `sessions`, and `messages`. Disabling a category only suppresses its notifications; the underlying exchange, session, or messaging operation still succeeds. A `new_message` notification is also suppressed while the recipient is actively viewing the conversation (an authenticated socket that emitted `conversation:join` for that conversation). Typing indicators and read receipts never create notifications.

Notification events use the same authenticated Socket.IO connection and personal `user:<userId>` room as presence, so only the intended recipient receives them and all of that user's active connections are covered. Offline notifications remain persisted and are returned by the REST API on the next request.

Server to client:

| Event | Payload | Description |
| --- | --- | --- |
| `notification:new` | Notification object | A notification was persisted for the recipient |
| `notification:read` | `{ id?, ids?, isRead, readAt?, unreadCount }` | One or more notifications were marked as read |
| `notification:deleted` | `{ id, unreadCount }` | A notification was deleted |
| `notification:unread-count` | `{ unreadCount }` | The recipient's unread count changed |

Socket delivery failures are logged and do not roll back the persisted notification or the originating business operation.

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

The backend core (authentication, profiles, skills, discovery, exchange requests, session scheduling, real-time messaging, centralized notifications, reviews/ratings/reputation, and admin/platform management) is implemented. The frontend remains a minimal foundation; no messaging, notification, review, or admin UI is included.
