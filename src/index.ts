import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { initCronJobs } from "./lib/cron.js";

// Import Routes
import userRoutes from "./routes/user.routes.js";
import eventRoutes from "./routes/event.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import reviewRoutes from "./routes/review.routes.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Middleware Global ---
app.use(cors());
app.use(express.json());

// Membuat folder 'uploads' bisa diakses secara publik (misal: localhost:3000/uploads/file.jpg)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// --- Routes ---
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reviews", reviewRoutes);

// --- Server Activation ---
const PORT = env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
  🚀 Server Eventix berjalan di port ${PORT}!
  📂 Uploads path: http://localhost:${PORT}/uploads
  `);

  // Jalankan Cron Job untuk pembatalan otomatis
  initCronJobs();
});