# gauntlet

A simple queue manager for a team to collaborate online and determine the queue order of Sunder combat.

## Features

- Players can **throw in the gauntlet** to join a campaign's live turn queue.
- GMs can create campaigns and share generated campaign codes.
- Players can join campaigns by code, and joined campaigns are persisted to their profile.
- GMs can manage the queue: dismiss top turn, rename entries, remove entries, and rearrange order.
- Queue updates are live through Supabase realtime subscriptions.
- Designed for static hosting on GitHub Pages.

## Setup

1. Use the shared Supabase project that already owns player logins.
2. Run `supabase/migrations/20260511230000_authenticated_gauntlet.sql` in the Supabase SQL editor, or run all migrations with the Supabase CLI.
3. Enable Realtime for `queue_entries` if it is not already enabled by the migration in your project.
4. Host the repository root as a static site with GitHub Pages.
5. Add the GitHub Pages URL to Supabase Auth redirect URLs if you want magic-link sign-in.
6. If your automated checks run behind a network allowlist, allow `cdn.jsdelivr.net` for the browser Supabase client import.
7. Open the app, paste your Supabase URL + anon key, sign in with an existing account, set your player name, and connect.

Anonymous sign-ins are not required and should remain disabled for the shared project.

## Supabase objects

The migration creates:

- `profiles`
- `campaigns`
- `player_campaigns`
- `queue_entries`
- `join_campaign_by_code(p_code, p_joined_as)`

Campaign rows are readable only to their GM and joined players. Joining by code goes through the `join_campaign_by_code` RPC so the client does not need broad campaign read access.

## Development

This repository is intentionally framework-free and uses static files:

- `index.html`
- `styles.css`
- `app.js`
