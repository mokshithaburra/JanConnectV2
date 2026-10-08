# JanConnect

JanConnect is a civic engagement web app for India. It helps people find local volunteering and civic initiatives near them, like tree plantation drives, blood donation camps and public consultations, keep track of the ones they care about, and talk about them with others in a community feed.

**Live prototype:** https://jan-connect-v2.vercel.app

Anyone can browse the site. Signing in is limited to test accounts while it's a prototype, so message me if you'd like access.

## Features

- Browse initiatives on a map or as a list, and filter them by category, status and location
- Bookmark initiatives you want to come back to
- Community feed where you can post (with an image), like, comment and report posts or comments
- Your profile shows everything you've posted, and you can delete your own posts and comments
- Organization pages for the groups running the initiatives
- Moderation panel:
  - Moderators handle reports and remove posts or comments
  - Admins can also manage users and roles, initiatives and organizations

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, wouter, TanStack Query
- **Backend:** Express with tRPC and zod
- **Database:** PostgreSQL on Supabase, using Drizzle ORM
- **Storage:** Supabase Storage (private bucket; images are served through short-lived signed URLs)
- **Auth:** Google sign-in, with the session kept in an httpOnly cookie
- **Maps:** Google Maps JavaScript API
- **Hosting:** Vercel

## Running it locally

You'll need:
- Node.js 22 and pnpm
- A Supabase project (for Postgres and storage)
- A Google OAuth client
- A Google Maps API key and Map ID

```bash
git clone https://github.com/mokshithaburra/JanConnectV2.git
cd JanConnectV2
pnpm install
```

Copy `.env.example` to `.env` and fill in the values. Every variable is listed there, and `DEPLOY.md` explains where each one comes from.

```bash
pnpm db:migrate:pg   # create the tables
pnpm dev             # http://localhost:3000
```

### Making yourself an admin

There are no passwords. Everyone signs in with Google, and roles are stored on the user.

1. Sign in once so your account gets created.
2. In Supabase, open the `users` table and copy your `openId`.
3. Set it as `OWNER_OPEN_ID` in `.env`, then restart the server.
4. Log out and back in. You'll now see the Admin Panel, and you can promote other people to moderator or admin from the Users tab.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm check` | Type-check the project |
| `pnpm test` | Run the tests |
| `pnpm build` | Build for production |
| `pnpm start` | Run the production build |
| `pnpm db:migrate:pg` | Apply database migrations |

## Project structure

```
client/        React app (pages, components, UI kit)
server/        Express server and tRPC routers
shared/        Constants shared by client and server
drizzle/       Database schema
drizzle-pg/    Postgres migrations
api/           Vercel function entry
```

## Deployment

The app runs on Vercel: the frontend is served as static files, and the API runs as a single serverless function. `DEPLOY.md` covers the setup in detail, including environment variables, Supabase, Google OAuth and Maps, and a pre-launch checklist.

## Status

This is a prototype, and some things I know still need work:

- Image uploads are capped at 3 MB (photos are resized in the browser before uploading, so this is rarely a problem)
- There's no way to ban or suspend a user yet
- Logging out doesn't invalidate a session before it expires
- Deleted posts and comments are removed for good; there's no undo or audit log yet

Ideas for what's next: user bans, a moderation history, soft delete, and opening sign-in to everyone once a privacy policy page is in place.

## Author

Built by Mokshitha Burra · [GitHub](https://github.com/mokshithaburra)
