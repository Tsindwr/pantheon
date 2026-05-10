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

1. Create a Supabase project.
2. In Supabase Auth providers, enable **Anonymous Sign-Ins**.
3. Run SQL in `supabase/schema.sql` in the Supabase SQL editor.
4. Host the repository root as a static site with GitHub Pages.
5. Open the app, paste your Supabase URL + anon key, set your player name, and connect.

## Development

This repository is intentionally framework-free and uses static files:

- `index.html`
- `styles.css`
- `app.js`
