Documentation for active ruleset of the Sunder TTRPG. GitHub website hosting CI using MkDocs and ObsidianMD.

# Development Environment Setup

**Using:** Python 3.12.3

## Creating the Virtual Deployment Environment

You will need to set up a virtual environment (venv) for testing the website on MkDocs. Run the following commands after installing the necessary Python version:

```shell
python -m venv .venv
./.venv/Scripts/Activate.ps1
```

## Installing Dependencies

Make sure your `pip` is up to date:

```shell
py -m pip install --upgrade pip
```

Download MkDocs and its dependencies:

```shell
pip install mkdocs mkdocs-material mkdocs-callouts mkdocs-obsidian-support-plugin mkdocs-roamlinks-plugin
pip install pymdown-extensions
```

## Deploying Supabase Edge Functions

To deploy the Supabase Edge Functions, ensure you have NPX installed. Then run:

```shell
npx supabase login
npx supabase functions deploy --project-ref your-project-ref
```
Replace `your-project-ref` with your actual Supabase project reference (in URL).

## Release Announcements

The `post-update` Supabase Edge Function announces release notes to Discord and records idempotency in `release_announcements` by `appName + version`. Existing site release note JSON still works; new app workflows should send an explicit `appName`.

```shell
curl -sS -X POST "$SUPABASE_RELEASE_FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "x-post-update-secret: $SUPABASE_POST_UPDATE_SECRET" \
  -d '{
    "appName": "creosmark",
    "version": "2.5.0",
    "summary": "Character builder update.",
    "sections": [
      {
        "title": "Builder Improvements",
        "description": "Describe the shipped changes here."
      }
    ]
  }'
```

The same Discord webhook can be used for every app. Embed colors are selected by app name in `@sunderttrpg/discord`; unknown app names use a neutral default color.
