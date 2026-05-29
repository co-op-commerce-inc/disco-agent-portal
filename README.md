# Disco Agent Portal

Onboarding portal for Disco's AI agent "Rhythm". Employees connect their accounts, set preferences, and get provisioned with GDrive folders and GBrain context.

## Architecture

- **Frontend**: Next.js Pages Router (single-page React app at `pages/index.tsx`)
- **API Routes**: Next.js API routes under `pages/api/`
- **Webhooks**: Forwards OAuth tokens and provisioning requests to the Hermes Mac Studio webhook server
- **Deployment**: Auto-deploys to Vercel on push to `main`

## Employee Provisioning Flow

1. User clicks "Sign in with Slack" or enters Slack User ID → portal dashboard
2. User clicks "Connect" on Google → Google OAuth popup (`/api/oauth/google`)
3. Google OAuth callback exchanges code for tokens, stores them via `oauth-google` webhook, AND triggers employee provisioning via `onboard` webhook
4. Onboarding webhook creates:
   - GDrive folders: `people/<slackid>/claude-projects/`, `people/<slackid>/agent-outputs/`
   - GBrain context page: `~/DiscoBrain/sources/people/<slackid>/context.md`
   - Commits and syncs GBrain to git
5. Frontend receives `postMessage` on OAuth success and also fires a follow-up `onboard` webhook call (idempotent safety net)

## Google Cloud Console Setup

### 1. Create/Configure OAuth 2.0 Client ID

Go to Google Cloud Console > APIs & Services > Credentials:

1. Create an "OAuth 2.0 Client ID" (Web application type)
2. Add these **Authorized redirect URIs**:
   - `https://disco-agent-portal.vercel.app/api/oauth/google`
3. Add these **Authorized JavaScript origins**:
   - `https://disco-agent-portal.vercel.app`
4. Note your Client ID and Client Secret

### 2. Set Environment Variables on Vercel

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_SECRET` | OAuth client secret from GCP console |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `SLACK_CLIENT_ID` | Slack OIDC client ID |
| `SLACK_CLIENT_SECRET` | Slack OIDC client secret |

### 3. Enable Google Drive API

1. Go to "Enabled APIs & Services" > "+ ENABLE APIS AND SERVICES"
2. Search for "Google Drive API" and enable it
3. The portal requests `https://www.googleapis.com/auth/drive` scope for Shared Drive folder creation

### 4. Shared Drive Setup

The portal uses a Shared Drive "Disco Agent Workspace" (ID: `0ADzUC74f0zEaUk9PVA`). Ensure the service account or authenticated user has Manager access to this Shared Drive.

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/oauth/google` | GET | Google OAuth flow (start & callback) |
| `/api/oauth/github` | GET | GitHub OAuth flow (start & callback) |
| `/api/oauth/slack` | GET | Slack OIDC callback |
| `/api/oauth/granola` | GET | Granola OAuth PKCE flow |
| `/api/upload` | POST | File upload (multipart) - forwards to Hermes webhook for GDrive storage |
| `/api/status` | GET | User service connection status |

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

Push to `main` branch — Vercel auto-deploys.
