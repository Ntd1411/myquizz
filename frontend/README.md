# MyQuizz Frontend (Vue 3 + Vite)

Giao dien nguoi dung cho MyQuizz. Giai doan hien tai: **M0 (nen mong) + M1 (xac thuc) + M2 (duyet quiz)**.

## Stack

| Lop | Cong nghe |
| --- | --- |
| Framework | Vue 3 (Composition API, `<script setup>`), JavaScript |
| Build | Vite 5 |
| Router | Vue Router 4 |
| State | Pinia |
| Data fetching | TanStack Query (vue-query) |
| HTTP | axios (`withCredentials: true`) |
| Realtime | socket.io-client (chuan bi cho M3) |
| Style | Tailwind CSS voi token MyQuizz |
| Motion | GSAP (Flip, ScrollTrigger) + Lenis |

## Chay du an

```bash
cp .env.example .env      # sua VITE_API_BASE_URL cho dung backend
npm install
npm run dev               # http://localhost:5173
```

> Backend phai liet ke `http://localhost:5173` trong `FRONTEND_URL` / `ALLOW_ORIGIN`,
> neu khong trinh duyet se chan cookie va moi request deu la khach.

## Cau truc thu muc

```
src/
  api/          # Lop goi REST. Moi file map 1 nhom endpoint.
    http.js       # axios instance + interceptor tu dong refresh 401
    envelope.js   # boc/mo envelope { success, data, error, meta }
  stores/       # Pinia: auth, ui (toast)
  composables/  # useMotion (GSAP/Lenis), useGuestId
  components/
    base/         # BaseField, BaseSpinner, ToastHost
    layout/       # TopBar, AppFooter
    quiz/         # QuizCard, SeeAllCard, QuizRail (carousel caterpillar)
  pages/        # Mot file cho moi route
  router/       # Bang route + guard
```

## Quy uoc quan trong

### 1. Envelope

Moi response deu co dang `{ success, data, error, meta }`. **Khong bao gio** doc thang
`res.data`; luon di qua `unwrap()`. Danh sach nam duoi `data.<collection>`, phan trang
nam duoi `meta.pagination`.

### 2. Xac thuc bang cookie HttpOnly

Backend luu `accessToken` / `refreshToken` trong cookie HttpOnly. JavaScript **khong doc duoc**
token. Vi vay:

- moi request phai co `withCredentials: true`;
- khong luu token vao `localStorage`;
- khi gap `401`, interceptor tu goi `POST /auth/refresh` mot lan duy nhat (single-flight)
  roi thu lai request goc;
- neu refresh that bai, app phat su kien `myquizz:auth-expired`, xoa session va dieu huong ve `/login`.

### 3. Bao mat khi choi

Dap an dung khong bao gio duoc gui xuong client khi cau hoi con mo. Trang chi tiet quiz
cung khong render `correct_answer`. Dong ho phai tinh tu `serverTime` / `endsAt` cua server,
khong dung dong ho may khach.

### 4. QuizRail (carousel caterpillar)

- Cua so co dinh N the (desktop 4, tablet 3/2, mobile 1).
- Bam tien: the trai cung thu nho + mo dan ve phia trai, cac the giua truot sang,
  the moi hien ra ben phai.
- **Khong loop vo han**: `index` bi kep trong `[0, total - perView]`, mui ten khong con
  huong nao thi bien mat han.
- The cuoi cung cua moi hang la the **"Xem tat ca"** thuc su, truot cung nhip voi cac the khac.
- Moi the luon nam trong DOM, chi bi `display: none` khi ra khoi cua so, de GSAP Flip
  xu ly on dinh.
- Ton trong `prefers-reduced-motion`: khi bat, chi doi cua so, khong chay animation.

## Buoc tiep theo (chua lam)

- M3: tao / sua quiz (upload anh qua `/storage/presign`).
- M4: lobby + Socket.IO namespace `/game`.
- M5: man hinh choi (host + player), dong bo dong ho server.
- M6: bang xep hang va ket qua.
- M7: ho so nguoi dung, doi avatar, doi mat khau.

> Form cau hinh che do choi phai render tu `GET /games/game-modes` (`editable` / `locked`),
> tuyet doi khong hardcode. Che do `team` hien dang an.
