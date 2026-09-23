# Fly.io Deployment Guide for Sonexial API

## Prerequisites

1. **Install Fly CLI**
   ```bash
   # macOS
   brew install flyctl
   
   # Linux
   curl -L https://fly.io/install.sh | sh
   
   # Windows (WSL)
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly.io**
   ```bash
   fly auth login
   ```

3. **Ensure you have a PostgreSQL database**
   - Use Supabase, Neon, or create one on Fly.io:
   ```bash
   fly pg create --name sonexial-db
   fly pg attach sonexial-db
   ```

## Step-by-Step Deployment

### 1. Initialize Fly App
```bash
cd /workspace/sonexial
fly launch --no-deploy
```
- Choose app name: `sonexial-api` (or your preferred name)
- Choose region: `iad` (Washington DC) or closest to your users
- Select "No" when asked to deploy yet

### 2. Update Configuration Files

The following files are already created:
- ✅ `fly.toml` - Fly.io configuration
- ✅ `Dockerfile` - Container build instructions

**Update `fly.toml` with your actual app name if different:**
```toml
app = "your-app-name"
```

### 3. Set Environment Variables (Secrets)

**CRITICAL: Set these secrets before deploying:**

```bash
# Database (get from Supabase/Neon/Fly Postgres)
fly secrets set DATABASE_URL="postgresql://user:pass@host:5432/sonexial"

# Security
fly secrets set SECRET_KEY=$(openssl rand -hex 32)
fly secrets set OPS_BEARER_TOKEN=$(openssl rand -hex 32)

# LLM Provider (Together AI)
fly secrets set TOGETHER_API_KEY="your-together-api-key"

# Email (Resend)
fly secrets set RESEND_API_KEY="your-resend-api-key"
fly secrets set OPERATOR_EMAIL="your-email@example.com"
fly secrets set EMAIL_FROM="Sonexial <noreply@yourdomain.com>"

# Stripe (optional for now)
fly secrets set STRIPE_SECRET_KEY="sk_test_..."
fly secrets set STRIPE_WEBHOOK_SECRET="whsec_..."

# Storage (if using Supabase)
fly secrets set SUPABASE_URL="https://xxx.supabase.co"
fly secrets set SUPABASE_SERVICE_KEY="your-service-key"

# GitHub (for client repo creation)
fly secrets set GITHUB_TOKEN="ghp_..."
fly secrets set GITHUB_ORG="brianplescher"

# Netlify (for client site deployment)
fly secrets set NETLIFY_AUTH_TOKEN="your-netlify-token"
```

### 4. Create Persistent Volume (for file storage)
```bash
fly volumes create sonexial_storage --region iad --size 1
```

### 5. Deploy to Fly.io
```bash
fly deploy --remote-only
```

### 6. Run Database Migrations
```bash
fly ssh console -C "alembic upgrade head"
```

### 7. Start Worker Process
You need to run the worker as a separate machine:

```bash
# Create a worker machine
fly machines clone $(fly machines list --json | jq -r '.[0].id') \
  --name sonexial-worker \
  --command "python -m app.worker.runner"
```

Or use fly processes (if supported):
```bash
fly scale count 1 --process-group worker
```

### 8. Verify Deployment
```bash
# Check app status
fly status

# View logs
fly logs

# Test health endpoint
curl https://sonexial-api.fly.dev/health

# Test scanner endpoint
curl -X POST https://sonexial-api.fly.dev/scan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

## Updating Your Deployment

After making code changes:

```bash
# Commit and push to GitHub
git add .
git commit -m "feat: your changes"
git push origin main

# Deploy to Fly.io
fly deploy --remote-only

# Run new migrations if any
fly ssh console -C "alembic upgrade head"
```

## Monitoring

```bash
# Real-time logs
fly logs

# App status
fly status

# List machines
fly machines list

# SSH into machine (for debugging)
fly ssh console
```

## Cost Estimate

- **Shared CPU 1x**: $5.99/month per machine
- **2 machines** (API + Worker): ~$12/month
- **PostgreSQL** (if hosted on Fly): ~$10/month
- **Storage** (1GB): Free tier
- **Bandwidth**: Free up to 160GB/month

**Total: ~$22-25/month** (well under your $30 constraint)

## Troubleshooting

### App won't start
```bash
fly logs --app sonexial-api
fly ssh console
```

### Database connection errors
- Verify DATABASE_URL is correct
- Ensure database allows connections from Fly.io IPs
- Check if migrations ran successfully

### Worker not processing jobs
```bash
fly ssh console -C "ps aux | grep worker"
fly ssh console -C "python -m app.worker.runner"
```

### Out of memory
```bash
# Increase memory in fly.toml
[[vm]]
  size = "shared-cpu-2x"
  memory = "1gb"
  
fly deploy
```

## Custom Domain (Optional)

```bash
# Add custom domain
fly certs add api.sonexial.com

# Update DNS records as instructed
# Then verify
fly certs check api.sonexial.com
```

## Next Steps After Deployment

1. Update your frontend `.env` or config with the Fly.io URL
2. Set up Stripe webhook endpoint: `https://sonexial-api.fly.dev/webhooks/stripe`
3. Configure Resend domain for production emails
4. Set up monitoring/alerting (Fly.io has built-in alerts)
5. Test the full workflow: scan → pitch → intake → site generation

## Important Notes

- **Auto-scaling**: Disabled by default to keep costs low
- **Auto-stop**: Disabled to ensure worker keeps running
- **Health checks**: Configured to restart unhealthy instances
- **Backups**: Enable daily backups for your Postgres DB
- **Logs**: Retained for 7 days by default on Fly.io
