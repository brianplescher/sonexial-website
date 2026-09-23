# Sonexial Integration Guide

This document explains how the Sonexial backend automation system integrates with your existing website setup in VS Code.

## Current Setup Overview

Your workspace contains:

1. **Existing Website** (`/workspace/` root)
   - Static HTML/CSS/JS files (`index.html`, `styles.css`, `script.js`)
   - Netlify deployment configured (`netlify.toml`)
   - Node.js dependencies for build tools
   - Existing intake forms (`optimization-intake.html`, `press-intake.html`)

2. **Sonexial Backend** (`/workspace/sonexial/`)
   - Python FastAPI API
   - PostgreSQL database
   - Background worker
   - GEO scanner service
   - LLM agents (Qwen via Together AI)
   - Site generator

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Existing Website                    │
│                   (Deployed to Netlify)                      │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ index.html   │    │ intake forms │    │  script.js   │  │
│  │ styles.css   │    │  calculator  │    │  analytics   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP API Calls
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Sonexial Backend (Fly.io/Railway)           │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  FastAPI     │    │   Worker     │    │   Database   │  │
│  │  Endpoints   │◄──►│   Processor  │◄──►│  (Supabase)  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                              │
│         ▼                    ▼                              │
│  ┌──────────────┐    ┌──────────────┐                      │
│  │ GEO Scanner  │    │ LLM Agents   │                      │
│  │  Service     │    │  (Qwen)      │                      │
│  └──────────────┘    └──────────────┘                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Deploy Sites
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               Client Sites (Netlify)                         │
│                                                              │
│  Generated static sites for paying clients                   │
│  - JSON-LD schema                                            │
│  - llms.txt                                                  │
│  - AI-optimized structure                                    │
└─────────────────────────────────────────────────────────────┘
```

## Integration Points

### 1. Add GEO Scan Widget to Your Website

Create a new file `/workspace/geo-scan-widget.html`:

```html
<!-- Add this to your existing index.html or create a dedicated scan page -->
<section id="geo-scan" class="scan-section">
  <h2>Free GEO Audit for Authors</h2>
  <p>See if AI engines can find your author website</p>
  
  <form id="geo-scan-form">
    <input 
      type="url" 
      id="author-url" 
      placeholder="https://yourauthorwebsite.com" 
      required
    />
    <button type="submit">Run Free Audit</button>
  </form>
  
  <div id="scan-results" class="hidden">
    <!-- Results injected here -->
  </div>
</section>

<script>
document.getElementById('geo-scan-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const url = document.getElementById('author-url').value;
  const resultsDiv = document.getElementById('scan-results');
  
  resultsDiv.innerHTML = '<p>Scanning... This takes ~2 seconds</p>';
  resultsDiv.classList.remove('hidden');
  
  try {
    // Point to your deployed Sonexial API
    const response = await fetch('https://your-api.fly.dev/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    const report = await response.json();
    
    resultsDiv.innerHTML = `
      <div class="score-card">
        <h3>GEO Score: ${report.score}/100</h3>
        <p>Grade: ${report.geo_grade}</p>
        ${report.critical_failures.length > 0 ? `
          <div class="failures">
            <h4>Critical Issues:</h4>
            <ul>${report.critical_failures.map(f => `<li>${f}</li>`).join('')}</ul>
          </div>
        ` : ''}
        ${report.recommendations.length > 0 ? `
          <div class="recommendations">
            <h4>Recommendations:</h4>
            <ul>${report.recommendations.map(r => `<li>${r}</li>`).join('')}</ul>
          </div>
        ` : ''}
        <button onclick="document.getElementById('contact-form').scrollIntoView()">
          Get Help Fixing These Issues
        </button>
      </div>
    `;
  } catch (error) {
    resultsDiv.innerHTML = '<p class="error">Scan failed. Please try again.</p>';
  }
});
</script>
```

### 2. Replace Existing Intake Forms

Your current intake forms (`optimization-intake.html`, `press-intake.html`) can be enhanced to submit to the Sonexial backend:

**Option A: Direct Form Submission**

Update form action to POST to your API:

```html
<form action="https://your-api.fly.dev/intake/{client_id}/submit" method="POST">
  <!-- existing fields -->
</form>
```

**Option B: JavaScript Submission (Recommended)**

```javascript
// In your existing script.js or optimization-intake.html
async function submitIntake(formData) {
  const response = await fetch('https://your-api.fly.dev/intake/client-uuid-here/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  });
  
  if (response.ok) {
    // Show success message
    window.location.href = '/thank-you.html';
  }
}
```

### 3. VS Code Workspace Configuration

Update your workspace file for both projects:

**File: `/workspace/Sonexial-Website.code-workspace`**

```json
{
  "folders": [
    {
      "name": "Sonexial Website",
      "path": "."
    },
    {
      "name": "Sonexial Backend",
      "path": "./sonexial"
    }
  ],
  "settings": {
    "python.defaultInterpreterPath": "${workspaceFolder:Sonexial Backend}/.venv/bin/python",
    "python.terminal.activateEnvironment": true,
    "editor.formatOnSave": true,
    "[python]": {
      "editor.defaultFormatter": "ms-python.black-formatter",
      "editor.codeActionsOnSave": {
        "source.organizeImports": true
      }
    },
    "[html]": {
      "editor.defaultFormatter": "vscode.html-language-features"
    },
    "[javascript]": {
      "editor.defaultFormatter": "vscode.typescript-language-features"
    }
  },
  "extensions": {
    "recommendations": [
      "ms-python.python",
      "ms-python.vscode-pylance",
      "ms-python.black-formatter",
      "esbenp.prettier-vscode",
      "bradlc.vscode-tailwindcss"
    ]
  }
}
```

### 4. Local Development Workflow

**Terminal 1 - Your Existing Website:**
```bash
cd /workspace
npx http-server -p 3000
# Or use your existing Netlify dev setup
```

**Terminal 2 - Sonexial Backend:**
```bash
cd /workspace/sonexial
make install
cp .env.example .env
# Edit .env with your secrets
make db-upgrade
make dev
```

**Terminal 3 - Background Worker:**
```bash
cd /workspace/sonexial
make worker
```

### 5. Environment Configuration

Create `/workspace/sonexial/.env` based on `.env.example`:

```bash
# Minimum for local development
APP_ENV=development
APP_BASE_URL=http://localhost:8000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sonexial
SECRET_KEY=dev-secret-key-min-32-characters-long
OPS_BEARER_TOKEN=dev-ops-token-change-in-production

# Optional - add when ready
TOGETHER_API_KEY=your_key_here
STRIPE_SECRET_KEY=sk_test_...
RESEND_API_KEY=re_...
```

### 6. Deployment Strategy

**Existing Website (sonexial.com):**
- Continues deploying to Netlify as before
- Add API calls to Sonexial backend for dynamic features

**Sonexial Backend:**
- Deploy to Fly.io or Railway
- Database on Supabase or Neon
- Environment variables set in hosting platform

**Client Sites:**
- Generated by Sonexial backend
- Deployed to Netlify via API
- Separate from main sonexial.com site

### 7. Adding Backend Features to Frontend

**Example: Real-time Scan Status**

```javascript
// Add to your existing script.js
class GEOScanner {
  constructor(apiBaseUrl) {
    this.apiBaseUrl = apiBaseUrl;
  }
  
  async scan(url) {
    const response = await fetch(`${this.apiBaseUrl}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    return await response.json();
  }
  
  async requestPitch(scanData, authorName) {
    const response = await fetch(`${this.apiBaseUrl}/generate-pitch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...scanData,
        author_name: authorName
      })
    });
    return await response.json();
  }
}

// Usage
const scanner = new GEOScanner('http://localhost:8000'); // or production URL
```

### 8. Testing Integration Locally

1. Start PostgreSQL (Docker):
```bash
docker run -d \
  --name sonexial-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=sonexial \
  -p 5432:5432 \
  postgres:15
```

2. Install and run backend:
```bash
cd /workspace/sonexial
make install
make db-upgrade
make seed  # Optional: adds test data
make dev
```

3. Test scanner from your frontend:
```bash
curl -X POST http://localhost:8000/scan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### 9. Production Checklist

Before going live:

- [ ] Set all environment variables in hosting platform
- [ ] Change `SECRET_KEY` and `OPS_BEARER_TOKEN`
- [ ] Configure CORS origins in backend to include your domain
- [ ] Set up Stripe webhook endpoint
- [ ] Test email sending with Resend
- [ ] Verify database migrations ran
- [ ] Test full flow: scan → pitch → intake → site generation
- [ ] Set up monitoring/logging (Fly.io has built-in logs)

### 10. File Organization Reference

```
/workspace/
├── index.html                    # Your main site - KEEP
├── styles.css                    # Your styles - KEEP
├── script.js                     # Your JS - KEEP/ENHANCE
├── netlify.toml                  # Netlify config - KEEP
├── optimization-intake.html      # Consider replacing with API integration
├── press-intake.html             # Consider replacing with API integration
├── calculator.html               # Your calculator - KEEP
├── sonexial/                     # NEW: Backend automation
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── api/                 # Endpoints
│   │   ├── services/            # Business logic
│   │   ├── models/              # Database models
│   │   └── worker/              # Background jobs
│   ├── site_template/           # Client site templates
│   ├── scripts/                 # CLI tools
│   ├── tests/                   # Test suite
│   ├── Makefile                 # Dev commands
│   └── .env.example             # Environment template
└── Sonexial-Website.code-workspace  # UPDATE with multi-folder setup
```

## Next Steps

1. **Immediate**: Update workspace configuration for multi-project development
2. **Short-term**: Add GEO scan widget to your existing site
3. **Medium-term**: Deploy backend to Fly.io/Railway
4. **Long-term**: Integrate Stripe payments and automated client onboarding

## Support

For issues:
- Backend bugs: Check `/workspace/sonexial/tests/` for examples
- API docs: Run `make dev` and visit `http://localhost:8000/docs`
- Database: Use `make db-migrate msg="description"` for schema changes
