import express from "express";
import cors from "cors";
import { config } from "./infrastructure/config/config.js";
import { runMigrations } from "./infrastructure/database/migrate.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { errorHandler } from "./shared/middlewares/error.handler.js";
import cookieParser from "cookie-parser";
import { userRouter } from "./modules/user/user.routes.js";

const port = config.server.port;
await runMigrations();

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = config.cors.allowOrigin
        .split(",")
        .map((o) => o.trim());
      allowedOrigins.push(config.cors.frontendUrl);

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(express.json());

app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Hello, world");
});

app.use("/auth", authRouter);

app.use("/users", userRouter);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
