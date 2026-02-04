import { Router } from "express";
import { getEvents, getEventById, createEvent } from "../controllers/event.controller.js";
import { verifyToken, isOrganizer } from "../middleware/aut.js";

const router = Router();

/**
 * PUBLIC
 * Get all events (event browsing)
 */
router.get("/", getEvents);

/**
 * PUBLIC
 * Get event detail by ID
 */
router.get("/:id", getEventById);

/**
 * PROTECTED
 * Create event (Organizer only)
 */
router.post("/", verifyToken, isOrganizer, createEvent);

export default router;
