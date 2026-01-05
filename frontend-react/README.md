# IoT Parking Management System - React Frontend

Modern React frontend for the IoT Parking Management System with real-time WebSocket updates.

## Features

- 🔐 **Authentication** - Secure login with JWT tokens
- 📊 **Dashboard** - Real-time parking status with statistics
- 🎫 **Card Management** - CRUD operations for RFID cards
- 📝 **Activity Logs** - Comprehensive logging with filtering
- 📈 **Reports & Analytics** - Visual charts for usage and revenue
- 🔴 **Real-time Updates** - WebSocket connection for live data
- 🎨 **Modern UI** - Built with Tailwind CSS and Lucide icons
- 📱 **Responsive Design** - Works on all devices

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool
- **React Router** - Routing
- **Axios** - HTTP client
- **Recharts** - Data visualization
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **date-fns** - Date formatting

## Prerequisites

- Node.js 18+ and npm
- Backend API running on http://localhost:8000

## Installation

1. **Install dependencies:**

   ```bash
   cd frontend-react
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file:**
   ```env
   VITE_API_BASE_URL=http://localhost:8000
   VITE_WS_URL=ws://localhost:8000/ws/realtime
   ```

## Development

Start the development server:

```bash
npm run dev
```

The app will be available at http://localhost:3000

## Building for Production

1. **Build the project:**

   ```bash
   npm run build
   ```

2. **Preview production build:**
   ```bash
   npm run preview
   ```

## Deployment

### Option 1: Static Hosting (Vercel, Netlify, etc.)

1. Build the project
2. Deploy the `dist` folder
3. Configure environment variables in your hosting platform

### Option 2: Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Build and run:

```bash
docker build -t iot-parking-frontend .
docker run -p 3000:80 iot-parking-frontend
```

### Option 3: Deploy with Backend

If deploying separately from the backend:

1. Update API URLs in production `.env`:

   ```env
   VITE_API_BASE_URL=https://your-api-domain.com
   VITE_WS_URL=wss://your-api-domain.com/ws/realtime
   ```

2. Build and deploy as above

## Project Structure

```
frontend-react/
├── src/
│   ├── components/       # Reusable components
│   │   ├── ActivityItem.jsx
│   │   ├── AddCardModal.jsx
│   │   ├── Layout.jsx
│   │   ├── Login.jsx
│   │   ├── ParkingSlot.jsx
│   │   ├── ProtectedRoute.jsx
│   │   └── StatCard.jsx
│   ├── contexts/        # React contexts
│   │   └── AuthContext.jsx
│   ├── pages/           # Page components
│   │   ├── Cards.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Logs.jsx
│   │   ├── Reports.jsx
│   │   └── Settings.jsx
│   ├── services/        # API services
│   │   ├── api.js
│   │   ├── index.js
│   │   └── websocket.js
│   ├── App.jsx          # Main app component
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles
├── public/              # Static assets
├── .env.example         # Environment template
├── index.html           # HTML template
├── package.json         # Dependencies
├── vite.config.js       # Vite configuration
└── tailwind.config.js   # Tailwind configuration
```

## API Integration

The frontend connects to the backend API at the configured `VITE_API_BASE_URL`. All API calls include JWT authentication tokens.

### Available Services

- **authService** - Login, logout
- **slotsService** - Get parking slots
- **cardsService** - CRUD operations for cards
- **logsService** - Get activity logs
- **statsService** - Get statistics and analytics
- **commandsService** - Control barriers, emergency mode
- **wsService** - WebSocket real-time updates

## Environment Variables

| Variable            | Description     | Example                           |
| ------------------- | --------------- | --------------------------------- |
| `VITE_API_BASE_URL` | Backend API URL | `http://localhost:8000`           |
| `VITE_WS_URL`       | WebSocket URL   | `ws://localhost:8000/ws/realtime` |

## Default Credentials

- **Username:** `admin`
- **Password:** `admin123`

## Features in Detail

### Dashboard

- Real-time parking slot status
- Statistics cards (total, available, occupied, revenue)
- Recent activity feed
- Manual barrier controls
- Emergency mode activation

### Cards Management

- List all registered RFID cards
- Add new cards
- Edit card information
- Activate/deactivate cards
- Delete cards
- View unknown cards detected by system

### Activity Logs

- Filter by action (entry/exit)
- Filter by status (success/denied)
- Search by card UID
- Detailed log information with timestamps

### Reports & Analytics

- Usage charts (daily/weekly/monthly)
- Revenue trends
- Interactive data visualization

## Troubleshooting

### CORS Issues

If you encounter CORS errors:

1. Ensure backend has CORS configured for your frontend origin
2. Check VITE_API_BASE_URL matches backend URL

### WebSocket Connection Failed

1. Verify backend WebSocket endpoint is running
2. Check VITE_WS_URL format (ws:// or wss://)
3. Ensure firewall allows WebSocket connections

### Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License
