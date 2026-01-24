# Heritage World

A 3D interactive heritage site explorer built with Babylon.js and Vite.

## Development

### Prerequisites

- Node.js 20.x or higher
- npm

### Getting Started

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your server URL:
```env
VITE_SERVER_URL=http://localhost:2567
```

3. Start the development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Deployment

This project uses GitHub Actions to build and create deployment artifacts. The built files are then deployed to your server manually using the provided deployment script.

### Remote Server Setup

#### 1. Server Requirements

- A Linux server (Ubuntu/Debian recommended)
- Nginx or Apache web server installed
- SSH access with sudo privileges

#### 2. Install Nginx (if not already installed)

```bash
sudo apt update
sudo apt install nginx -y
```

#### 3. Create Deployment Directory

```bash
# Create the directory where files will be deployed
sudo mkdir -p /var/www/heritage-world
sudo chown -R $USER:$USER /var/www/heritage-world
chmod -R 755 /var/www/heritage-world
```

#### 4. Configure Nginx

Create a new Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/heritage-world
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain or IP

    root /var/www/heritage-world;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|glb|gltf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/heritage-world /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 5. Install Required Tools

Install tools needed for the deployment script:

```bash
sudo apt update
sudo apt install jq curl unzip -y
```

#### 6. Deploy Using the Deployment Script

Copy the deployment script to your server:

```bash
scp deploy-server.sh user@your-server-ip:~
ssh user@your-server-ip
```

On the server, configure the script:

```bash
nano deploy-server.sh
```

Edit the `GITHUB_REPO` variable to match your repository:
```bash
GITHUB_REPO="yourusername/threejs-3d"
```

Make the script executable:

```bash
chmod +x deploy-server.sh
```

For **public repositories**, run directly:

```bash
./deploy-server.sh
```

For **private repositories**, create a GitHub Personal Access Token with `repo` scope at https://github.com/settings/tokens and run:

```bash
export GITHUB_TOKEN='your_github_personal_access_token'
./deploy-server.sh
```

The script will:
- Download the latest successful build from GitHub Actions
- Create a backup of the current deployment
- Extract and deploy the new build
- Reload nginx
- Keep the last 5 backups

#### 7. Verify Deployment

Push to the `main` branch and GitHub Actions will automatically:
1. Check code formatting
2. Run linting
3. Build the project
4. Create and upload a tarball artifact (retained for 7 days)

Monitor the build in the **Actions** tab of your GitHub repository.

Once the build completes successfully, run the deployment script on your server to deploy the latest build.

### Deployment Workflow

**Every push to main:**
1. GitHub Actions builds the project automatically
2. A tarball artifact is created and stored for 7 days
3. SSH into your server and run `./deploy-server.sh` to deploy

### Manual Deployment

To deploy manually via SSH:

```bash
# Build the project
npm run build

# Deploy to server
rsync -avz --delete dist/ user@your-server-ip:/var/www/heritage-world/
```

## Project Structure

```
threejs-3d/
├── .github/
│   └── workflows/
│       └── ci.yml          # CI/CD pipeline
├── public/
│   └── assets/
│       ├── models/         # 3D models (GLB/GLTF)
│       └── textures/
│           └── skybox/     # Skybox textures
├── scripts/
│   └── main.ts            # Main application entry point
├── index.html             # HTML entry point
├── package.json
└── vite.config.js         # Vite configuration
```

## Technologies

- **Babylon.js** - 3D rendering engine
- **Vite** - Build tool and dev server
- **TypeScript** - Type-safe JavaScript
- **Colyseus** - Multiplayer game server
- **GitHub Actions** - CI/CD automation

## License

MIT
