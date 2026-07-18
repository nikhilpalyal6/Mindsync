# MindSync Backend

Production-ready backend foundation for **MindSync** — an AI-powered learning platform.

Built with Express.js, MongoDB Atlas, and JWT authentication. This is **Phase 1** — foundation only. Authentication routes, AI features, and frontend are planned for later phases.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| Express.js | REST API framework |
| MongoDB Atlas | Cloud database |
| Mongoose | ODM for MongoDB |
| JWT | Access & refresh tokens |
| bcryptjs | Password hashing |
| Helmet | HTTP security headers |
| CORS | Cross-origin resource sharing |
| Morgan | HTTP request logging |
| Winston | File-based logging |
| Express Validator | Input validation |
| express-rate-limit | Rate limiting |
| express-mongo-sanitize | NoSQL injection protection |
| xss-clean | XSS protection |
| Multer | File upload (configured, not exposed) |
| Cloudinary | Media storage (configured, not exposed) |
| Nodemailer | Email service (configured, not exposed) |

---

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **MongoDB Atlas** cluster (or local MongoDB instance)

---

## Installation

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your actual values
# Required: MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Server port (default: 5000) |
| `NODE_ENV` | Yes | `development`, `production`, or `test` |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Access token signing secret |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing secret |
| `ACCESS_TOKEN_EXPIRE` | Yes | Access token expiry (e.g. `15m`) |
| `REFRESH_TOKEN_EXPIRE` | Yes | Refresh token expiry (e.g. `7d`) |
| `CLIENT_URL` | Yes | Frontend URL for CORS |
| `CLOUDINARY_NAME` | No | Cloudinary cloud name |
| `CLOUDINARY_KEY` | No | Cloudinary API key |
| `CLOUDINARY_SECRET` | No | Cloudinary API secret |
| `EMAIL_HOST` | No | SMTP host |
| `EMAIL_PORT` | No | SMTP port |
| `EMAIL_USER` | No | SMTP username |
| `EMAIL_PASSWORD` | No | SMTP password |

> Never commit `.env` to version control. Use strong, unique secrets in production.

---

## Run Instructions

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server starts at `http://localhost:5000` (or your configured `PORT`).

### Health Check

```bash
GET http://localhost:5000/api/v1/health
```

Response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "MindSync API is healthy",
  "data": {
    "server": "running",
    "database": {
      "status": "connected",
      "isConnected": true,
      "host": "...",
      "name": "mindsync"
    },
    "environment": "development",
    "timestamp": "2026-07-18T...",
    "version": "1.0.0",
    "app": "MindSync"
  }
}
```

---

## Folder Structure

```
backend/
├── src/
│   ├── config/           # Centralized configuration
│   │   ├── index.js      # Main config (env, JWT, cookies, rate limits)
│   │   ├── validateEnv.js
│   │   ├── logger.js     # Winston logger setup
│   │   ├── cloudinary.js # Cloudinary (prepare only)
│   │   ├── email.js      # Nodemailer (prepare only)
│   │   └── multer.js     # Multer (prepare only)
│   │
│   ├── constants/        # App-wide constants
│   │   ├── roles.js      # USER, ADMIN, SUPER_ADMIN
│   │   └── httpStatus.js
│   │
│   ├── controllers/      # Route handlers (MVC)
│   │   └── health.controller.js
│   │
│   ├── database/         # Database connection
│   │   └── connection.js # MongoDB connect, reconnect, shutdown
│   │
│   ├── middleware/       # Express middleware
│   │   ├── auth.middleware.js
│   │   ├── role.middleware.js
│   │   ├── error.middleware.js
│   │   ├── notFound.middleware.js
│   │   ├── rateLimiter.middleware.js
│   │   └── validate.middleware.js
│   │
│   ├── models/           # Mongoose schemas
│   │   └── user.model.js
│   │
│   ├── routes/           # API routes (versioned)
│   │   ├── index.js
│   │   └── v1/
│   │       ├── index.js
│   │       └── health.routes.js
│   │
│   ├── services/         # Business logic layer
│   │   └── token.service.js
│   │
│   ├── utils/            # Reusable utilities
│   │   ├── ApiError.js
│   │   ├── ApiResponse.js
│   │   ├── asyncHandler.js
│   │   ├── cookie.utils.js
│   │   ├── date.utils.js
│   │   ├── logger.utils.js
│   │   ├── pagination.utils.js
│   │   ├── password.utils.js
│   │   └── token.utils.js
│   │
│   ├── validators/       # Express Validator chains
│   │   └── common.validators.js
│   │
│   ├── app.js            # Express app configuration
│   └── server.js         # Entry point & graceful shutdown
│
├── uploads/              # Local file uploads (future)
├── logs/                 # Application logs
├── docs/                 # Documentation
├── scripts/              # Utility scripts
├── .env.example
├── .gitignore
└── package.json
```

---

## Architecture

```
Request → Middleware Stack → Routes → Controllers → Services → Models → Database
                ↓
         Error Handler → JSON Response
```

### Security Layers

1. **Helmet** — Security HTTP headers
2. **CORS** — Restricted to `CLIENT_URL`
3. **Rate Limiting** — Global (100/15min) + Auth (10/15min)
4. **mongo-sanitize** — Prevents NoSQL injection
5. **xss-clean** — Sanitizes user input
6. **JWT + bcrypt** — Secure authentication foundation
7. **Secure Cookies** — HttpOnly, SameSite, Secure in production
8. **Error Sanitization** — No stack traces in production

### Role Hierarchy

```
SUPER_ADMIN (3) > ADMIN (2) > USER (1)
```

Higher roles inherit permissions of lower roles via `authorize()` middleware.

---

## API Versioning

All routes are prefixed with `/api/v1/`:

```
/api/v1/health     GET   Health check
/api/v1/auth/*     —     (Phase 2)
/api/v1/users/*    —     (Phase 2)
```

---

## Logging

| Log File | Environment | Purpose |
|---|---|---|
| `logs/development.log` | Development | General logs |
| `logs/production.log` | Production | General logs |
| `logs/error.log` | All | Error-level logs only |

HTTP requests are logged via Morgan (console in dev, file in production).

---

## What's Prepared for Later Phases

| Feature | Status |
|---|---|
| User registration/login | Token service & middleware ready |
| Role-based access | `protect()` + `authorize()` ready |
| File uploads | Multer configured |
| Cloudinary media | Client configured |
| Email notifications | Nodemailer configured |
| Input validation | Reusable validators ready |
| Pagination | Utility functions ready |

---

## License

ISC
