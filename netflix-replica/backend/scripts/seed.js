const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Category = require('../models/Category');
const Video = require('../models/Video');

dotenv.config();

const categories = [
  { name: 'Action', slug: 'action', order: 1 },
  { name: 'Comedy', slug: 'comedy', order: 2 },
  { name: 'Drama', slug: 'drama', order: 3 },
  { name: 'Horror', slug: 'horror', order: 4 },
  { name: 'Sci-Fi', slug: 'sci-fi', order: 5 },
  { name: 'Documentary', slug: 'documentary', order: 6 },
  { name: 'Romance', slug: 'romance', order: 7 },
  { name: 'Thriller', slug: 'thriller', order: 8 }
];

const sampleVideos = [
  {
    title: 'The Adventure Begins',
    description: 'An epic adventure story following a group of heroes on their quest to save the world.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: 'https://picsum.photos/seed/video1/400/225',
    bannerUrl: 'https://picsum.photos/seed/banner1/1920/1080',
    duration: 120,
    year: 2023,
    rating: 'PG-13',
    genres: ['Action', 'Adventure'],
    cast: ['John Doe', 'Jane Smith', 'Bob Johnson'],
    director: 'Steven Director',
    isTrending: true,
    isFeatured: true,
    trailerUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
  },
  {
    title: 'Laugh Out Loud',
    description: 'A hilarious comedy that will keep you entertained from start to finish.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnailUrl: 'https://picsum.photos/seed/video2/400/225',
    bannerUrl: 'https://picsum.photos/seed/banner2/1920/1080',
    duration: 95,
    year: 2023,
    rating: 'PG',
    genres: ['Comedy'],
    cast: ['Funny Person', 'Comic Relief'],
    director: 'Comedy Director',
    isTrending: true,
    isNewRelease: true
  },
  {
    title: 'Dark Secrets',
    description: 'A psychological thriller that will keep you on the edge of your seat.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: 'https://picsum.photos/seed/video3/400/225',
    bannerUrl: 'https://picsum.photos/seed/banner3/1920/1080',
    duration: 110,
    year: 2024,
    rating: 'R',
    genres: ['Thriller', 'Drama'],
    cast: ['Serious Actor', 'Mystery Person'],
    director: 'Thriller Master',
    isNewRelease: true
  },
  {
    title: 'Space Odyssey',
    description: 'Journey through the cosmos in this breathtaking sci-fi adventure.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnailUrl: 'https://picsum.photos/seed/video4/400/225',
    bannerUrl: 'https://picsum.photos/seed/banner4/1920/1080',
    duration: 135,
    year: 2023,
    rating: 'PG-13',
    genres: ['Sci-Fi', 'Adventure'],
    cast: ['Space Captain', 'Alien Friend'],
    director: 'Sci-Fi Genius',
    isTrending: true
  },
  {
    title: 'Love Story',
    description: 'A beautiful romance that will touch your heart.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    thumbnailUrl: 'https://picsum.photos/seed/video5/400/225',
    bannerUrl: 'https://picsum.photos/seed/banner5/1920/1080',
    duration: 100,
    year: 2024,
    rating: 'PG',
    genres: ['Romance', 'Drama'],
    cast: ['Romantic Lead', 'Love Interest'],
    director: 'Romance Director',
    isNewRelease: true
  }
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Category.deleteMany({});
    await Video.deleteMany({});
    console.log('Cleared existing data');

    // Insert categories
    const insertedCategories = await Category.insertMany(categories);
    console.log(`Inserted ${insertedCategories.length} categories`);

    // Add category references to videos
    const videosWithCategories = sampleVideos.map(video => {
      const categoryIds = video.genres.map(genre => {
        const category = insertedCategories.find(cat =>
          cat.name.toLowerCase() === genre.toLowerCase()
        );
        return category ? category._id : null;
      }).filter(id => id !== null);

      return {
        ...video,
        categories: categoryIds
      };
    });

    // Insert videos
    const insertedVideos = await Video.insertMany(videosWithCategories);
    console.log(`Inserted ${insertedVideos.length} videos`);

    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
