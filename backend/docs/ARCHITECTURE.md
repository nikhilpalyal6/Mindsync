# MindSync Backend — Architecture Overview

## Design Principles

- **MVC Pattern** — Routes delegate to Controllers, business logic lives in Services
- **Separation of Concerns** — Config, middleware, utils, and models are isolated modules
- **DRY** — Shared utilities for errors, responses, tokens, pagination, and validation
- **Security First** — Multiple defense layers applied at the middleware level
- **Scalability** — Versioned API routes, role hierarchy, and modular folder structure

## Request Lifecycle

1. Incoming request hits Express
2. Security middleware (Helmet, CORS, sanitize, XSS, rate limit)
3. Body/cookie parsing
4. Versioned route matching (`/api/v1/*`)
5. Route-level middleware (auth, roles, validation)
6. Controller handler (wrapped in `asyncHandler`)
7. Service layer for business logic
8. Model/database interaction
9. Standardized JSON response via `ApiResponse`
10. Errors caught by global `errorHandler`

## Database Connection

The connection module handles:

- Initial connection with connection pooling
- Automatic reconnection (up to 10 attempts)
- Event-driven status tracking
- Graceful shutdown on `SIGTERM` / `SIGINT`

## Token Strategy

- **Access Token** — Short-lived (15m), sent via cookie or Authorization header
- **Refresh Token** — Long-lived (7d), hashed before storage in User document
- **Logout** — Clears refresh token from database and cookies

## Error Response Format

```json
{
  "success": false,
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Please provide a valid email address" }
  ]
}
```

Stack traces are included only in `development` mode.
