# I Found!! Admin Dashboard

Professional admin panel for managing the I Found!! platform.

## Features

### 📊 Dashboard (Home)
- Real-time statistics cards
- Interactive charts (line, bar, pie)
- Platform health monitoring
- System metrics

### 👥 User Management
- View all users with pagination
- Verify user accounts
- Suspend/unsuspend users
- Filter by role and status

### 📁 Case Management
- View all cases
- Suspend inappropriate cases
- Filter by type and status
- Case moderation tools

### 📝 Submission Review
- Review pending tips/sightings
- Verify or reject submissions
- View submission details
- Assign bounty percentages

### 💰 Transaction Monitoring
- View all payments
- Filter by transaction type
- Track bounties paid
- Monitor platform revenue

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# Copy example env
cp .env.example .env

# The default points to localhost:3000
# VITE_API_URL=http://localhost:3000/api/v1
```

### 3. Start Development Server
```bash
npm run dev
```

The dashboard will open at **http://localhost:3001**

### 4. Login
Use an admin account:
- Email: `admin@test.com`
- Password: `password123`

**Note:** You need to create an admin user in the backend first, or register a new user and set their role to 'admin' in the database.

## Build for Production

```bash
npm run build
```

Outputs to `dist/` directory.

## Preview Production Build

```bash
npm run preview
```

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool (fast HMR)
- **Material-UI (MUI)** - Component library
- **MUI X Data Grid** - Advanced data tables
- **Recharts** - Charts and visualizations
- **React Router** - Navigation
- **Axios** - HTTP client
- **date-fns** - Date formatting

## Project Structure

```
frontend-admin/
├── src/
│   ├── main.jsx              # App entry point
│   ├── App.jsx               # Route definitions
│   ├── theme.js              # MUI theme config
│   ├── components/
│   │   ├── Layout.jsx        # Main layout with sidebar
│   │   └── LoadingScreen.jsx # Loading spinner
│   ├── context/
│   │   └── AuthContext.jsx   # Authentication state
│   ├── pages/
│   │   ├── LoginPage.jsx     # Admin login
│   │   ├── DashboardPage.jsx # Analytics dashboard
│   │   ├── UsersPage.jsx     # User management
│   │   ├── CasesPage.jsx     # Case moderation
│   │   ├── SubmissionsPage.jsx # Submission review
│   │   └── TransactionsPage.jsx # Payment monitoring
│   └── services/
│       └── api.js            # API client
├── index.html
├── vite.config.js
└── package.json
```

## Available Pages

| Route | Page | Description |
|-------|------|-------------|
| `/login` | Login | Admin authentication |
| `/dashboard` | Dashboard | Analytics overview |
| `/users` | Users | User management |
| `/cases` | Cases | Case moderation |
| `/submissions` | Submissions | Submission review |
| `/transactions` | Transactions | Payment monitoring |

## Screenshots

### Dashboard
- 4 stat cards (Users, Cases, Submissions, Bounties)
- Line chart: Cases over time
- Pie chart: Cases by type
- Bar chart: Submission status
- Platform health indicators

### User Management
- Data grid with all users
- Verify/Suspend buttons
- Role badges (admin/poster/finder)
- Status indicators
- Pagination controls

### Case Management
- All cases listed
- Type badges (missing person, criminal, lost item)
- Status badges (active, suspended, resolved)
- Suspend/Activate actions
- Filter controls

### Submission Review
- Pending submissions highlighted
- Verify/Reject buttons
- Details modal
- Bounty percentage field
- Case linkage

### Transaction Monitoring
- All payment transactions
- Type categorization
- Stripe ID tracking
- Total value summary
- Date sorting

## Development

### Run linter
```bash
npm run lint
```

### Format code
```bash
npm run lint:fix
```

## Deployment

See [DEPLOYMENT.md](../DEPLOYMENT.md) in the root directory for production deployment instructions.

## API Integration

The dashboard connects to the backend API at the URL specified in `.env`:

```env
VITE_API_URL=http://localhost:3000/api/v1
```

All API requests include JWT authentication tokens stored in localStorage.

## Authentication Flow

1. User enters email/password on login page
2. API validates credentials and checks for admin role
3. JWT token stored in localStorage
4. Token sent with all subsequent requests
5. Auto-redirect to /dashboard on success
6. Auto-logout on 401 responses

## Security

- Admin role verification on login
- Protected routes (redirect to /login if not authenticated)
- JWT tokens in headers
- HTTPS required in production
- CORS configured for API domain
- Rate limiting on API side

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

Proprietary - I Found!! Team
