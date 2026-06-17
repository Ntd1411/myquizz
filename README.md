# **Quiz App Backend API Documentation**

## Tổng quan

Backend API cho ứng dụng quiz real-time, được xây dựng với TypeScript, Express.js và Socket.IO. API hỗ trợ quản lý quiz, authentication, game sessions thời gian thực và lưu trữ file.

## Tech Stack

- **Runtime**: Node.js với TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Real-time**: Socket.IO
- **Storage**: AWS S3
- **Cache**: Redis (optional)
- **Container**: Docker & Docker Compose

## Tính năng chính

- Xác thực người dùng (JWT-based authentication)
- Quản lý quiz và câu hỏi
- Game sessions thời gian thực
- Upload và quản lý hình ảnh
- Leaderboard và thống kê
- Notification real-time

## Yêu cầu hệ thống

- Docker và Docker Compose
- Node.js 18+ (nếu chạy local)
- PostgreSQL 14+ (nếu chạy local)

## Cài đặt và chạy

### 1. Cấu hình môi trường

Tạo file `.env` từ `.env.example`:

```bash
cp .env.example .env
```

Cấu hình các biến môi trường cần thiết:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myquizz
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your_refresh_secret
REFRESH_TOKEN_EXPIRES_IN=30d

# AWS S3
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_BUCKET_NAME=your_bucket_name

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 2. Chạy với Docker (Khuyến nghị)

```bash
docker compose up
```

Server sẽ chạy tại `http://localhost:3000`

### 3. Chạy local (Development)

```bash
# Install dependencies
npm install

# Run migrations
npm run migrate

# Run seeds (optional)
npm run seed

# Start development server
npm run dev
```

## API Documentation

Base URL: `http://localhost:3000/api/v1`

### Authentication

#### Đăng ký tài khoản

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "Password123!",
  "displayName": "Test User"
}
```

Response 201:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "username": "testuser",
      "email": "test@example.com",
      "displayName": "Test User",
      "avatarUrl": null,
      "createdAt": "2026-06-17T10:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### Đăng nhập

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Password123!"
}
```

Response 200:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "username": "testuser",
      "email": "test@example.com",
      "displayName": "Test User",
      "avatarUrl": "https://s3.amazonaws.com/avatar.jpg"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### Làm mới token

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

Response 200:

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### Đăng xuất

```http
POST /api/v1/auth/logout
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

Response 200:

```json
{
  "message": "Đăng xuất thành công"
}
```

#### Lấy thông tin user hiện tại

```http
GET /api/v1/auth/me
Authorization: Bearer {accessToken}
```

Response 200:

```json
{
  "data": {
    "id": "uuid",
    "username": "testuser",
    "email": "test@example.com",
    "displayName": "Test User",
    "avatarUrl": "https://s3.amazonaws.com/avatar.jpg",
    "createdAt": "2026-06-17T10:00:00.000Z"
  }
}
```

### User Management

#### Cập nhật thông tin user

```http
PATCH /api/v1/users/profile
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "displayName": "New Display Name",
  "bio": "My bio"
}
```

Response 200:

```json
{
  "data": {
    "id": "uuid",
    "username": "testuser",
    "email": "test@example.com",
    "displayName": "New Display Name",
    "bio": "My bio",
    "avatarUrl": "https://s3.amazonaws.com/avatar.jpg"
  }
}
```

#### Upload avatar

```http
POST /api/v1/users/avatar
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data

avatar: [file]
```

Response 200:

```json
{
  "data": {
    "avatarUrl": "https://s3.amazonaws.com/bucket/avatars/uuid.jpg"
  }
}
```

### Quiz Management

#### Lấy danh sách quiz

```http
GET /api/v1/quizzes?page=1&limit=10&search=keyword
Authorization: Bearer {accessToken} (optional)
```

Query Parameters:

- `page` (optional): Số trang, mặc định = 1
- `limit` (optional): Số lượng item/trang, mặc định = 10
- `search` (optional): Từ khóa tìm kiếm

Response 200:

```json
{
  "data": {
    "quizzes": [
      {
        "id": "uuid",
        "title": "JavaScript Basics",
        "description": "Test your JavaScript knowledge",
        "thumbnailUrl": "https://s3.amazonaws.com/thumbnail.jpg",
        "difficulty": "easy",
        "categoryId": "uuid",
        "createdBy": {
          "id": "uuid",
          "username": "creator",
          "displayName": "Creator Name"
        },
        "questionCount": 10,
        "playCount": 150,
        "isPublished": true,
        "createdAt": "2026-06-17T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

#### Lấy chi tiết quiz

```http
GET /api/v1/quizzes/:quizId
Authorization: Bearer {accessToken} (optional)
```

Response 200:

```json
{
  "data": {
    "id": "uuid",
    "title": "JavaScript Basics",
    "description": "Test your JavaScript knowledge",
    "thumbnailUrl": "https://s3.amazonaws.com/thumbnail.jpg",
    "difficulty": "easy",
    "categoryId": "uuid",
    "createdBy": {
      "id": "uuid",
      "username": "creator",
      "displayName": "Creator Name",
      "avatarUrl": "https://s3.amazonaws.com/avatar.jpg"
    },
    "questions": [
      {
        "id": "uuid",
        "questionText": "What is JavaScript?",
        "imageUrl": null,
        "timeLimit": 30,
        "points": 100,
        "options": [
          {
            "id": "uuid",
            "text": "A programming language",
            "imageUrl": null,
            "isCorrect": true
          },
          {
            "id": "uuid",
            "text": "A coffee brand",
            "imageUrl": null,
            "isCorrect": false
          }
        ]
      }
    ],
    "questionCount": 10,
    "playCount": 150,
    "isPublished": true,
    "createdAt": "2026-06-17T10:00:00.000Z",
    "updatedAt": "2026-06-17T10:00:00.000Z"
  }
}
```

#### Tạo quiz mới

```http
POST /api/v1/quizzes
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "title": "JavaScript Basics",
  "description": "Test your JavaScript knowledge",
  "difficulty": "easy",
  "categoryId": "uuid",
  "isPublished": false
}
```

Response 201:

```json
{
  "data": {
    "id": "uuid",
    "title": "JavaScript Basics",
    "description": "Test your JavaScript knowledge",
    "difficulty": "easy",
    "categoryId": "uuid",
    "createdBy": "uuid",
    "isPublished": false,
    "createdAt": "2026-06-17T10:00:00.000Z"
  }
}
```

#### Cập nhật quiz

```http
PATCH /api/v1/quizzes/:quizId
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated description",
  "difficulty": "medium",
  "isPublished": true
}
```

Response 200:

```json
{
  "data": {
    "id": "uuid",
    "title": "Updated Title",
    "description": "Updated description",
    "difficulty": "medium",
    "isPublished": true,
    "updatedAt": "2026-06-17T10:00:00.000Z"
  }
}
```

#### Xóa quiz

```http
DELETE /api/v1/quizzes/:quizId
Authorization: Bearer {accessToken}
```

Response 200:

```json
{
  "message": "Xóa quiz thành công"
}
```

#### Upload thumbnail cho quiz

```http
POST /api/v1/quizzes/:quizId/thumbnail
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data

thumbnail: [file]
```

Response 200:

```json
{
  "data": {
    "thumbnailUrl": "https://s3.amazonaws.com/bucket/thumbnails/uuid.jpg"
  }
}
```

#### Thêm câu hỏi vào quiz

```http
POST /api/v1/quizzes/:quizId/questions
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "questionText": "What is JavaScript?",
  "timeLimit": 30,
  "points": 100,
  "options": [
    {
      "text": "A programming language",
      "isCorrect": true
    },
    {
      "text": "A coffee brand",
      "isCorrect": false
    },
    {
      "text": "A framework",
      "isCorrect": false
    },
    {
      "text": "A library",
      "isCorrect": false
    }
  ]
}
```

Response 201:

```json
{
  "data": {
    "id": "uuid",
    "quizId": "uuid",
    "questionText": "What is JavaScript?",
    "imageUrl": null,
    "timeLimit": 30,
    "points": 100,
    "options": [
      {
        "id": "uuid",
        "text": "A programming language",
        "imageUrl": null,
        "isCorrect": true
      }
    ]
  }
}
```

#### Cập nhật câu hỏi

```http
PATCH /api/v1/quizzes/:quizId/questions/:questionId
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "questionText": "Updated question?",
  "timeLimit": 45,
  "points": 150
}
```

Response 200:

```json
{
  "data": {
    "id": "uuid",
    "questionText": "Updated question?",
    "timeLimit": 45,
    "points": 150,
    "updatedAt": "2026-06-17T10:00:00.000Z"
  }
}
```

#### Xóa câu hỏi

```http
DELETE /api/v1/quizzes/:quizId/questions/:questionId
Authorization: Bearer {accessToken}
```

Response 200:

```json
{
  "message": "Xóa câu hỏi thành công"
}
```

### Game Session Management

#### Tạo game session mới

```http
POST /api/v1/games
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "quizId": "uuid",
  "maxPlayers": 50,
  "isPublic": true
}
```

Response 201:

```json
{
  "data": {
    "id": "uuid",
    "quizId": "uuid",
    "hostId": "uuid",
    "pin": "123456",
    "status": "waiting",
    "maxPlayers": 50,
    "isPublic": true,
    "createdAt": "2026-06-17T10:00:00.000Z"
  }
}
```

#### Lấy thông tin game session

```http
GET /api/v1/games/:gameId
Authorization: Bearer {accessToken} (optional)
```

Response 200:

```json
{
  "data": {
    "id": "uuid",
    "quizId": "uuid",
    "quiz": {
      "title": "JavaScript Basics",
      "questionCount": 10
    },
    "host": {
      "id": "uuid",
      "username": "host",
      "displayName": "Host Name"
    },
    "pin": "123456",
    "status": "in_progress",
    "currentQuestionIndex": 2,
    "maxPlayers": 50,
    "playerCount": 15,
    "isPublic": true,
    "createdAt": "2026-06-17T10:00:00.000Z",
    "startedAt": "2026-06-17T10:05:00.000Z"
  }
}
```

#### Join game bằng PIN

```http
POST /api/v1/games/join
Content-Type: application/json

{
  "pin": "123456",
  "nickname": "Player1"
}
```

Response 200:

```json
{
  "data": {
    "gameId": "uuid",
    "playerId": "uuid",
    "nickname": "Player1",
    "token": "player_token_for_socket"
  }
}
```

#### Bắt đầu game (Host only)

```http
POST /api/v1/games/:gameId/start
Authorization: Bearer {accessToken}
```

Response 200:

```json
{
  "data": {
    "id": "uuid",
    "status": "in_progress",
    "startedAt": "2026-06-17T10:00:00.000Z"
  }
}
```

#### Kết thúc game (Host only)

```http
POST /api/v1/games/:gameId/end
Authorization: Bearer {accessToken}
```

Response 200:

```json
{
  "data": {
    "id": "uuid",
    "status": "finished",
    "endedAt": "2026-06-17T10:30:00.000Z",
    "summary": {
      "totalPlayers": 15,
      "totalQuestions": 10,
      "averageScore": 750
    }
  }
}
```

#### Lấy leaderboard của game

```http
GET /api/v1/games/:gameId/leaderboard
```

Response 200:

```json
{
  "data": {
    "leaderboard": [
      {
        "playerId": "uuid",
        "nickname": "Player1",
        "score": 950,
        "correctAnswers": 9,
        "rank": 1
      },
      {
        "playerId": "uuid",
        "nickname": "Player2",
        "score": 880,
        "correctAnswers": 8,
        "rank": 2
      }
    ]
  }
}
```

## Socket.IO Real-time Events

Base URL: `ws://localhost:3000`

### Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'player_token_or_jwt_token'
  }
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});
```

### Events từ Client

#### Join game room

```javascript
socket.emit('game:join', {
  gameId: 'uuid',
  playerId: 'uuid'
});
```

#### Submit câu trả lời

```javascript
socket.emit('game:answer', {
  gameId: 'uuid',
  playerId: 'uuid',
  questionId: 'uuid',
  optionId: 'uuid',
  answeredAt: Date.now()
});
```

#### Leave game

```javascript
socket.emit('game:leave', {
  gameId: 'uuid',
  playerId: 'uuid'
});
```

### Events từ Server

#### Player joined

```javascript
socket.on('player:joined', (data) => {
  console.log('Player joined:', data);
  // data: {
  //   playerId: 'uuid',
  //   nickname: 'Player1',
  //   playerCount: 5
  // }
});
```

#### Game started

```javascript
socket.on('game:started', (data) => {
  console.log('Game started:', data);
  // data: {
  //   gameId: 'uuid',
  //   startedAt: '2026-06-17T10:00:00.000Z'
  // }
});
```

#### Question started

```javascript
socket.on('question:started', (data) => {
  console.log('Question started:', data);
  // data: {
  //   questionIndex: 0,
  //   question: {
  //     id: 'uuid',
  //     questionText: 'What is JavaScript?',
  //     imageUrl: null,
  //     timeLimit: 30,
  //     points: 100,
  //     options: [
  //       { id: 'uuid', text: 'A programming language', imageUrl: null },
  //       { id: 'uuid', text: 'A coffee brand', imageUrl: null }
  //     ]
  //   },
  //   startedAt: Date.now()
  // }
});
```

#### Answer submitted

```javascript
socket.on('answer:submitted', (data) => {
  console.log('Answer submitted:', data);
  // data: {
  //   playerId: 'uuid',
  //   nickname: 'Player1',
  //   answerCount: 3
  // }
});
```

#### Question ended

```javascript
socket.on('question:ended', (data) => {
  console.log('Question ended:', data);
  // data: {
  //   questionId: 'uuid',
  //   correctOptionId: 'uuid',
  //   leaderboard: [
  //     { playerId: 'uuid', nickname: 'Player1', score: 100, rank: 1 }
  //   ]
  // }
});
```

#### Game finished

```javascript
socket.on('game:finished', (data) => {
  console.log('Game finished:', data);
  // data: {
  //   gameId: 'uuid',
  //   finalLeaderboard: [
  //     { playerId: 'uuid', nickname: 'Player1', score: 950, rank: 1 }
  //   ],
  //   endedAt: '2026-06-17T10:30:00.000Z'
  // }
});
```

#### Player left

```javascript
socket.on('player:left', (data) => {
  console.log('Player left:', data);
  // data: {
  //   playerId: 'uuid',
  //   nickname: 'Player1',
  //   playerCount: 4
  // }
});
```

#### Error events

```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
  // error: {
  //   message: 'Lỗi mô tả',
  //   code: 'ERROR_CODE'
  // }
});
```

## Rate Limiting

API có rate limiting để bảo vệ server:

### Công khai (không cần auth)

- 100 requests/15 phút/IP
- Áp dụng cho: login, register, join game

### Đã xác thực

- 1000 requests/15 phút/user
- Áp dụng cho: tất cả authenticated endpoints

### Headers

Response sẽ có các headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1718622000
```

Khi vượt quá limit:

```json
{
  "error": {
    "message": "Quá nhiều requests, vui lòng thử lại sau",
    "code": "RATE_LIMIT_EXCEEDED",
    "statusCode": 429,
    "retryAfter": 900
  }
}
```

## Security

### Authentication

API sử dụng JWT (JSON Web Token) cho authentication:

- Access Token: Hết hạn sau 7 ngày
- Refresh Token: Hết hạn sau 30 ngày
- Token được gửi qua header: `Authorization: Bearer {token}`

### CORS

API hỗ trợ CORS với origin được cấu hình trong `.env`:

```env
CORS_ORIGIN=http://localhost:5173,https://yourdomain.com
```

### File Upload Security

- Kiểm tra file type qua MIME type
- Scan virus trước khi upload
- Generate unique filename (UUID)
- Upload trực tiếp lên S3

### SQL Injection Protection

- Sử dụng parameterized queries
- Validate tất cả input
- Escape special characters

## Best Practices cho Frontend

### 1. Token Management

```javascript
// Lưu tokens vào localStorage hoặc sessionStorage
const saveTokens = (accessToken, refreshToken) => {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
};

// Tự động refresh token khi hết hạn
const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  const response = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  const data = await response.json();
  saveTokens(data.data.accessToken, data.data.refreshToken);
};
```

### 2. Error Handling

```javascript
const handleApiError = (error) => {
  switch (error.code) {
    case 'TOKEN_EXPIRED':
      // Redirect to login
      window.location.href = '/login';
      break;
    case 'VALIDATION_ERROR':
      // Show validation errors
      showValidationErrors(error.details);
      break;
    default:
      // Show general error
      showErrorToast(error.message);
  }
};
```

### 3. Socket.IO Connection Management

```javascript
// Reconnect với backoff
const socket = io('http://localhost:3000', {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

// Handle reconnection
socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
  // Rejoin game room nếu cần
  socket.emit('game:join', { gameId, playerId });
});
```

### 4. Optimistic Updates

```javascript
// Cập nhật UI ngay lập tức, rollback nếu API fail
const updateQuiz = async (quizId, updates) => {
  // Lưu state cũ
  const oldQuiz = quizzes.find(q => q.id === quizId);
  
  // Update UI ngay
  setQuizzes(prev => prev.map(q => 
    q.id === quizId ? { ...q, ...updates } : q
  ));
  
  try {
    // Gọi API
    await fetch(`/api/v1/quizzes/${quizId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });
  } catch (error) {
    // Rollback nếu fail
    setQuizzes(prev => prev.map(q => 
      q.id === quizId ? oldQuiz : q
    ));
    handleApiError(error);
  }
};
```

### 5. Debounce Search

```javascript
import { debounce } from 'lodash';

// Debounce search để giảm số lượng API calls
const searchQuizzes = debounce(async (keyword) => {
  const response = await fetch(
    `/api/v1/quizzes?search=${encodeURIComponent(keyword)}`
  );
  const data = await response.json();
  setQuizzes(data.data.quizzes);
}, 500);
```

## Example Integration

### React Example - Join và Play Game

```javascript
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

function GamePlayer() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState({
    status: 'joining',
    currentQuestion: null,
    leaderboard: []
  });

  // Join game
  const joinGame = async (pin, nickname) => {
    try {
      const response = await fetch('/api/v1/games/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, nickname })
      });
      const data = await response.json();
      
      // Connect socket với player token
      const newSocket = io('http://localhost:3000', {
        auth: { token: data.data.token }
      });
      
      setSocket(newSocket);
      setupSocketListeners(newSocket, data.data.gameId, data.data.playerId);
      
    } catch (error) {
      console.error('Join game failed:', error);
    }
  };

  // Setup socket listeners
  const setupSocketListeners = (socket, gameId, playerId) => {
    // Game started
    socket.on('game:started', () => {
      setGameState(prev => ({ ...prev, status: 'playing' }));
    });

    // New question
    socket.on('question:started', (data) => {
      setGameState(prev => ({
        ...prev,
        currentQuestion: data.question,
        questionStartTime: data.startedAt
      }));
    });

    // Question ended
    socket.on('question:ended', (data) => {
      setGameState(prev => ({
        ...prev,
        currentQuestion: null,
        leaderboard: data.leaderboard
      }));
    });

    // Game finished
    socket.on('game:finished', (data) => {
      setGameState(prev => ({
        ...prev,
        status: 'finished',
        leaderboard: data.finalLeaderboard
      }));
    });

    // Join room
    socket.emit('game:join', { gameId, playerId });
  };

  // Submit answer
  const submitAnswer = (optionId) => {
    if (!socket || !gameState.currentQuestion) return;
    
    socket.emit('game:answer', {
      gameId: gameState.gameId,
      playerId: gameState.playerId,
      questionId: gameState.currentQuestion.id,
      optionId,
      answeredAt: Date.now()
    });
  };

  return (
    <div>
      {/* UI components here */}
    </div>
  );
}
```

### Vue.js Example - Quiz Management

```javascript
<script setup>
import { ref, onMounted } from 'vue';

const quizzes = ref([]);
const loading = ref(false);

// Fetch quizzes
const fetchQuizzes = async (page = 1) => {
  loading.value = true;
  try {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(
      `/api/v1/quizzes?page=${page}&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    const data = await response.json();
    quizzes.value = data.data.quizzes;
  } catch (error) {
    console.error('Failed to fetch quizzes:', error);
  } finally {
    loading.value = false;
  }
};

// Create quiz
const createQuiz = async (quizData) => {
  const token = localStorage.getItem('accessToken');
  const response = await fetch('/api/v1/quizzes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(quizData)
  });
  const data = await response.json();
  return data.data;
};

onMounted(() => {
  fetchQuizzes();
});
</script>
```

## Testing

API có thể test bằng các tools:

### Postman Collection

Import file `tests/myquizz.postman_collection.json` vào Postman để test tất cả endpoints.

### Manual Testing với cURL

```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"Password123!","displayName":"Test User"}'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123!"}'

# Get quizzes (với token)
curl -X GET http://localhost:3000/api/v1/quizzes \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Environment Variables

Danh sách đầy đủ các biến môi trường:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
API_VERSION=v1

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myquizz
DB_USER=postgres
DB_PASSWORD=your_password
DB_SSL=false

# JWT Authentication
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your_refresh_token_secret
REFRESH_TOKEN_EXPIRES_IN=30d

# AWS S3
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_BUCKET_NAME=your_bucket_name

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# File Upload
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif

# Redis (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## Troubleshooting

### Lỗi thường gặp

#### 1. Database connection failed

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

Giải pháp:

- Kiểm tra PostgreSQL đã chạy chưa
- Kiểm tra DB_HOST, DB_PORT trong .env
- Nếu dùng Docker: `docker compose up -d`

#### 2. JWT token invalid

```
{
  "error": {
    "message": "Token không hợp lệ",
    "code": "TOKEN_INVALID"
  }
}
```

Giải pháp:

- Kiểm tra JWT_SECRET trong .env
- Đảm bảo gửi token đúng format: `Bearer {token}`
- Token có thể đã hết hạn, sử dụng refresh token

#### 3. CORS error

```
Access to fetch at 'http://localhost:3000' from origin 'http://localhost:5173' 
has been blocked by CORS policy
```

Giải pháp:

- Thêm origin vào CORS_ORIGIN trong .env
- Format: `CORS_ORIGIN=http://localhost:5173`
- Nhiều origins: `CORS_ORIGIN=http://localhost:5173,http://localhost:3001`

#### 4. File upload failed

```
{
  "error": {
    "message": "File upload failed",
    "code": "UPLOAD_ERROR"
  }
}
```

Giải pháp:

- Kiểm tra AWS credentials trong .env
- Kiểm tra bucket permissions
- Kiểm tra file size (max 5MB cho avatar)
- Kiểm tra file type (chỉ cho phép JPG, PNG, GIF)

#### 5. Socket connection failed

```
WebSocket connection failed
```

Giải pháp:

- Kiểm tra server đang chạy
- Kiểm tra port 3000 không bị block
- Kiểm tra token gửi qua socket auth
- Check browser console để xem error chi tiết

### Performance Tips

#### 1. Database Query Optimization

- Sử dụng index cho các trường thường query (đã có sẵn)
- Limit số lượng results với pagination
- Sử dụng select chỉ lấy fields cần thiết

#### 2. Caching

- Cache danh sách quizzes công khai
- Cache leaderboard trong Redis (nếu có)
- Cache user profile trong client

#### 3. Socket.IO Optimization

- Chỉ join rooms cần thiết
- Leave room khi không dùng
- Sử dụng namespaces để phân tách logic

## FAQ

### Q: Làm sao để test Socket.IO?

A: Sử dụng socket.io-client trong browser console hoặc testing tools như socket.io-tester.

### Q: Quiz có thể có bao nhiêu câu hỏi?

A: Không giới hạn số câu hỏi, nhưng khuyến nghị 10-50 câu cho trải nghiệm tốt nhất.

### Q: Game session tồn tại bao lâu?

A: Game session tự động cleanup sau 24 giờ nếu không có activity.

### Q: Có thể upload video không?

A: Hiện tại chỉ hỗ trợ hình ảnh (JPG, PNG, GIF). Video sẽ được hỗ trợ trong tương lai.

### Q: Làm sao để test real-time game với nhiều players?

A: Mở nhiều browser tabs hoặc sử dụng incognito mode để simulate nhiều players.

### Q: Có rate limit cho Socket.IO không?

A: Không có rate limit cho Socket.IO, nhưng server sẽ disconnect nếu spam quá nhiều events.

### Q: Làm sao để debug Socket.IO?

A: Enable debug mode:

```javascript
localStorage.debug = 'socket.io-client:socket';
```

## Development Guide

### Project Structure

```
src/
├── app.ts                    # Entry point
├── infrastructure/           # Infrastructure layer
│   ├── database/            # Database config, migrations, seeds
│   ├── cache/               # Redis cache (optional)
│   ├── socket/              # Socket.IO setup
│   └── storage/             # AWS S3 service
├── modules/                 # Feature modules
│   ├── auth/               # Authentication
│   ├── user/               # User management
│   ├── quiz/               # Quiz management
│   ├── game/               # Game sessions
│   └── leaderboard/        # Leaderboard
└── shared/                  # Shared utilities
    ├── errors/             # Error classes
    ├── middlewares/        # Express middlewares
    ├── types/              # TypeScript types
    └── validators/         # Validation schemas
```

### Adding New Endpoints

1. Tạo schema validation trong module

```typescript
// modules/example/example.schemas.ts
import { z } from 'zod';

export const createExampleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional()
});
```

1. Tạo repository

```typescript
// modules/example/example.repository.ts
export class ExampleRepository {
  async create(data: CreateExampleData) {
    const result = await db.query(
      'INSERT INTO examples (name, description) VALUES ($1, $2) RETURNING *',
      [data.name, data.description]
    );
    return result.rows[0];
  }
}
```

1. Tạo service

```typescript
// modules/example/example.service.ts
export class ExampleService {
  constructor(private repo: ExampleRepository) {}
  
  async createExample(data: CreateExampleData) {
    // Business logic here
    return this.repo.create(data);
  }
}
```

1. Tạo controller

```typescript
// modules/example/example.controller.ts
export class ExampleController {
  async create(req: Request, res: Response) {
    const data = createExampleSchema.parse(req.body);
    const result = await exampleService.createExample(data);
    res.status(201).json({ data: result });
  }
}
```

1. Thêm routes

```typescript
// modules/example/example.routes.ts
router.post('/', authMiddleware, exampleController.create);
```

### Database Migrations

Tạo migration mới:

```bash
# Tạo file migration trong src/infrastructure/database/migrations/
# Format: 00X_description.sql
```

Chạy migrations:

```bash
npm run migrate
```

### Running Tests

```bash
# Chạy tất cả tests
npm test

# Chạy tests với coverage
npm run test:coverage

# Chạy specific test file
npm test -- example.test.ts
```

### Code Style

Dự án sử dụng ESLint và Prettier:

```bash
# Check linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push và tạo PR
git push origin feature/your-feature
```

Commit message format:

- `feat:` - Tính năng mới
- `fix:` - Sửa bug
- `docs:` - Cập nhật documentation
- `refactor:` - Refactor code
- `test:` - Thêm tests
- `chore:` - Maintenance tasks

## Deployment

### Docker Production

```bash
# Build production image
docker build -t myquizz-api:latest .

# Run production container
docker run -d \
  --name myquizz-api \
  -p 3000:3000 \
  --env-file .env.production \
  myquizz-api:latest
```

### Environment-specific configs

```bash
# Development
NODE_ENV=development

# Staging
NODE_ENV=staging

# Production
NODE_ENV=production
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork repository
2. Create feature branch
3. Commit changes với clear messages
4. Write tests cho features mới
5. Ensure all tests pass
6. Create Pull Request

## Roadmap

Tính năng sắp tới:

- [ ] WebRTC cho voice/video chat trong game
- [ ] AI-generated questions
- [ ] Multiple choice và true/false question types
- [ ] Team-based game mode
- [ ] Custom themes và branding
- [ ] Analytics dashboard
- [ ] Mobile app (React Native)
- [ ] Export/Import quizzes (JSON/CSV)

## Support

Nếu gặp vấn đề hoặc có câu hỏi:

- Tạo issue trên GitHub
- Email: <support@myquizz.com>
- Discord: [Link server]

## License

MIT License - xem file LICENSE để biết thêm chi tiết

## Acknowledgments

- Express.js team
- Socket.IO team
- PostgreSQL community
- AWS S3
- All contributors

---

Được phát triển với TypeScript và Express.js

Version: 1.0.0

Last updated: 2026-06-17
