# MyQuizz Frontend

Modern real-time quiz platform frontend built with React, TypeScript, and Tailwind CSS v4.

## 🚀 Quick Start

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

Frontend runs on `http://localhost:3000`

### Build for Production

```bash
npm run build
npm run preview
```

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── Navigation.tsx  # App navigation
│   │   └── UI.tsx         # Button, Input, Card, etc.
│   ├── pages/             # Route pages
│   │   ├── Landing.tsx    # Public landing page
│   │   ├── Login.tsx      # Login page
│   │   ├── Register.tsx   # Registration
│   │   ├── Home.tsx       # Browse/join quizzes
│   │   ├── Dashboard.tsx  # Creator dashboard
│   │   ├── CreateQuiz.tsx # Quiz creation
│   │   ├── GamePlayer.tsx # Player interface
│   │   └── GameHost.tsx   # Host interface
│   ├── lib/              # Core utilities
│   │   ├── api.ts        # API client
│   │   ├── socket.ts     # Socket.io client
│   │   └── store.ts      # Zustand stores
│   ├── types/            # TypeScript types
│   ├── styles/           # Global styles
│   ├── App.tsx           # Routes
│   └── main.tsx          # Entry point
├── index.html
├── vite.config.ts
└── package.json
```

## 🛠 Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS v4** - Styling
- **Motion** (Framer Motion) - Animations
- **Socket.io-client** - Real-time features
- **Zustand** - State management
- **React Router v6** - Routing
- **Phosphor Icons** - Icon library

## ✨ Features

### Authentication
- Login/Register with validation
- JWT token management
- Protected routes
- Auto token refresh

### Quiz Management
- Create quizzes with multiple questions
- Multiple choice & true/false questions
- Set time limits and points
- Edit and delete quizzes
- Public/private settings

### Real-time Game System
- Host creates game with unique code
- Players join with session code
- Live player tracking
- Synchronized questions
- Real-time scoring
- Live leaderboards
- Final results

### UI/UX
- Fully responsive (mobile-first)
- Dark mode support
- Smooth animations
- Loading states
- Error handling
- Accessible forms

## 🎨 Design System

### Colors
- Primary: #2563eb (Blue)
- Success: #10b981 (Green)
- Error: #ef4444 (Red)
- Warning: #f59e0b (Orange)

### Typography
- Font: Geist (sans-serif)
- Mono: Geist Mono

### Components
- Card: Elevated surface
- Button: Primary/Secondary/Ghost variants
- Input: Form inputs with labels
- Select: Dropdown menus
- LoadingSpinner: Animated spinner

## 🔌 API Integration

Backend proxy configured in `vite.config.ts`:
- `/api/*` → `http://localhost:8000/api/*`
- `/socket.io` → `http://localhost:8000/socket.io`

## 📱 Routes

### Public
- `/` - Landing page
- `/login` - Sign in
- `/register` - Create account

### Protected
- `/home` - Browse quizzes
- `/dashboard` - Manage quizzes
- `/dashboard/create` - Create quiz
- `/game/host/:sessionId` - Host game

### Game
- `/game/:sessionId` - Join and play

## 🔧 Development

### Linting
```bash
npm run lint
```

### Type Checking
```bash
npx tsc --noEmit
```

## 🌐 Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## 📝 License

MIT
