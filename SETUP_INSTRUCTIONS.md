# Sonexial Integration Setup Guide

This guide walks you through integrating the Sonexial GEO Scanner backend with your existing website.

## Current State

✅ **Website**: Static HTML/CSS/JS site at `/workspace/index.html` (deployed to Netlify)
✅ **Widget**: GEO Scan widget created at `/workspace/geo-scan-widget.html`
✅ **Backend**: Complete Python FastAPI backend at `/workspace/sonexial/`

## Quick Start (5 Minutes)

### Step 1: Create Backend Environment File

```bash
cd /workspace/sonexial
cp .env.example .env
```

Edit `.env` and set these minimum required variables:

```bash
# For local testing, you only need these:
APP_ENV=development
APP_BASE_URL=http://localhost:8000
SECRET_KEY=your-random-32-character-secret-key-here
OPS_BEARER_TOKEN=your-ops-token-here

# Database (using SQLite for local dev - no PostgreSQL needed initially)
DATABASE_URL=sqlite:///./sonexial.db

# Leave API keys empty for now - scanner works without LLM for basic audits
TOGETHER_API_KEY=
STRIPE_SECRET_KEY=
RESEND_API_KEY=
```

### Step 2: Install Backend Dependencies

```bash
cd /workspace/sonexial
pip install -e .
```

Or if you have `uv`:
```bash
cd /workspace/sonexial
uv pip install -e .
```

### Step 3: Initialize Database

```bash
cd /workspace/sonexial
make db-upgrade
```

Or manually:
```bash
cd /workspace/sonexial
python -c "from app.core.db import init_db; init_db()"
```

### Step 4: Start the Backend API

Open a **new terminal** in VS Code:

```bash
cd /workspace/sonexial
make dev
```

Or manually:
```bash
cd /workspace/sonexial
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 5: Test the Scanner Endpoint

Open another terminal and run:

```bash
curl -X POST http://localhost:8000/scan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

You should get a JSON response with GEO score, failures, and recommendations.

### Step 6: Add Widget to Your Website

Open `/workspace/index.html` and find this section (around line 198):

```html
    </section>

    <!-- PROCESS -->
```

Insert the widget code **before** the PROCESS section. Copy everything from `/workspace/geo-scan-widget.html`:

```bash
# Copy the widget section (lines 6-52) and script (lines 54-240)
# Paste into index.html after the lead magnet section
```

**Important**: Update the API URL in the widget script (line 57 of geo-scan-widget.html):

```javascript
const API_BASE_URL = 'http://localhost:8000'; // For local testing
// Change to your deployed URL in production:
// const API_BASE_URL = 'https://your-api.fly.dev';
```

### Step 7: Test the Widget

1. Open your website: `http://localhost:8080` (or whatever port you use)
2. Scroll to the GEO Audit widget
3. Enter an author website URL (e.g., `https://brandonsanderson.com`)
4. Click "Run Free Audit"
5. You should see the scan results appear!

## Running All Services

For full functionality, you need **3 terminals**:

### Terminal 1: Your Existing Website
```bash
cd /workspace
npm run dev
# or however you normally start your site
```

### Terminal 2: Sonexial API
```bash
cd /workspace/sonexial
make dev
```

### Terminal 3: Worker (for background jobs)
```bash
cd /workspace/sonexial
make worker
```

The worker handles:
- Email sending
- Site generation
- GitHub repo creation
- Monthly reports

## Deployment to Production

### Deploy Backend to Fly.io

1. **Install Fly CLI**: https://fly.io/docs/hands-on/install-flyctl/

2. **Create Fly App**:
```bash
cd /workspace/sonexial
fly launch --name sonexial-api
```

3. **Set Environment Variables**:
```bash
fly secrets set APP_ENV=production
fly secrets set SECRET_KEY=<your-production-secret>
fly secrets set OPS_BEARER_TOKEN=<your-ops-token>
fly secrets set DATABASE_URL=<your-postgres-url>
fly secrets set TOGETHER_API_KEY=<your-together-key>
```

4. **Deploy**:
```bash
fly deploy
```

5. **Update Widget API URL**:
In `/workspace/geo-scan-widget.html` line 57:
```javascript
const API_BASE_URL = 'https://sonexial-api.fly.dev';
```

### Update CORS Settings

In `/workspace/sonexial/app/main.py`, update the CORS origins:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",      # Local dev
        "https://sonexial.com",       # Production
        "https://www.sonexial.com"    # Production www
    ],
    # ... rest of config
)
```

## Troubleshooting

### CORS Errors

If you see CORS errors in browser console:
1. Check `allow_origins` in `/workspace/sonexial/app/main.py`
2. Ensure your website URL is listed
3. Restart the API server

### Database Errors

If database initialization fails:
```bash
cd /workspace/sonexial
rm sonexial.db  # Delete SQLite DB
make db-upgrade  # Recreate
```

### Port Already in Use

If port 8000 is taken:
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Or use different port
uvicorn app.main:app --port 8001
```

Then update widget:
```javascript
const API_BASE_URL = 'http://localhost:8001';
```

### Scanner Returns 500 Error

Check API logs:
```bash
# In the API terminal, look for error messages
# Common issues:
# - Missing lxml: pip install lxml
# - SSRF blocking valid URLs: check logs for "SSRF_BLOCKED"
```

## Next Steps After Integration

1. **Enable Stripe Payments**: Add Stripe webhook endpoint to capture payments
2. **Set Up Email**: Configure Resend API key for automated emails
3. **Enable LLM Agents**: Add Together AI key for pitch generation
4. **Deploy Backend**: Push to Fly.io or Railway
5. **Add Lead Capture**: Connect scan results to email collection
6. **Monitor Usage**: Check `/ops/jobs` endpoint for job status

## File Locations Reference

| Component | Location | Purpose |
|-----------|----------|---------|
| Main API | `/workspace/sonexial/app/main.py` | FastAPI app entry point |
| Scanner | `/workspace/sonexial/app/services/scanner/` | GEO scanning logic |
| Widget | `/workspace/geo-scan-widget.html` | Frontend scan widget |
| Website | `/workspace/index.html` | Your main site |
| Models | `/workspace/sonexial/app/models/` | Database schemas |
| Workers | `/workspace/sonexial/app/worker/` | Background job processor |
| Config | `/workspace/sonexial/.env` | Environment variables |

## Testing Checklist

- [ ] Backend starts without errors
- [ ] `/health` endpoint returns `{"status": "ok"}`
- [ ] `/scan` endpoint accepts POST requests
- [ ] Widget appears on homepage
- [ ] Widget can submit URLs
- [ ] Scan results display correctly
- [ ] No CORS errors in browser console
- [ ] Mobile responsive design works
- [ ] Loading states show during scan
- [ ] Error messages display properly

## Support

If you encounter issues:
1. Check API logs in the terminal running the backend
2. Check browser console for JavaScript errors
3. Verify `.env` file has required variables
4. Ensure database is initialized (`make db-upgrade`)
5. Test with `curl` before using the widget

## Production Readiness

Before going live:
- [ ] Set strong `SECRET_KEY` (32+ random characters)
- [ ] Configure PostgreSQL database (not SQLite)
- [ ] Set up proper logging
- [ ] Enable rate limiting (`SCANNER_RATE_LIMIT_PER_HOUR`)
- [ ] Add physical mailing address to footer
- [ ] Update privacy policy
- [ ] Test with real author websites
- [ ] Set up monitoring/alerts
- [ ] Backup strategy for database
