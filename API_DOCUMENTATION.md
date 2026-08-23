# JanConnect API Documentation

**Version:** PostgreSQL-backed backend refactor

**Transport:** tRPC over HTTP

**Database layer:** Drizzle ORM with `drizzle-orm/node-postgres`

**Authentication:** Manus OAuth session context with protected and admin procedure guards

## 1. Overview

JanConnect exposes a typed tRPC API rather than a collection of hand-written REST endpoints. The HTTP gateway is mounted at `/api/trpc`, so a procedure is addressed as `/api/trpc/<router>.<procedure>`. The frontend should use the generated client in `client/src/lib/trpc.ts`; direct HTTP calls are useful for integration testing, operational tooling, and non-TypeScript consumers.

Responses use the project’s SuperJSON transformer. Dates are therefore represented as serialized date values by the tRPC client and should be treated as UTC values internally, then formatted in the user’s local timezone for display.

The API is intentionally **database-agnostic at the procedure boundary**. PostgreSQL details are implemented below the contract through Drizzle `pgTable` definitions, PostgreSQL enums, foreign keys, unique indexes, and `node-postgres`. The private `DATABASE_URL` is read at runtime and must never be committed to the repository.

## 2. Request and authentication conventions

| Procedure type | Access rule | Behavior when unauthenticated |
|---|---|---|
| `publicProcedure` | No user required | Executes normally, subject to input validation. |
| `protectedProcedure` | Valid authenticated user required | Returns tRPC `UNAUTHORIZED`. |
| `adminProcedure` | Authenticated user with `role = "admin"` | Returns tRPC `FORBIDDEN` for non-admin users. |

For browser clients, the existing session cookie is sent automatically by the configured tRPC client. A non-browser client must establish the application’s OAuth session before calling protected procedures; clients should not manually construct or copy JWT cookies.

Every procedure validates inputs with Zod. Invalid values produce a tRPC `BAD_REQUEST` response with validation details. Database-unavailable mutations raise an application error with the message `Database unavailable`; read procedures return an empty collection, zero count, or `null` where documented so the UI can render an offline/empty state.

A typical direct request uses the following shape:

```http
GET /api/trpc/initiatives.list?input={"json":{"limit":20,"offset":0,"sortBy":"newest"}}
```

The exact URL encoding is handled by the tRPC client and is preferred over manually building query strings.

## 3. Domain enums

| Enum | Allowed values |
|---|---|
| User role | `user`, `admin`, `moderator` |
| Initiative category | `Environment`, `Education`, `Healthcare`, `Blood Donation`, `Animal Welfare`, `Disaster Relief`, `Community Service`, `Awareness Campaigns`, `Public Consultations` |
| Initiative status | `upcoming`, `ongoing`, `completed`, `cancelled` |
| Reportable type | `post`, `comment`, `initiative` |
| Report status | `pending`, `reviewed`, `resolved`, `dismissed` |
| Initiative sort | `newest`, `oldest`, `participants`, `name` |
| Date filter | `today`, `this_week`, `this_month`, `future`, `all` |

## 4. Initiatives API

Router prefix: `initiatives`.

### `initiatives.list`

**Access:** Public. Returns filtered initiatives with organization information.

| Input | Type | Required | Notes |
|---|---|---:|---|
| `category` | Initiative category | No | Exact category filter. |
| `status` | Initiative status | No | Exact lifecycle filter. |
| `verified` | Boolean | No | Filters verified initiatives. |
| `city` | String | No | Exact city filter. |
| `search` | String | No | Case-insensitive PostgreSQL `ILIKE` search over title, description, and address. |
| `sortBy` | Enum | No | Default `newest`. |
| `limit` | Number | No | 1–100; default 20. |
| `offset` | Number | No | Minimum 0; default 0. |
| `latitude`, `longitude` | Number | No | Used with `radiusKm` for geographic filtering. |
| `radiusKm` | Number | No | 1–1000 km; requires latitude and longitude. |
| `dateFilter` | Enum | No | Filters by start date. |

Returns `{ initiatives, total }`. Each initiative includes `id`, `title`, `description`, `category`, `status`, `verified`, address fields, coordinates, dates, `organizationId`, `imageUrl`, registration/contact fields, `participantCount`, `bookmarkCount`, `createdAt`, `organizationName`, and `organizationVerified`.

### `initiatives.getById`

**Access:** Public.

**Input:** `{ id: number }`.

Returns the initiative with organization details, including organization description, logo, verification, website, contact email, and contact phone. Returns `null` when no record exists.

### `initiatives.getCategories`

**Access:** Public.

**Input:** None.

Returns an array of `{ category, count }`. PostgreSQL aggregate counts are normalized to numbers before being returned.

### `initiatives.getNearby`

**Access:** Public.

**Input:** `{ latitude: number, longitude: number, radiusKm?: number, limit?: number }` where radius defaults to 25 km and limit defaults to 10.

Returns nearby initiatives with basic display fields, organization name, and a numeric `distance` in kilometers. Distance uses a PostgreSQL Haversine calculation with Earth radius `6371` km.

### `initiatives.getRelated`

**Access:** Public.

**Input:** `{ id: number, limit?: number }`.

Returns recent initiatives in the same category, excluding the requested initiative. The default limit is 4.

### `initiatives.create`

**Access:** Authenticated user.

| Input | Type | Required | Notes |
|---|---|---:|---|
| `title` | String | Yes | 5–500 characters. |
| `description` | String | Yes | At least 20 characters. |
| `category` | Initiative category | Yes | Must match the PostgreSQL enum. |
| `status` | Initiative status | No | Defaults to `upcoming`. |
| `address`, `city`, `state` | String | No | Location details. |
| `latitude`, `longitude` | Number | No | Geographic coordinates. |
| `startDate` | ISO date string | Yes | Converted to a JavaScript `Date` before insert. |
| `endDate` | ISO date string | No | Converted to `Date` or stored as null. |
| `organizationId` | Number | No | Foreign key to organizations; null on deletion. |
| `registrationLink` | String | No | Maximum 500 characters. |
| `contactInfo` | String | No | Free-form contact details. |
| `imageUrl` | String | No | S3 or other approved media URL. |

Returns `{ success: true }`. The creator’s profile contribution score is incremented by 10 when a profile exists.

### `initiatives.update`

**Access:** Admin.

**Input:** An `id` plus any subset of title, description, status, verified, address, city, state, latitude, longitude, start/end dates, contact info, registration link, and image URL. The `id` is required; all other fields are optional.

Returns `{ success: true }` after updating the PostgreSQL `initiatives` row.

### `initiatives.toggleBookmark`

**Access:** Authenticated user.

**Input:** `{ initiativeId: number }`.

Creates or removes the user–initiative bookmark. The PostgreSQL schema enforces a unique `(userId, initiativeId)` pair. Returns `{ bookmarked: boolean }` and updates the initiative bookmark counter.

### `initiatives.getBookmarkStatus`

**Access:** Authenticated user.

**Input:** `{ initiativeId: number }`.

Returns `{ bookmarked: boolean }`.

### `initiatives.getUserBookmarks`

**Access:** Authenticated user.

**Input:** None.

Returns the current user’s bookmarked initiatives joined to their organization where available.

## 5. Posts and community API

Router prefix: `posts`.

### `posts.list`

**Access:** Public.

**Input:** `{ limit?: number, offset?: number }`, with limit 1–50 and default 20.

Returns `{ posts, total }`. Post records include author identity, content, optional media URL, optional initiative ID, like/comment counts, and creation time.

### `posts.listByInitiative`

**Access:** Public.

**Input:** `{ initiativeId: number, limit?: number }`, with limit 1–50 and default 20.

Returns `{ posts, total }` for posts attached to one initiative. Each row includes `initiativeTitle`, allowing initiative detail pages to preserve discussion context.

### `posts.create`

**Access:** Authenticated user.

**Input:** `{ content: string, mediaUrl?: string, initiativeId?: number }`. Content must be 5–5000 characters. `initiativeId`, when provided, is a foreign key to initiatives.

Returns `{ success: true }`. The author’s contribution score is updated through the typed `userProfiles` Drizzle table rather than a MySQL-specific raw query.

### `posts.getComments`

**Access:** Public.

**Input:** `{ postId: number }`.

Returns comments joined to author names, ordered newest first.

### `posts.addComment`

**Access:** Authenticated user.

**Input:** `{ postId: number, content: string }`, with content 1–1000 characters.

Returns `{ success: true }`. The PostgreSQL comment foreign key cascades if its post is deleted, and the parent post comment counter is incremented.

### `posts.toggleLike`

**Access:** Authenticated user.

**Input:** `{ postId: number }`.

Creates or removes the user’s like and returns `{ liked: boolean }`. The PostgreSQL schema enforces a unique `(userId, postId)` pair.

### `posts.getLikeStatus`

**Access:** Authenticated user.

**Input:** `{ postId: number }`.

Returns `{ liked: boolean }`.

### `posts.reportContent`

**Access:** Authenticated user.

**Input:** `{ reportableType: "post" | "comment" | "initiative", reportableId: number, reason: string }`. Reason must be 10–500 characters.

Returns `{ success: true }`. The polymorphic `reportableId` is intentionally validated at the service layer because a report may target three different tables; `reporterId` and optional resolver references are enforced by PostgreSQL foreign keys.

## 6. Profiles API

Router prefix: `profiles`.

### `profiles.getByUserId`

**Access:** Public.

**Input:** `{ userId: number }`.

Returns public user identity and profile fields: `id`, name, email, account creation date, bio, location, avatar URL, and contribution score. Missing profile rows are represented by null profile fields and a zero score.

### `profiles.me`

**Access:** Authenticated user.

**Input:** None.

Returns `{ user, profile }` for the current session. `profile` may be null when no profile row exists.

### `profiles.getStats`

**Access:** Authenticated user.

**Input:** None.

Returns `{ postCount, initiativeCount }`. The current implementation’s `initiativeCount` is the count of the user’s bookmarks, matching the profile gamification surface. PostgreSQL `count(*)` values are explicitly converted to numbers.

### `profiles.update`

**Access:** Authenticated user.

**Input:** Any subset of `{ bio?: string, location?: string, avatarUrl?: string }`. Bio is limited to 500 characters and location to 255 characters.

Returns `{ success: true }`. The operation updates an existing profile or creates one using the PostgreSQL `user_profiles` table. The one-to-one user/profile relationship is enforced by a unique `userId` constraint.

### `profiles.getParticipation`

**Access:** Authenticated user.

**Input:** None.

Returns up to 50 bookmarked initiatives with title, category, status, city, dates, coordinates, and bookmark creation time. The initiative join is enforced by the `bookmarks.initiativeId` foreign key.

## 7. Organizations API

Router prefix: `organizations`.

### `organizations.list`

**Access:** Public.

**Input:** `{ limit?: number, offset?: number }`, with limit 1–50 and default 20.

Returns `{ organizations, total }`. Each organization includes identity, description, logo, contact fields, verification, creation time, and numeric `initiativeCount`.

### `organizations.getById`

**Access:** Public.

**Input:** `{ id: number }`.

Returns one organization with up to 20 associated initiatives, or `null` if the organization does not exist.

### `organizations.update`

**Access:** Admin.

**Input:** An `id` and any subset of name, description, logo URL, contact email, contact phone, website, and verified status. Name is limited to 2–255 characters; contact email to 320; contact phone to 64; website to 500.

Returns `{ success: true }`.

## 8. Admin moderation API

Router prefix: `admin`.

### `admin.listReports`

**Access:** Admin.

**Input:** `{ status?: report status, limit?: number, offset?: number }`, with limit 1–100 and default 20.

Returns `{ reports, total }`. Reports include report type, target ID, reason, status, reporter identity, and creation time. Aggregate totals are converted from PostgreSQL numeric results to JavaScript numbers.

### `admin.resolveReport`

**Access:** Admin.

**Input:** `{ reportId: number, status: "reviewed" | "resolved" | "dismissed" }`.

Updates report status, resolver ID, and update timestamp. Returns `{ success: true }`.

### `admin.getPendingCount`

**Access:** Admin.

**Input:** None.

Returns `{ count: number }` for pending reports.

### `admin.getStats`

**Access:** Admin.

**Input:** None.

Returns `{ initiatives, posts, users, reports }`, all normalized to JavaScript numbers.

## 9. PostgreSQL schema and relationship model

The API maps to nine PostgreSQL tables:

| Table | Purpose | Important relationships |
|---|---|---|
| `users` | Authenticated identities | Parent for profiles, posts, comments, likes, bookmarks, reports, and initiative creators. |
| `user_profiles` | Civic profile data | One-to-one with users through unique `userId`. |
| `organizations` | Civic organizations | One-to-many with initiatives. |
| `initiatives` | Civic opportunities and events | Optional organization and creator; parent for posts and bookmarks. |
| `posts` | Community discussions | Belongs to a user and optionally an initiative. |
| `comments` | Post replies | Belongs to a post and user. |
| `post_likes` | User/post likes | Unique user/post pair. |
| `bookmarks` | User/initiative saves | Unique user/initiative pair. |
| `reports` | Moderation reports | Reporter and optional resolver reference users; target ID is polymorphic. |

Delete behavior is explicit. User deletion cascades to dependent profiles, posts, comments, likes, bookmarks, and submitted reports. Post deletion cascades to comments and likes. Initiative deletion cascades to bookmarks and sets attached post initiative references to null. Organization and initiative creator deletion set the corresponding initiative references to null. Report resolvers are nullable and set to null if the resolver is removed.

## 10. Media and storage

Community media is not stored in PostgreSQL. The API stores a media URL or storage reference in `posts.mediaUrl` and keeps file bytes in the project’s S3-compatible storage integration. Clients should upload through the existing media endpoint and pass the returned stable URL to `posts.create`. Do not place media bytes in database columns or local project folders.

## 11. PostgreSQL environment and migration

The runtime expects a private environment variable:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

Do not add this value to source control, documentation, screenshots, or chat messages. The project includes a PostgreSQL baseline and relationship migration under `drizzle-pg/`. In a private environment, configure `DATABASE_URL`, then run:

```bash
pnpm db:generate:pg
pnpm db:migrate:pg
pnpm db:check:pg
pnpm check
pnpm test -- --run
```

The migrations should be applied in order. The relationship migration contains foreign-key and uniqueness additions and should only be run after the baseline tables exist. Existing MySQL data requires a separate, reviewed data export/import process; changing the Drizzle dialect does not automatically migrate or transform existing rows.

## 12. Error handling and operational notes

| Condition | Expected response |
|---|---|
| Invalid Zod input | tRPC `BAD_REQUEST`. |
| Missing session on protected procedure | tRPC `UNAUTHORIZED`. |
| Non-admin on admin procedure | tRPC `FORBIDDEN`. |
| Missing database at read time | Empty collection, zero count, or null according to procedure. |
| Missing database at mutation time | Application error: `Database unavailable`. |
| Foreign-key violation | Database error; client should surface a recoverable mutation failure. |
| Duplicate like/bookmark | Prevented by unique PostgreSQL indexes; toggle logic checks state before insert. |
| Missing requested record | `null` for singular reads or empty collection for list reads. |

Mutations that update counters and dependent rows are currently expressed as separate Drizzle operations. For high-concurrency production workloads, wrap multi-step mutations such as bookmark, like, comment, and contribution-score updates in a PostgreSQL transaction and use guarded counter updates to prevent counter drift.

## 13. Source references

The documentation is derived from the implementation source rather than an external API specification:

1. [`server/routers/initiatives.ts`](./server/routers/initiatives.ts) — Initiative procedures and filters.
2. [`server/routers/posts.ts`](./server/routers/posts.ts) — Community posts, comments, likes, and reports.
3. [`server/routers/profiles.ts`](./server/routers/profiles.ts) — Profile and activity procedures.
4. [`server/routers/organizations.ts`](./server/routers/organizations.ts) — Organization procedures.
5. [`server/routers/admin.ts`](./server/routers/admin.ts) — Moderation and platform statistics.
6. [`server/_core/trpc.ts`](./server/_core/trpc.ts) — Public, protected, and admin guards.
7. [`drizzle/schema.ts`](./drizzle/schema.ts) — PostgreSQL tables, enums, keys, indexes, and foreign keys.
8. [`drizzle/relations.ts`](./drizzle/relations.ts) — Drizzle relation graph.
9. [`server/db.ts`](./server/db.ts) — Lazy PostgreSQL pool and user upsert service.
10. [`POSTGRESQL_SETUP.md`](./POSTGRESQL_SETUP.md) — Private database configuration and migration instructions.
