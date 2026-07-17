# Release Announcements

Release announcements are handled by the `post-update` Supabase Edge Function. The function sends a Discord webhook message and records idempotency in Supabase by `appName + version`, so `site@v2.5.0` and `creosmark@v2.5.0` are separate announcements.

Required Supabase function secrets:

- `DISCOHOOK_UPDATE_URL`: Discord webhook used for all release announcements.
- `POST_UPDATE_SHARED_SECRET`: shared secret expected by the function.
- `DISCORD_RELEASE_MENTION`: optional Discord content prefix. Set it to an empty string to suppress the default role mention.

Required GitHub Actions secrets:

- `SUPABASE_RELEASE_FUNCTION_URL`: URL for the deployed `post-update` function.
- `SUPABASE_POST_UPDATE_SECRET`: same value as `POST_UPDATE_SHARED_SECRET`.

Minimal workflow step:

```yaml
- name: Announce release
  uses: ./.github/actions/announce-release
  with:
    app-name: creosmark
    notes-file: sunder-platform/apps/creosmark/public/release-notes/v2.5.0.json
    function-url: ${{ secrets.SUPABASE_RELEASE_FUNCTION_URL }}
    shared-secret: ${{ secrets.SUPABASE_POST_UPDATE_SECRET }}
```

Payload fields:

- `appName`: stable app key such as `site`, `creosmark`, `gauntlet`, or `api`. Defaults to `site` for legacy callers.
- `version`: release version. A leading `v` is accepted and normalized for idempotency.
- `summary`: Discord embed description.
- `sections`: up to 25 Discord embed fields. Both `title/description` and `heading/body` shapes are accepted.
- `title`, `url`, `color`, and `content`: optional Discord overrides.

App-specific colors and labels live in `@sunderttrpg/discord`.
