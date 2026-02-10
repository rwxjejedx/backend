import { Router } from "express";
import { verifyToken } from "../middleware/aut.js";
// Ambil updatePassword dari auth.controller
import { updatePassword } from "../controllers/auth.controller.js";
// Ambil getProfile dan updateAvatar dari user.controller
import { getProfile, updateAvatar } from "../controllers/user.controller.js"; 
import multer from "multer";
import path from "path";

const router = Router();

// Konfigurasi Multer untuk Avatar
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/avatars/");
  },
  filename: (req, file, cb) => {
    cb(null, `avatar-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

/* =========================
   USER & PROFILE ROUTES
========================= */

// Endpoint: GET /api/users/me
router.get("/me", verifyToken, getProfile);

// Endpoint: PATCH /api/users/me/password (Match dengan Frontend!)
router.patch("/me/password", verifyToken, updatePassword);

// Endpoint: PATCH /api/users/me/avatar
router.patch("/me/avatar", verifyToken, upload.single("avatar"), updateAvatar);

export default router;