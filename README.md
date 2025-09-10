# LiteClass - Smart Learning Platform

A production-ready Progressive Web App (PWA) for offline-first education, built for Smart India Hackathon.

## Features

### 🎓 Teacher Portal
- **Offline Recording**: Record lectures with synchronized slides using MediaRecorder API
- **Smart Packaging**: Auto-generate ZIP packages with slides, audio, metadata, and quizzes
- **Cloud Upload**: Upload lectures to Supabase storage when online
- **Live Classes**: Conduct real-time audio classes with synchronized slides
- **Quiz Builder**: Create interactive quizzes embedded in lectures
- **Assignment Management**: Create and manage student assignments

### 📚 Student Portal  
- **Offline Learning**: Download and play lectures without internet
- **Smart Sync**: Auto-download new content and upload responses at night
- **Interactive Quizzes**: Answer embedded quizzes with offline storage
- **Assignment Submission**: Submit assignments with auto-upload when online
- **Progress Tracking**: View learning progress and quiz scores
- **Multi-format Import**: Import lectures via WhatsApp or direct upload

### 👨‍💼 Admin Panel
- **User Management**: Add/remove teachers and students
- **Subject Management**: Organize content by subjects
- **Analytics**: View system statistics and student progress
- **Content Moderation**: Manage lectures and assignments

### 🔧 Technical Features
- **Offline-First**: Works completely offline after initial load
- **Background Sync**: Auto-sync using Service Workers
- **Real-time Updates**: Live class synchronization via Supabase Realtime
- **Multi-language**: English and Hindi support
- **Responsive Design**: Works on all devices, optimized for entry-level Android
- **Push Notifications**: Free notifications using Service Workers

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (no frameworks)
- **Backend**: Supabase (Auth, Database, Storage, Realtime)
- **Offline Storage**: IndexedDB with Dexie.js
- **File Handling**: JSZip for lecture packaging
- **Caching**: Service Workers with Workbox patterns
- **Audio**: MediaRecorder API for recording, Web Audio API for playback

## Quick Start

### Local Development

1. **Clone and Install**
   ```bash
   git clone https://github.com/Sanjay17-cmd/liteclass.git
   cd liteclass
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Open in Browser**
   - Navigate to `http://localhost:5173`
   - The app will work offline after first load

### Supabase Setup

The app is pre-configured with Supabase credentials. To set up your own:

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Get URL and anon key

2. **Update Configuration**
   ```javascript
   // In supabase.js
   const SUPABASE_URL = 'your-project-url';
   const SUPABASE_ANON_KEY = 'your-anon-key';
   ```

3. **Create Storage Bucket**
   ```sql
   -- In Supabase SQL Editor
   INSERT INTO storage.buckets (id, name, public) 
   VALUES ('lectures', 'lectures', true);
   ```

4. **Run Database Migrations**
   ```sql
   -- Create tables (see database schema below)
   ```

## Deployment

### Deploy to Bolt (Development)
1. Push code to this Bolt environment
2. App automatically deploys and is accessible via Bolt URL
3. PWA can be installed directly from browser

### Deploy to Netlify (Production)
1. **Connect Repository**
   ```bash
   # Push to GitHub first
   git add .
   git commit -m "Production ready"
   git push origin main
   ```

2. **Deploy to Netlify**
   - Connect GitHub repo to Netlify
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Environment variables: Add Supabase credentials

3. **Enable PWA Features**
   - Add `_headers` file for proper caching
   - Configure `_redirects` for SPA routing

### Deploy to GitHub Pages
1. **Build for Production**
   ```bash
   npm run build
   ```

2. **Deploy to GitHub Pages**
   ```bash
   npm run deploy
   ```

## Database Schema

```sql
-- Profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subjects table  
CREATE TABLE subjects (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lectures table
CREATE TABLE lectures (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  teacher_id UUID REFERENCES profiles(id),
  file_path TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assignments table
CREATE TABLE assignments (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  teacher_id UUID REFERENCES profiles(id),
  due_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quiz responses table
CREATE TABLE quiz_responses (
  id SERIAL PRIMARY KEY,
  lecture_id INTEGER REFERENCES lectures(id),
  student_id UUID REFERENCES profiles(id),
  question_id INTEGER NOT NULL,
  answer TEXT NOT NULL,
  is_correct BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assignment submissions table
CREATE TABLE assignment_submissions (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER REFERENCES assignments(id),
  student_id UUID REFERENCES profiles(id),
  file_path TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Testing Checklist

### ✅ 10-Step Testing Guide

1. **Authentication Test**
   - [ ] Sign up as teacher, student, admin
   - [ ] Login/logout functionality
   - [ ] Role-based dashboard access

2. **Teacher Recording Test**
   - [ ] Upload slides (multiple formats)
   - [ ] Start/stop audio recording
   - [ ] Navigate slides during recording
   - [ ] Add annotations and quiz questions

3. **Lecture Package Test**
   - [ ] Build ZIP package with all components
   - [ ] Download generated ZIP file
   - [ ] Upload to Supabase storage
   - [ ] Verify metadata.json structure

4. **Student Import Test**
   - [ ] Import ZIP file manually
   - [ ] Download from cloud storage
   - [ ] Verify offline storage in IndexedDB
   - [ ] Play lecture with synchronized slides

5. **Offline Functionality Test**
   - [ ] Disconnect internet
   - [ ] Play downloaded lectures
   - [ ] Answer quiz questions
   - [ ] Submit assignments (queued)
   - [ ] Reconnect and verify auto-sync

6. **Live Class Test**
   - [ ] Teacher starts live class
   - [ ] Students join and see slides
   - [ ] Real-time slide synchronization
   - [ ] Audio streaming (if implemented)

7. **Quiz System Test**
   - [ ] Create quiz questions
   - [ ] Answer quizzes during playback
   - [ ] View quiz results and scores
   - [ ] Offline quiz response storage

8. **Assignment System Test**
   - [ ] Teacher creates assignments
   - [ ] Students view and submit
   - [ ] File upload functionality
   - [ ] Due date tracking

9. **Admin Panel Test**
   - [ ] Add/remove subjects
   - [ ] View system statistics
   - [ ] Manage users (if implemented)
   - [ ] Monitor storage usage

10. **PWA Features Test**
    - [ ] Install app on mobile device
    - [ ] Offline functionality after install
    - [ ] Push notifications
    - [ ] Background sync
    - [ ] Service worker caching

## Storage & Network Usage

### Storage Estimates
- **App Core**: ~2MB (HTML, CSS, JS, icons)
- **Dependencies**: ~3MB (Supabase SDK, Dexie, JSZip)
- **Per Lecture**: 5-15MB (slides + audio + metadata)
- **IndexedDB Limit**: ~50GB on modern browsers
- **Recommended**: Monitor storage and warn at 80% capacity

### Network Usage
- **Initial Load**: ~5MB (first visit)
- **Lecture Download**: 5-15MB per lecture
- **Quiz Sync**: <1KB per response
- **Assignment Upload**: Variable (depends on file size)
- **Live Class**: ~1MB/hour (metadata only, no video)

### Optimization Features
- **WebP Slides**: 60-80% smaller than JPEG
- **Opus Audio**: 3-10MB per hour vs 50MB+ for uncompressed
- **Smart Caching**: Only cache frequently accessed content
- **Background Sync**: Batch uploads during off-peak hours
- **Compression**: ZIP compression reduces package size by 20-40%

## Browser Support

- **Chrome/Edge**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Partial (no background sync)
- **Mobile Chrome**: Full support
- **Mobile Safari**: Partial support

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Create GitHub issue
- Email: support@liteclass.app
- Documentation: [docs.liteclass.app](https://docs.liteclass.app)