# Sonexial Integration Complete ✅

## What's Been Done

Your Sonexial GEO Scanner backend is now fully integrated with your existing website. Here's what I've set up:

### 1. Widget Added to Homepage
- **Location**: `/workspace/index.html` (lines 200-439)
- **Features**: 
  - Clean, responsive design matching your site
  - Real-time scan results with color-coded scores
  - Critical failures and recommendations display
  - Call-to-action buttons linking to contact form
  - Loading states and error handling

### 2. Setup Documentation Created
- **File**: `/workspace/SETUP_INSTRUCTIONS.md`
- Contains step-by-step integration guide
- Troubleshooting section included
- Production deployment instructions

### 3. Quick Start Script
- **File**: `/workspace/start-sonexial.sh`
- One-command startup for the backend
- Auto-generates secure environment variables
- Installs dependencies if needed

## How to Use Right Now

### Option A: Quick Start (Recommended)

Open a terminal in VS Code and run:

```bash
cd /workspace
./start-sonexial.sh
```

This will:
1. Create secure `.env` file automatically
2. Install Python dependencies
3. Initialize the database
4. Start the API server on port 8000

Then open your website and test the widget!

### Option B: Manual Setup

1. **Create environment file**:
```bash
cd /workspace/sonexial
cp .env.example .env
```

2. **Edit `.env`** and set these minimum values:
```bash
APP_ENV=development
DATABASE_URL=sqlite:///./sonexial.db
SECRET_KEY=<generate-random-32-chars>
OPS_BEARER_TOKEN=<generate-random-token>
```

3. **Install dependencies**:
```bash
cd /workspace/sonexial
pip install -e .
```

4. **Start the API**:
```bash
cd /workspace/sonexial
uvicorn app.main:app --reload --port 8000
```

5. **Test it**:
   - Open your website (usually http://localhost:8080)
   - Scroll to "Free GEO Audit for Authors"
   - Enter a URL like `https://example.com`
   - Click "Run Free Audit"

## File Structure Reference

```
/workspace/
├── index.html                    ← Your main site (widget added here)
├── geo-scan-widget.html          ← Standalone widget template (reference only)
├── SETUP_INSTRUCTIONS.md         ← Detailed setup guide
├── start-sonexial.sh             ← Quick start script
├── INTEGRATION_GUIDE.md          ← Architecture documentation
└── sonexial/                     ← Backend code
    ├── .env                      ← Environment variables (auto-generated)
    ├── app/
    │   ├── main.py               ← FastAPI application
    │   ├── services/scanner/     ← GEO scanning logic
    │   └── worker/               ← Background jobs
    └── tests/                    ← Test suite
```

## Testing Checklist

Before deploying to production, verify:

- [ ] Backend starts without errors
- [ ] Visit http://localhost:8000/health → shows `{"status":"ok"}`
- [ ] Widget appears on your homepage
- [ ] Can enter a URL and submit
- [ ] Scan results display correctly
- [ ] No errors in browser console (F12)
- [ ] Mobile layout looks good
- [ ] Contact form link works from results

## Production Deployment

When ready to go live:

### 1. Deploy Backend to Fly.io

```bash
cd /workspace/sonexial
fly launch --name sonexial-api
fly deploy
```

### 2. Set Production Secrets

```bash
fly secrets set APP_ENV=production
fly secrets set SECRET_KEY=<your-production-key>
fly secrets set DATABASE_URL=<postgres-url>
fly secrets set TOGETHER_API_KEY=<your-together-key>
```

### 3. Update Widget API URL

In `/workspace/index.html`, find line ~270 and change:

```javascript
const API_BASE_URL = 'https://sonexial-api.fly.dev'; // Your production URL
```

### 4. Update CORS Settings

In `/workspace/sonexial/app/main.py`, update CORS origins:

```python
allow_origins=[
    "https://sonexial.com",
    "https://www.sonexial.com"
],
```

## Cost Estimates

The system is designed to be extremely cheap:

| Service | Free Tier | Paid Tier | Notes |
|---------|-----------|-----------|-------|
| Fly.io | ✓ 3 VMs | ~$5/mo | Backend hosting |
| Supabase | ✓ 500MB DB | ~$0/mo initially | Database |
| Together AI | Pay per use | ~$0.01/scan | LLM costs |
| Resend | ✓ 3k emails/mo | $0 initially | Transactional email |
| Netlify | ✓ 100GB/mo | $0 for static sites | Client sites |

**Total estimated cost**: Under $10/month for first 100 scans
**At 1000 scans/month**: Under $30/month (as specified in brief)

## Next Steps to Monetize

1. **Enable Stripe Payments**
   - Add Stripe webhook endpoint
   - Create products in Stripe dashboard
   - Update `.env` with Stripe keys

2. **Add Lead Capture**
   - Modify widget to collect email before showing full report
   - Connect to email automation

3. **Enable LLM Pitch Generation**
   - Add Together AI API key
   - Test pitch agent with real scans
   - Set up approval workflow

4. **Deploy & Monitor**
   - Push backend to Fly.io
   - Set up basic monitoring
   - Track scan usage and costs

## Support & Troubleshooting

### Common Issues

**CORS Errors:**
- Check that your website URL is in `allow_origins` in `app/main.py`
- Restart the API after changes

**Database Errors:**
- Delete `sonexial.db` and restart
- Or switch to PostgreSQL with Supabase

**Port Conflicts:**
```bash
# Find what's using port 8000
lsof -ti:8000 | xargs kill -9
```

**Scanner Returns 500:**
- Check API terminal logs
- Ensure `lxml` is installed: `pip install lxml`

### Getting Help

1. Check API logs in the terminal
2. Check browser console (F12) for JavaScript errors
3. Review `SETUP_INSTRUCTIONS.md` troubleshooting section
4. Test with curl first: 
   ```bash
   curl -X POST http://localhost:8000/scan \
     -H "Content-Type: application/json" \
     -d '{"url": "https://example.com"}'
   ```

## Summary

You now have a complete GEO scanning system integrated into your website. The widget is live on your homepage, ready to capture leads and demonstrate value to potential clients. 

The backend runs independently, so your existing Netlify deployment is unaffected. When you're ready to scale, deployment instructions are in `SETUP_INSTRUCTIONS.md`.

**Ready to test?** Run `./start-sonexial.sh` and visit your website!
