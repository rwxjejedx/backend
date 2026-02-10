// backend/src/routes/auth.routes.ts
import { Router } from "express";
import { 
  login, 
  register, 
  getProfile, 
  updateProfile,
  changePassword,
  logout 
} from "../controllers/auth.controller.js";
import { verifyToken } from "../middleware/aut.js";

const router = Router();

// Public routes
router.post("/login", login);
router.post("/register", register);

// Protected routes
router.get("/profile", verifyToken, getProfile);
router.put("/profile", verifyToken, updateProfile);
router.post("/change-password", verifyToken, changePassword);
router.post("/logout", verifyToken, logout);

export default router;