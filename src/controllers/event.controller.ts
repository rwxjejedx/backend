import { Request, Response } from "express";
import { prisma } from "../prisma.js";

/**
 * GET /api/events
 * Event browsing
 */
export const getEvents = async (req: Request, res: Response) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: {
        startDate: "asc",
      },
    });

    return res.status(200).json({
      message: "Events fetched successfully",
      data: events,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to fetch events",
    });
  }
};

/**
 * GET /api/events/:id
 * Event detail
 */
export const getEventById = async (req: Request, res: Response) => {
  try {
    // ✅ FIX TYPE (paksa string)
    const id = req.params.id as string;

    // ✅ VALIDASI UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(id)) {
      return res.status(404).json({
        message: "Event not found",
      });
    }

    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({
        message: "Event not found",
      });
    }

    return res.status(200).json({
      message: "Event fetched successfully",
      data: event,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to fetch event detail",
    });
  }
};

/**
 * POST /api/events
 * Create event (Organizer only)
 */
export const createEvent = async (req: any, res: Response) => {
  try {
    const {
      name,
      price,
      totalSeats,
      startDate,
      endDate,
    } = req.body;

    // VALIDASI BASIC
    if (!name || !price || !totalSeats || !startDate || !endDate) {
      return res.status(400).json({
        message: "Field tidak lengkap",
      });
    }

    const event = await prisma.event.create({
      data: {
        organizerId: req.user.userId, 
        name,
        price: Number(price),
        totalSeats: Number(totalSeats),
        availableSeats: Number(totalSeats),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });

    return res.status(201).json({
      message: "Event created successfully",
      data: event,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to create event",
    });
  }
};

