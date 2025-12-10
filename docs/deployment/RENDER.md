# Render.com Deployment

The backend is deployed to Render.com as a Node.js web service.

> **Note**: The Render service is still named `burburiuok` (legacy name). The URL cannot be easily changed without recreating the service. This will be addressed in a future migration.

## Overview

| Aspect            | Details                         |
| ----------------- | ------------------------------- |
| **Service Type**  | Web Service                     |
| **Runtime**       | Node.js 20                      |
| **Build Command** | `npm install`                   |
| **Start Command** | `npm run backend:start`         |
| **URL**           | https://burburiuok.onrender.com |

## Deployment Pipeline

### Auto-Deploy

Render automatically deploys when:

- Push to `main` branch
- Manual deploy from dashboard

### Build Process

1. Clone repository
2. Run `npm install` (installs root dependencies)
3. Start with `npm run backend:start`
4. Health check on `/health` endpoint

## Environment Variables

Configure in Render dashboard under "Environment":

### Required

| Variable                    | Description                      |
| --------------------------- | -------------------------------- |
| `SUPABASE_URL`              | Supabase project URL             |
| `SUPABASE_ANON_KEY`         | Supabase anonymous key           |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key        |
| `AUTH_REDIRECT_URL`         | Full callback URL (GitHub Pages) |
| `AUTH_EMAIL_FROM`           | Email sender name                |
| `BACKEND_ALLOWED_ORIGINS`   | CORS whitelist                   |

### Optional

| Variable               | Description                       |
| ---------------------- | --------------------------------- |
| `GOOGLE_AI_STUDIO_KEY` | Gemini API key for AI agent       |
| `BACKEND_PORT`         | Port (defaults to `PORT` or 4000) |

### Example Values

```bash
SUPABASE_URL=https://zvlziltltbalebqpmuqs.supabase.co
SUPABASE_ANON_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
AUTH_REDIRECT_URL=https://mrolandas.github.io/Moxlai/auth/callback
AUTH_EMAIL_FROM=Moxlai <noreply@moxlai.lt>
BACKEND_ALLOWED_ORIGINS=https://mrolandas.github.io,https://mrolandas.github.io/Moxlai
GOOGLE_AI_STUDIO_KEY=AIzaSy...
```

## Service Configuration

### Render Dashboard Settings

| Setting           | Value                   |
| ----------------- | ----------------------- |
| Name              | `moxlai`                |
| Region            | Frankfurt (EU)          |
| Branch            | `main`                  |
| Build Command     | `npm install`           |
| Start Command     | `npm run backend:start` |
| Health Check Path | `/health`               |
| Auto-Deploy       | Yes                     |

### Instance Type

- **Free tier**: Sleeps after 15 min inactivity, cold starts
- **Paid tier**: Always on, faster response

Note: Free tier cold starts can take 30-60 seconds.

## CORS Configuration

The backend requires explicit CORS configuration:

```typescript
// backend/src/app.ts
app.use(
  cors({
    origin: process.env.BACKEND_ALLOWED_ORIGINS?.split(","),
    credentials: true,
  })
);
```

The `BACKEND_ALLOWED_ORIGINS` must include:

- `https://mrolandas.github.io`
- `https://mrolandas.github.io/Moxlai`

Both are needed because:

- First: For simple requests
- Second: For requests with base path in Referer

## Health Check

The `/health` endpoint returns:

```json
{
  "data": { "status": "ok" },
  "meta": { "timestamp": "2025-12-10T12:00:00Z" }
}
```

Render uses this to:

- Verify deployment succeeded
- Monitor service health
- Restart if unhealthy

## Logs

### Viewing Logs

1. Go to Render dashboard
2. Select service
3. Click "Logs" tab

### Log Output

The backend logs:

- Startup message with port
- Request logs (errors only by default)
- AI agent telemetry (operations, errors)

## Scaling

### Current Setup

Single instance, no horizontal scaling.

### Future Considerations

For production:

- Enable auto-scaling
- Add Redis for session/rate-limit sharing
- Configure health check intervals

## Troubleshooting

### Service Won't Start

**Check**:

1. Build logs for npm errors
2. Start command is correct
3. Required env vars are set

### 500 Errors

**Check**:

1. Supabase credentials are valid
2. Service role key has correct permissions
3. View logs for stack traces

### CORS Errors

**Symptom**: "Access-Control-Allow-Origin" errors

**Solutions**:

1. Verify `BACKEND_ALLOWED_ORIGINS` includes frontend domain
2. Include both with and without trailing path
3. Redeploy after changing env vars

### Cold Start Timeout

**Symptom**: First request after idle times out

**Solutions**:

- Upgrade to paid tier
- Implement client-side retry
- Use external ping service to keep warm

### AI Agent Not Working

**Check**:

1. `GOOGLE_AI_STUDIO_KEY` is set
2. API key is valid (test in Google AI Studio)
3. Check logs for API errors

## Deployment Verification

After deploying:

1. **Health check**:

   ```bash
   curl https://moxlai.onrender.com/health
   ```

2. **API test**:

   ```bash
   curl https://moxlai.onrender.com/api/v1/curriculum
   ```

3. **Frontend integration**:
   - Visit GitHub Pages URL
   - Open browser DevTools
   - Check Network tab for API calls

## Manual Deploy

To deploy without pushing:

1. Go to Render dashboard
2. Select service
3. Click "Manual Deploy"
4. Choose "Deploy latest commit"

## Rollback

To rollback:

1. Go to "Events" tab
2. Find previous successful deploy
3. Click "Redeploy"

Or:

1. Revert commit in Git
2. Push to trigger auto-deploy

---

## Maintenance

- **Last verified**: 2025-12-10
- **Related code**: `backend/src/server.ts`, `backend/src/app.ts`
- **Update when**: Environment changes, new services added
- **Related docs**: [GitHub Pages](GITHUB_PAGES.md), [Supabase](SUPABASE.md)
