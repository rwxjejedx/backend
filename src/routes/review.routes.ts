// backend/src/routes/review.routes.ts
import { Router } from "express";
import { verifyToken } from "../middleware/aut.js";
import { getMyReviews, createReview } from "../controllers/review.controller.js";

const router = Router();

// 1. Rute Statis (Taruh Paling Atas)
router.get("/me", verifyToken, getMyReviews);

// 2. Rute Membuat Review
router.post("/", verifyToken, createReview);

// 3. Rute Dinamis (Taruh Paling Bawah)
// Jika ada rute seperti router.delete("/:reviewId"), letakkan di sini.

export default router;