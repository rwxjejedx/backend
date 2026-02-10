import { Router } from "express";
import { 
  getEvents, 
  getEventById, 
  createEvent, 
  getOrganizerEvents,
  updateEvent, // Import fungsi update
  deleteEvent  // Import fungsi delete
} from "../controllers/event.controller.js";
import { verifyToken, isOrganizer } from "../middleware/aut.js"; 
import { uploadEvent } from "../middleware/uploadEvent.js";

const router = Router();

/* =========================
   PUBLIC ROUTES
   ========================= */

// Menampilkan semua event di halaman Home
router.get("/", getEvents);

// Ambil list event khusus milik organizer yang sedang login
// WAJIB di atas /:id agar "organizer" tidak terbaca sebagai UUID
router.get("/organizer", verifyToken, isOrganizer, getOrganizerEvents);

// Detail event berdasarkan ID
router.get("/:id", getEventById);


/* =========================
   PROTECTED ROUTES (Organizer Only)
   ========================= */

/**
 * POST: Membuat event baru
 */
router.post(
  "/", 
  verifyToken, 
  isOrganizer, 
  uploadEvent.single("eventImage"), 
  createEvent
);

/**
 * PUT: Memperbarui data event yang sudah ada
 * Menggunakan uploadEvent.single agar bisa ganti banner
 */
router.put(
  "/:id",
  verifyToken,
  isOrganizer,
  uploadEvent.single("eventImage"),
  updateEvent
);

/**
 * DELETE: Menghapus event
 */
router.delete(
  "/:id",
  verifyToken,
  isOrganizer,
  deleteEvent
);

export default router;