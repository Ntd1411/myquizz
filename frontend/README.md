# MyQuizz Frontend

Nền tảng quiz gamified - Frontend application được xây dựng với React, Vite và TypeScript.

## Tech Stack

- **React 18.3+** - UI framework
- **Vite 5.x** - Build tool và dev server
- **TypeScript 5.x** - Type safety
- **React Router 6.x** - Routing
- **TanStack Query 5.x** - Server state management
- **Zustand 4.x** - Client state management
- **Tailwind CSS 3.x** - Styling
- **Framer Motion 10.x** - Animations
- **React Hook Form 7.x** - Form handling
- **Zod 3.x** - Schema validation
- **Axios 1.6+** - HTTP client
- **Socket.IO Client 4.7+** - Real-time communication

## Prerequisites

- Node.js >= 18.x
- npm >= 9.x

## Getting Started

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Cấu hình environment variables

Sao chép file `.env.example` thành `.env.development`:

```bash
cp .env.example .env.development
```

Chỉnh sửa các giá trị trong `.env.development` nếu cần:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_SOCKET_URL=http://localhost:3000
VITE_APP_NAME=MyQuizz Dev
```

### 3. Chạy development server

```bash
npm run dev
```

Ứng dụng sẽ chạy tại `http://localhost:5173/`

## Available Scripts

- `npm run dev` - Chạy development server với HMR
- `npm run build` - Build production bundle
- `npm run preview` - Preview production build
- `npm run lint` - Chạy ESLint
- `npm run format` - Format code với Prettier
- `npm run type-check` - Kiểm tra TypeScript type errors

## Project Structure

```
frontend/
├── public/              # Static assets
├── src/
│   ├── app/            # App setup (routes, providers)
│   ├── assets/         # Images, styles, fonts
│   ├── components/     # Shared components
│   │   ├── ui/        # Design system components
│   │   ├── layout/    # Layout components (Navbar, Footer)
│   │   └── shared/    # Other shared components
│   ├── features/       # Feature modules (auth, quiz, game, etc.)
│   ├── hooks/          # Custom React hooks
│   ├── layouts/        # Page layouts
│   ├── lib/            # Third-party library configs
│   ├── pages/          # Route pages
│   ├── stores/         # Zustand stores
│   ├── types/          # TypeScript types
│   └── utils/          # Utility functions
├── .env.example        # Environment variables template
├── .eslintrc.js        # ESLint configuration
├── .prettierrc         # Prettier configuration
├── index.html          # HTML entry point
├── package.json        # Dependencies
├── postcss.config.js   # PostCSS configuration
├── tailwind.config.ts  # Tailwind CSS configuration
├── tsconfig.json       # TypeScript configuration
└── vite.config.ts      # Vite configuration
```

## Design System

Project sử dụng design tokens được định nghĩa trong `src/assets/styles/tokens.css` với OKLCH color space để đảm bảo consistent theming và accessibility.

### Theme

- Light mode (default)
- Dark mode
- System preference

Toggle theme với Zustand store: `useThemeStore`

## Code Style

- ESLint cho code quality
- Prettier cho code formatting
- Path aliases: `@/` maps to `src/`

## Development Guidelines

1. Tuân theo folder structure đã định nghĩa
2. Sử dụng TypeScript cho tất cả code
3. Components dùng named exports
4. Hooks prefix với `use`
5. Types/Interfaces suffix với type mô tả
6. Utilities trong `utils/` folder
7. Feature-specific code trong `features/` folder

## Build

Build production bundle:

```bash
npm run build
```

Output sẽ được tạo trong folder `dist/`

Preview production build:

```bash
npm run preview
```

## Milestone 1: Foundation - Completed

- ✓ Vite + React + TypeScript project initialized
- ✓ Core dependencies installed
- ✓ Folder structure setup
- ✓ Design tokens và theme system
- ✓ ESLint và Prettier configured
- ✓ Path aliases configured (@/)
- ✓ Basic routing setup
- ✓ Layout shell (Navbar, RootLayout, AppLayout)
- ✓ Build verification passed
- ✓ Dev server running successfully

## Next Steps

- Milestone 2: Design System - Implement UI components
- Milestone 3: Core Components - Build shared components
- Milestone 4+: Feature implementation theo roadmap

## License

Private project
