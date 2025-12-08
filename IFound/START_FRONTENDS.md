# 🚀 How to View the Frontends

## Option 1: Admin Dashboard (Web - Easiest!)

The admin dashboard runs in your web browser and is **the easiest to view immediately**.

### Step 1: Start the Backend
```bash
cd IFound
docker-compose up -d
```

Wait about 30 seconds for services to start.

### Step 2: Start Admin Dashboard
```bash
cd frontend-admin
npm install
npm run dev
```

### Step 3: Open Browser
The dashboard will automatically open at: **http://localhost:3001**

### Step 4: Login
You'll need an admin account. Create one:

```bash
# In another terminal
cd backend
node -e "
const bcrypt = require('bcryptjs');
const { User } = require('./src/models');
const { sequelize } = require('./src/models');

sequelize.sync().then(async () => {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@ifound.com',
    password: hashedPassword,
    role: 'admin',
    is_verified: true,
    account_status: 'active'
  });
  console.log('Admin created! Email: admin@ifound.com, Password: admin123');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
"
```

**Login Credentials:**
- Email: `admin@ifound.com`
- Password: `admin123`

### What You'll See:

#### 📊 Dashboard Page
- **4 Statistics Cards:**
  - Total Users (with growth trend)
  - Active Cases (with weekly change)
  - Submissions Count (with trend)
  - Bounties Paid (total revenue)

- **3 Interactive Charts:**
  - Line Chart: Cases created over time (6 months)
  - Pie Chart: Cases by type (Missing Person, Criminal, Lost Item)
  - Bar Chart: Submission status distribution

- **Platform Health:**
  - Database: Connected ✅
  - API: Operational (99.9% uptime) ✅
  - Payment System: Active (Stripe) ✅
  - Notifications: Enabled (Email) ✅
  - AI/ML: Models Loaded ✅

#### 👥 Users Page
- **Data Grid** with all users
- **Columns:** ID, Name, Email, Role, Verified Status, Account Status, Join Date
- **Actions:**
  - Verify user button
  - Suspend/Unsuspend button
- **Features:**
  - Pagination (10/25/50/100 per page)
  - Sorting (click column headers)
  - Role badges with colors
  - Status indicators

#### 📁 Cases Page
- **All Cases** in data grid
- **Columns:** ID, Title, Type, Status, Bounty, Location, Created Date
- **Type Badges:**
  - Missing Person (Red)
  - Criminal (Orange)
  - Lost Item (Blue)
- **Actions:**
  - Suspend case
  - Activate case
- **Filtering** by status and type

#### 📝 Submissions Page
- **All Submissions** listed
- **Columns:** ID, Case ID, Type, Status, Description, Bounty %, Submitted Date
- **Actions:**
  - View Details (full modal)
  - Verify (approve and assign bounty)
  - Reject
- **Status Colors:**
  - Pending (Yellow)
  - Reviewing (Blue)
  - Verified (Green)
  - Rejected (Red)

#### 💰 Transactions Page
- **All Payment Transactions**
- **Columns:** ID, Type, Amount, Status, Case ID, Submission ID, Stripe ID, Date
- **Summary Bar:**
  - Total Transactions Count
  - Total Value (sum of all amounts)
- **Type Badges:**
  - Bounty Payment (Green)
  - Escrow (Blue)
  - Release (Purple)
  - Refund (Orange)

---

## Option 2: Mobile App (React Native - Requires Setup)

The mobile app is built with React Native and requires more setup.

### Prerequisites
- **iOS:** macOS with Xcode installed
- **Android:** Android Studio installed
- Node.js 18+

### Step 1: Install Dependencies
```bash
cd frontend
npm install
```

### Step 2: Configure Environment
```bash
cp .env.example .env

# Edit .env
# Set API_URL=http://localhost:3000/api/v1
# Or use your computer's IP for physical devices
```

### Step 3A: Run on iOS (macOS only)
```bash
cd ios
pod install
cd ..
npm run ios
```

### Step 3B: Run on Android
```bash
npm run android
```

### Mobile App Screens (13 total):

#### Authentication Flow:
1. **Onboarding Screen** - Welcome and app introduction
2. **Login Screen** - Email/password login
3. **Register Screen** - New user signup with role selection

#### Main App (Tab Navigation):
4. **Home Screen** - Case feed with filters
5. **Search Screen** - Advanced search with filters
6. **Create Case Screen** - Multi-step case posting
7. **Map View Screen** - Cases on map with markers
8. **Profile Screen** - User profile and settings

#### Modal Screens:
9. **Case Detail Screen** - Full case information
10. **Submit Tip Screen** - Submit tips/sightings
11. **My Cases Screen** - User's posted cases
12. **My Submissions Screen** - User's submitted tips
13. **Payment History Screen** - Transaction history

---

## Quick Start Script (All-in-One)

Create this file: `start-all.sh`

```bash
#!/bin/bash

echo "🚀 Starting I Found!! Platform..."

# Start backend services
echo "📦 Starting backend services (Docker)..."
cd IFound
docker-compose up -d

echo "⏳ Waiting for services to start..."
sleep 10

# Check backend health
echo "🏥 Checking backend health..."
curl -f http://localhost:3000/health || echo "Backend not ready yet, waiting..."
sleep 5

# Start admin dashboard
echo "🖥️ Starting Admin Dashboard..."
cd frontend-admin
npm run dev &
ADMIN_PID=$!

echo ""
echo "✅ Everything is starting!"
echo ""
echo "📊 Admin Dashboard: http://localhost:3001"
echo "🔧 Backend API: http://localhost:3000"
echo "📖 API Docs: http://localhost:3000/api/v1"
echo ""
echo "🔑 Default Admin Login:"
echo "   Email: admin@ifound.com"
echo "   Password: admin123"
echo ""
echo "Press Ctrl+C to stop"

wait $ADMIN_PID
```

Make it executable:
```bash
chmod +x start-all.sh
./start-all.sh
```

---

## Visual Preview

### Admin Dashboard UI:

```
┌─────────────────────────────────────────────────────────────┐
│  I Found!! Admin                                    [Avatar]│
├─────────────┬───────────────────────────────────────────────┤
│             │  Dashboard Overview                           │
│ Dashboard   │                                               │
│ Users       │  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ Cases       │  │ 👥 1,234 │ │ 📁 135   │ │ 📝 567   │     │
│ Submissions │  │  Users   │ │  Cases   │ │  Tips    │     │
│ Transactions│  │ +12% ↗   │ │ +8% ↗    │ │ +23% ↗   │     │
│             │  └──────────┘ └──────────┘ └──────────┘     │
│             │                                               │
│             │  ┌─────────────────────────────────────┐     │
│             │  │     Cases Over Time                 │     │
│             │  │  150┤                          ╱─╲  │     │
│             │  │  100┤                    ╱─╲╱     │     │
│             │  │   50┤            ╱─╲╱           │     │
│             │  │    0└──────────────────────────── │     │
│             │  └─────────────────────────────────────┘     │
│             │                                               │
└─────────────┴───────────────────────────────────────────────┘
```

### Material-UI Components Used:
- **Data Grid** (MUI X) - Advanced tables with sorting/filtering
- **Charts** (Recharts) - Line, Bar, Pie charts
- **Cards** - Clean stat displays
- **Chips** - Colored status badges
- **Dialogs** - Confirmation modals
- **Buttons** - Material Design buttons
- **Navigation** - Drawer sidebar

### Color Scheme:
- **Primary:** Blue (#1976d2)
- **Secondary:** Pink (#dc004e)
- **Success:** Green (#2e7d32)
- **Warning:** Orange (#ed6c02)
- **Error:** Red (#d32f2f)

---

## Troubleshooting

### Admin Dashboard Won't Start?
```bash
# Clear cache
cd frontend-admin
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Backend Not Running?
```bash
# Check Docker containers
docker-compose ps

# View backend logs
docker-compose logs backend

# Restart everything
docker-compose restart
```

### Can't Login?
```bash
# Check if admin user exists
docker-compose exec postgres psql -U ifound -d ifound -c "SELECT * FROM users WHERE role='admin';"

# Create admin user (see Step 4 above)
```

### Port Already in Use?
```bash
# Change admin port in vite.config.js:
# server: { port: 3002 }

# Or kill process using port 3001:
lsof -ti:3001 | xargs kill
```

---

## Next Steps

1. ✅ **View Admin Dashboard** - Follow Option 1
2. 📱 **Try Mobile App** - Follow Option 2 (optional)
3. 🧪 **Test Features:**
   - Create a test case
   - Submit a tip
   - Process a payment
   - Review submissions as admin
4. 📊 **Explore Analytics:**
   - View charts
   - Check metrics
   - Monitor health

**Enjoy exploring the platform!** 🎉
