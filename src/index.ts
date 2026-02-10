import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs"; // Tambahkan fs untuk memastikan folder ada
import { env } from "./config/env.js";
import { initCronJobs } from "./lib/cron.js";

// Import Routes
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import eventRoutes from "./routes/event.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import reviewRoutes from "./routes/review.routes.js"; // Pastikan extension atau penamaan konsisten

const app = express();

// --- Konfigurasi Path ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pastikan folder uploads tersedia agar tidak error saat Multer dijalankan
const uploadFolders = ["uploads/events", "uploads/payments", "uploads/avatars"];
uploadFolders.forEach((folder) => {
  const fullPath = path.join(process.cwd(), folder);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`📁 Folder created: ${folder}`);
  }
});

// --- Middleware Global ---
app.use(cors({
  origin: 'http://localhost:5173', // Sesuaikan dengan port Vite Anda
  credentials: true
}));
app.use(express.json());

// --- Static Files ---
// Menggunakan process.cwd() lebih aman untuk akses folder root dari src/index.ts
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// --- Routes ---
app.use("/api/auth", authRoutes);       // Khusus Login & Register
app.use("/api/users", userRoutes);      // Khusus Profile, Avatar, & Password
app.use("/api/events", eventRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reviews", reviewRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Server is running",
    timestamp: new Date().toISOString()
  });
});

// --- Error Handling Middleware (Opsional tapi sangat disarankan) ---
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("❌ GLOBAL ERROR:", err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err : {}
  });
});

// --- Server Activation ---
const PORT = env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
  🚀 Server Eventix berjalan di port ${PORT}!
  📂 Static Assets: http://localhost:${PORT}/uploads
  🔐 Auth API: http://localhost:${PORT}/api/auth
  🎫 Transactions API: http://localhost:${PORT}/api/transactions
  ⭐ Reviews API: http://localhost:${PORT}/api/reviews
  `);

  initCronJobs();
});