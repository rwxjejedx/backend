import { Router } from "express";
import { prisma } from "../prisma.js";
import { verifyToken, isOrganizer } from "../middleware/aut.js";

const router = Router();

// Create Event (Hanya Organizer)
router.post("/", verifyToken, isOrganizer, async (req: any, res) => {
  const { name, price, totalSeats, startDate, endDate } = req.body;
  try {
    const event = await prisma.event.create({
      data: {
        name,
        price,
        totalSeats,
        availableSeats: totalSeats,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        organizerId: req.user.userId
      }
    });
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ message: "Gagal membuat event" });
  }
});

// Get All Events (Public)
router.get("/", async (req, res) => {
  const events = await prisma.event.findMany();
  res.json(events);
});

export default router;