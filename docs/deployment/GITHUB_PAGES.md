# GitHub Pages Deployment

The frontend is deployed as a static site to GitHub Pages.

## Overview

| Aspect      | Details                                |
| ----------- | -------------------------------------- |
| **Trigger** | Push to `main` branch                  |
| **Build**   | SvelteKit with adapter-static          |
| **Output**  | Static HTML/JS/CSS                     |
| **URL**     | https://mrolandas.github.io/BurBuriuok |

## Deployment Pipeline

### GitHub Actions Workflow

Location: `.github/workflows/deploy-frontend-gh-pages.yml`

```yaml
on:
  push:
    branches: [main, deploy/github-pages]
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install root dependencies
        run: npm ci

      - name: Install frontend dependencies
        run: npm ci
        working-directory: frontend

      - name: Write runtime config
        run: |
          # Writes env.js with production credentials

      - name: Build
        run: npm run build
        working-directory: frontend

      - name: Copy 404.html for SPA
        run: cp frontend/build/index.html frontend/build/404.html

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
```

### Build Process

1. **Install dependencies**: Both root and frontend packages
2. **Generate runtime config**: Inject Supabase credentials into `env.js`
3. **Build**: SvelteKit produces static files in `frontend/build/`
4. **SPA fallback**: Copy `index.html` to `404.html` for client-side routing
5. **Deploy**: Push `build/` contents to `gh-pages` branch

## Configuration

### SvelteKit Config

File: `frontend/svelte.config.js`

```javascript
import adapter from "@sveltejs/adapter-static";

const basePath = process.env.VITE_APP_BASE_PATH ?? "/BurBuriuok";

export default {
  kit: {
    adapter: adapter({
      fallback: "index.html", // SPA mode
    }),
    paths: {
      base: dev ? "" : basePath,
    },
  },
};
```

### Base Path

The app is served from `/BurBuriuok` (repo name), not root. This affects:

- All internal links
- Asset paths
- API redirect URLs

Use `$app/paths.resolve()` for navigation:

```svelte
<script>
  import { base } from '$app/paths';
</script>

<a href="{base}/concepts">Concepts</a>
```

### Runtime Config (env.js)

File: `frontend/static/env.js`

This file is overwritten during deployment with production values:

```javascript
window.__BURKURSAS_CONFIG__ = {
  supabaseUrl: "https://xxx.supabase.co",
  supabaseAnonKey: "xxx",
  adminApiBase: "https://burburiuok.onrender.com/api/v1/admin",
  publicApiBase: "https://burburiuok.onrender.com/api/v1",
};
```

The app reads these values in `frontend/src/lib/config/appConfig.ts`.

## GitHub Secrets

Required secrets in repository settings:

| Secret              | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `SUPABASE_URL`      | Database URL                                               |
| `SUPABASE_ANON_KEY` | Public API key                                             |
| `ADMIN_API_BASE`    | Backend admin URL                                          |
| `PUBLIC_API_BASE`   | Backend public URL (optional, derived from ADMIN_API_BASE) |

## SPA Routing

GitHub Pages doesn't support server-side routing. Solution:

1. Build with `fallback: 'index.html'`
2. Copy `index.html` → `404.html`
3. All routes serve the SPA shell
4. Client-side router handles navigation

This allows direct links like `/concepts/lbs-1-1a-jole` to work.

## Static Assets

### Included in Build

- `/favicon.ico`
- `/robots.txt`
- `/.nojekyll` (disables Jekyll processing)
- `/env.js` (overwritten with production config)

### Asset References

Assets in `frontend/static/` are copied to build root. Reference them with absolute paths:

```html
<link rel="icon" href="/BurBuriuok/favicon.ico" />
```

Or use the base path helper:

```svelte
<img src="{base}/images/logo.png" alt="Logo" />
```

## Deployment Triggers

### Automatic

- Push to `main` branch
- Push to `deploy/github-pages` branch

### Manual

1. Go to Actions tab in GitHub
2. Select "Deploy Frontend to GitHub Pages"
3. Click "Run workflow"

## Rollback

To rollback to a previous deployment:

1. Find the commit in git history
2. Reset `main` to that commit
3. Force push (or revert)

Or manually trigger workflow on a specific branch/tag.

## Monitoring

### Deployment Status

Check the Actions tab for:

- Build logs
- Deployment status
- Error details

### Site Status

After deployment:

1. Visit https://mrolandas.github.io/BurBuriuok
2. Check browser console for errors
3. Verify API connectivity

## Troubleshooting

### Build Failures

**Symptom**: Workflow fails at build step

**Solutions**:

- Check `npm run frontend:check` locally
- Review TypeScript errors in logs
- Ensure all dependencies in `package.json`

### 404 on Direct Links

**Symptom**: Refreshing a page shows GitHub's 404

**Solution**: Ensure `404.html` is copied in workflow

### API Calls Fail

**Symptom**: Network errors in console

**Check**:

1. `env.js` has correct API URLs
2. Backend CORS allows GitHub Pages domain
3. Backend is running on Render

### Old Content Displayed

**Symptom**: Changes not visible after deploy

**Solutions**:

- Hard refresh (Ctrl+Shift+R)
- Clear browser cache
- Check deployment actually completed

---

## Maintenance

- **Last verified**: 2025-12-10
- **Related code**:
  - `.github/workflows/deploy-frontend-gh-pages.yml`
  - `frontend/svelte.config.js`
  - `frontend/static/env.js`
- **Update when**: Deployment process changes, new secrets needed
- **Related docs**: [Render Deployment](RENDER.md), [Local Development](LOCAL_DEVELOPMENT.md)
