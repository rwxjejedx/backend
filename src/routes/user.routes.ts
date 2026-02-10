import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { verifyToken } from "../middleware/aut.js";
import multer from "multer";
import path from "path";
import fs from 'fs';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "rahasia_eventix_2026";
// Tambahkan pengecekan folder di bagian atas
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
/* =========================
   MULTER CONFIG (AVATAR)
========================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/avatars/");
  },
  filename: (req, file, cb) => {
    cb(null, `avatar-${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    if (ext) return cb(null, true);
    cb(new Error("Hanya JPG / PNG"));
  },
});

/* =========================
   AUTH
========================= */
// Register
router.post("/register", async (req, res) => {
  const { email, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: role || "customer",
        referralCode: `EVT-${crypto
          .randomBytes(3)
          .toString("hex")
          .toUpperCase()}`,
      },
    });
    res.status(201).json({ message: "User created", data: { email: user.email } });
  } catch {
    res.status(400).json({ message: "Email sudah terdaftar" });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && (await bcrypt.compare(password, user.password))) {
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );
    return res.json({ token, role: user.role });
  }
  res.status(401).json({ message: "Invalid credentials" });
});

/* =========================
   GET PROFILE
========================= */
router.get("/me", verifyToken, async (req: any, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      email: true,
      role: true,
      referralCode: true,
      avatarUrl: true,
    },
  });

  if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

  res.json({
    message: "Profile fetched successfully",
    data: user,
  });
});

/* =========================
   UPDATE PROFILE
========================= */
router.patch("/me", verifyToken, async (req: any, res) => {
  const { email } = req.body;

  const updated = await prisma.user.update({
    where: { id: req.user.userId },
    data: { email },
    select: {
      id: true,
      email: true,
      avatarUrl: true,
    },
  });

  res.json({
    message: "Profile updated",
    data: updated,
  });
});

/* =========================
   UPLOAD AVATAR
========================= */
router.patch(
  "/me/avatar",
  verifyToken,
  upload.single("avatar"), // Key harus "avatar"
  async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "File wajib diunggah" });
      }

      const updated = await prisma.user.update({
        where: { id: req.user.userId },
        data: {
          avatarUrl: `/uploads/avatars/${req.file.filename}`,
        },
        select: {
          id: true,
          email: true,
          role: true, // Sertakan role
          referralCode: true, // Sertakan referralCode
          avatarUrl: true,
        },
      });

      res.json({
        message: "Avatar updated",
        data: updated, // Kirim object user lengkap
      });
    } catch (error) {
      res.status(500).json({ message: "Server error saat upload avatar" });
    }
  }
);

export default router;
