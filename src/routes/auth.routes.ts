import { Router } from "express";
import { 
  login, 
  register, 
  logout 
} from "../controllers/auth.controller.js";
import { verifyToken } from "../middleware/aut.js"; 

const router = Router();

// Public routes (Tidak perlu login)
router.post("/login", login);
router.post("/register", register);

// Protected routes
router.post("/logout", verifyToken, logout);

export default router;