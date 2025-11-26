# Deployment Guide

This guide covers deploying the multiplayer Tic-Tac-Toe game to production.

## Prerequisites

- Docker and Docker Compose installed
- A cloud provider account (AWS, GCP, DigitalOcean, etc.)
- A Vercel account (for frontend deployment)
- Git repository set up

## Deployment Architecture

```
Frontend (Vercel) → Nakama Server (Cloud VM) → CockroachDB (Docker)
```

## Backend Deployment (Nakama + CockroachDB)

### Option 1: DigitalOcean Droplet (Recommended for simplicity)

#### 1. Create a Droplet

```bash
# Create a DigitalOcean Droplet with:
# - Ubuntu 22.04 LTS
# - 2 GB RAM / 1 vCPU (minimum)
# - 50 GB SSD
```

#### 2. SSH into your Droplet

```bash
ssh root@your-droplet-ip
```

#### 3. Install Docker and Docker Compose

```bash
# Update package lists
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Start Docker
systemctl start docker
systemctl enable docker
```

#### 4. Clone your repository

```bash
git clone https://github.com/yourusername/multiplayer-tic-tac-toe.git
cd multiplayer-tic-tac-toe/backend
```

#### 5. Update docker-compose.yml for production

Edit `docker-compose.yml`:

```yaml
version: '3.8'

services:
  cockroach:
    image: cockroachdb/cockroach:latest-v23.1
    command: start-single-node --insecure
    volumes:
      - cockroach-data:/cockroach/cockroach-data
    networks:
      - nakama-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health?ready=1"]
      interval: 3s
      timeout: 3s
      retries: 5

  nakama:
    image: heroiclabs/nakama:3.22.0
    depends_on:
      cockroach:
        condition: service_healthy
    environment:
      - "NAKAMA_DATABASE_ADDRESS=root@cockroach:26257"
    ports:
      - "7350:7350"  # HTTP API
      - "7351:7351"  # gRPC API
    volumes:
      - ./build:/nakama/data/modules
    networks:
      - nakama-network
    restart: unless-stopped

volumes:
  cockroach-data:

networks:
  nakama-network:
    driver: bridge
```

#### 6. Build and start services

```bash
# Build the backend module
npm install
npm run build

# Start Docker services
docker-compose up -d

# Check logs
docker-compose logs -f
```

#### 7. Configure Firewall

```bash
# Allow HTTP API port
ufw allow 7350/tcp

# Allow SSH
ufw allow 22/tcp

# Enable firewall
ufw enable
```

#### 8. Verify Deployment

```bash
# Test the endpoint
curl http://your-droplet-ip:7350

# Should return Nakama server info
```

### Option 2: AWS EC2

#### 1. Launch EC2 Instance

- AMI: Ubuntu Server 22.04 LTS
- Instance Type: t3.small (minimum)
- Storage: 30 GB GP3
- Security Group: Allow ports 7350, 7351, 22

#### 2. Connect and Setup

```bash
ssh -i your-key.pem ubuntu@ec2-instance-public-ip

# Follow steps 3-8 from DigitalOcean guide above
```

### Option 3: Google Cloud Platform

#### 1. Create Compute Engine Instance

```bash
gcloud compute instances create nakama-server \
  --machine-type=e2-medium \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --tags=nakama-server

# Allow firewall rules
gcloud compute firewall-rules create allow-nakama \
  --allow=tcp:7350,tcp:7351 \
  --target-tags=nakama-server
```

#### 2. SSH and Setup

```bash
gcloud compute ssh nakama-server

# Follow steps 3-8 from DigitalOcean guide above
```

## Frontend Deployment (Vercel)

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Configure Environment Variables

Create `.env.production` in the frontend directory:

```env
NEXT_PUBLIC_NAKAMA_SERVER=http://your-server-ip:7350
NEXT_PUBLIC_NAKAMA_KEY=defaultkey
```

### 3. Update Nakama Client Configuration

Edit `frontend/lib/nakama.ts`:

```typescript
export function createClient(): Client {
  return new Client(
    process.env.NEXT_PUBLIC_NAKAMA_KEY || "defaultkey",
    process.env.NEXT_PUBLIC_NAKAMA_SERVER || "localhost",
    "7350",
    false // Set to true if using HTTPS
  );
}
```

### 4. Deploy to Vercel

```bash
cd frontend

# Login to Vercel
vercel login

# Deploy
vercel --prod

# Follow prompts and add environment variables:
# NEXT_PUBLIC_NAKAMA_SERVER: http://your-server-ip:7350
# NEXT_PUBLIC_NAKAMA_KEY: defaultkey
```

### Alternative: Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build the app
npm run build

# Deploy
netlify deploy --prod --dir=out
```

## Production Checklist

### Backend
- [ ] Nakama server is running and accessible
- [ ] CockroachDB is running with persistent storage
- [ ] Firewall rules are configured
- [ ] Docker containers restart on failure
- [ ] Logs are being monitored

### Frontend
- [ ] Environment variables are set correctly
- [ ] Build succeeds without errors
- [ ] Connection to Nakama server works
- [ ] CORS is configured if needed

## Testing the Deployment

### 1. Test Nakama Health

```bash
curl http://your-server-ip:7350
```

### 2. Test Frontend Connection

Open your deployed frontend URL in two browser windows:
1. Enter different usernames
2. Click "Continue" on both
3. Players should be matched and game should start
4. Make moves to verify game logic
5. Test "Play Again" functionality

### 3. Test Leaderboard

```bash
# List leaderboard
curl -X GET "http://your-server-ip:7350/v2/leaderboard/global_wins?limit=10" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Monitoring and Maintenance

### Check Docker Logs

```bash
docker-compose logs -f nakama
docker-compose logs -f cockroach
```

### Restart Services

```bash
docker-compose restart
```

### Update Backend Code

```bash
cd backend
git pull
npm run build
docker-compose restart nakama
```

### Backup Database

```bash
docker exec -it backend-cockroach-1 \
  cockroach dump defaultdb \
  --insecure > backup.sql
```

## Troubleshooting

### Nakama Won't Start

```bash
# Check logs
docker-compose logs nakama

# Common issues:
# 1. CockroachDB not ready - wait 30 seconds
# 2. Port conflicts - check if port 7350 is in use
# 3. Module compilation errors - check build/index.js exists
```

### Frontend Can't Connect

```bash
# Verify Nakama is accessible
curl http://your-server-ip:7350

# Check browser console for CORS errors
# If CORS error, ensure Nakama allows your frontend domain
```

### Players Can't Match

```bash
# Check Nakama logs for matchmaking
docker-compose logs -f nakama | grep matchmaker

# Verify module is loaded
docker-compose logs nakama | grep "Tic-Tac-Toe module loaded"
```

## Cost Estimates

### DigitalOcean
- Basic Droplet (2GB RAM): ~$12/month
- Vercel (Free tier): $0/month
- **Total: ~$12/month**

### AWS
- t3.small EC2: ~$15/month
- 30GB Storage: ~$3/month  
- Vercel (Free tier): $0/month
- **Total: ~$18/month**

### GCP
- e2-medium: ~$24/month
- 30GB Storage: ~$2/month
- Vercel (Free tier): $0/month
- **Total: ~$26/month**

## Security Recommendations

1. **Use HTTPS**: Set up SSL/TLS certificates (Let's Encrypt)
2. **Change Default Keys**: Update Nakama server key
3. **Enable Authentication**: Configure proper user authentication
4. **Database Security**: Use CockroachDB with authentication in production
5. **Rate Limiting**: Configure Nakama rate limits
6. **Monitoring**: Set up monitoring and alerts

## Next Steps

1. Deploy backend to your chosen cloud provider
2. Deploy frontend to Vercel
3. Test end-to-end functionality
4. Monitor for 24 hours
5. Share deployment URLs in your submission

## Support Resources

- [Nakama Documentation](https://heroiclabs.com/docs/)
- [Vercel Documentation](https://vercel.com/docs)
- [Docker Documentation](https://docs.docker.com/)
- [CockroachDB Documentation](https://www.cockroachlabs.com/docs/)
