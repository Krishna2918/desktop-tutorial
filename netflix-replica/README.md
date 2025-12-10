# Netflix Replica

A full-stack Netflix clone with video streaming, user authentication, and a modern Netflix-style UI.

## Features

### Frontend
- 🎬 Netflix-style UI with hero banner and content rows
- 🔐 User authentication (login/register)
- 🎥 Video player with progress tracking
- 🔍 Search functionality
- 📝 My List feature
- 📺 Continue watching
- 🎭 Multiple profiles support
- 📱 Responsive design

### Backend
- 🔒 JWT-based authentication
- 🎬 Video management with categories and genres
- 📊 Watch history tracking
- ⭐ My List/Favorites system
- 🔎 Full-text search
- 📈 Trending and new releases
- 🎯 Content categorization

## Tech Stack

### Frontend
- React 18
- React Router DOM
- Axios
- React Icons

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT (JSON Web Tokens)
- Bcrypt.js
- CORS

## Project Structure

```
netflix-replica/
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── videoController.js
│   │   ├── categoryController.js
│   │   └── watchHistoryController.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Video.js
│   │   ├── Category.js
│   │   ├── WatchHistory.js
│   │   └── MyList.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── videos.js
│   │   ├── categories.js
│   │   └── watchHistory.js
│   ├── middleware/
│   │   └── auth.js
│   ├── scripts/
│   │   └── seed.js
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── server.js
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.js
    │   │   ├── HeroBanner.js
    │   │   ├── Row.js
    │   │   └── VideoPlayer.js
    │   ├── pages/
    │   │   ├── Home.js
    │   │   ├── Login.js
    │   │   ├── Register.js
    │   │   ├── Search.js
    │   │   └── MyList.js
    │   ├── context/
    │   │   └── AuthContext.js
    │   ├── services/
    │   │   └── api.js
    │   ├── styles/
    │   │   └── App.css
    │   ├── App.js
    │   └── index.js
    ├── .env.example
    ├── .gitignore
    └── package.json
```

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd netflix-replica/backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/netflix-replica
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRE=7d
NODE_ENV=development
```

5. Start MongoDB:
```bash
# On macOS with Homebrew
brew services start mongodb-community

# On Ubuntu/Debian
sudo systemctl start mongod

# On Windows
net start MongoDB
```

6. Seed the database (optional):
```bash
npm run seed
```

7. Start the backend server:
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd netflix-replica/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Update `.env` if needed:
```env
REACT_APP_API_URL=http://localhost:5000/api
```

5. Start the frontend development server:
```bash
npm start
```

The frontend will run on `http://localhost:3000`

## Usage

### 1. Register a New Account
- Navigate to `http://localhost:3000/register`
- Enter your name, email, and password
- Click "Sign Up"

### 2. Login
- Navigate to `http://localhost:3000/login`
- Enter your email and password
- Click "Sign In"

### 3. Browse Content
- View featured content in the hero banner
- Scroll through different content rows (Trending, New Releases, by Genre)
- Click on any thumbnail to play the video

### 4. Search
- Click "Search" in the navigation
- Type your search query
- Click on any result to play

### 5. My List
- Click "My List" to see your saved videos
- View your watch history under "Continue Watching"

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)
- `PUT /api/auth/profile` - Update user profile (protected)

### Videos
- `GET /api/videos` - Get all videos (protected)
- `GET /api/videos/featured` - Get featured video (protected)
- `GET /api/videos/trending` - Get trending videos (protected)
- `GET /api/videos/new-releases` - Get new releases (protected)
- `GET /api/videos/:id` - Get video by ID (protected)
- `GET /api/videos/genre/:genre` - Get videos by genre (protected)
- `GET /api/videos/search/:query` - Search videos (protected)

### Watch History & My List
- `GET /api/watch/history` - Get watch history (protected)
- `POST /api/watch/history` - Update watch progress (protected)
- `GET /api/watch/mylist` - Get my list (protected)
- `POST /api/watch/mylist` - Add to my list (protected)
- `DELETE /api/watch/mylist/:videoId` - Remove from my list (protected)

### Categories
- `GET /api/categories` - Get all categories (protected)
- `GET /api/categories/:slug` - Get category by slug (protected)

## Database Models

### User
- email (unique)
- password (hashed)
- name
- profiles (array)
- subscription (plan, status, expiresAt)

### Video
- title
- description
- videoUrl
- thumbnailUrl
- bannerUrl
- duration
- year
- rating
- genres (array)
- categories (array, refs)
- cast (array)
- director
- isTrending
- isNewRelease
- isFeatured
- viewCount
- likeCount

### Category
- name (unique)
- slug (unique)
- description
- thumbnailUrl
- order

### WatchHistory
- user (ref)
- video (ref)
- profileIndex
- progress (in seconds)
- completed
- lastWatchedAt

### MyList
- user (ref)
- video (ref)
- profileIndex
- addedAt

## Features to Add (Future Enhancements)

- [ ] Video upload functionality
- [ ] Admin panel for content management
- [ ] Recommendation system
- [ ] Comments and ratings
- [ ] Subtitle support
- [ ] Multiple video quality options
- [ ] Download for offline viewing
- [ ] Social sharing
- [ ] Payment integration
- [ ] Email notifications
- [ ] Password reset
- [ ] Profile picture upload
- [ ] Content maturity ratings
- [ ] Parental controls
- [ ] Recently added section

## Security Considerations

- Passwords are hashed using bcrypt
- JWT tokens for authentication
- Protected routes require valid tokens
- Input validation on all endpoints
- CORS enabled for cross-origin requests

## Development Tips

### Adding New Videos
Use the seed script or manually insert via MongoDB:

```javascript
db.videos.insertOne({
  title: "Your Video Title",
  description: "Description here",
  videoUrl: "https://example.com/video.mp4",
  thumbnailUrl: "https://example.com/thumb.jpg",
  bannerUrl: "https://example.com/banner.jpg",
  duration: 120,
  year: 2024,
  rating: "PG-13",
  genres: ["Action", "Adventure"],
  cast: ["Actor 1", "Actor 2"],
  director: "Director Name",
  isFeatured: true
});
```

### Video Sources
For testing, you can use free video sources like:
- Big Buck Bunny: `http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`
- Elephant's Dream: `http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4`

## License

MIT License - feel free to use this project for learning and development.

## Credits

Built as a learning project to demonstrate full-stack development skills with React, Node.js, Express, and MongoDB.
