// backend/src/controllers/event.controller.ts
import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

/**
 * GET /api/events
 * Menampilkan semua event untuk browsing user
 */
export const getEvents = async (req: Request, res: Response) => {
  try {
    const events = await prisma.event.findMany({
      where: {
        availableSeats: { gt: 0 }, // Hanya tampilkan yang masih ada tiket
        endDate: { gt: new Date() } // Hanya tampilkan event yang belum selesai
      },
      orderBy: { startDate: "asc" },
    });

    return res.status(200).json({
      message: "Events fetched successfully",
      data: events,
    });
  } catch (error) {
    console.error("Fetch events error:", error);
    return res.status(500).json({ message: "Gagal mengambil daftar event" });
  }
};

/**
 * GET /api/events/organizer
 * Mengambil event khusus milik organizer yang sedang login
 */
export const getOrganizerEvents = async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;

    const events = await prisma.event.findMany({
      where: { organizerId: userId },
      orderBy: { startDate: "desc" },
    });

    return res.status(200).json({
      message: "Organizer events fetched successfully",
      data: events,
    });
  } catch (error) {
    console.error("Fetch organizer events error:", error);
    return res.status(500).json({ message: "Gagal mengambil event Anda" });
  }
};

/**
 * GET /api/events/:id
 * Detail event berdasarkan UUID
 */
export const getEventById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validasi format UUID yang lebih kokoh
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ 
        message: "Format ID tidak valid. Pastikan ID yang dikirim benar." 
      });
    }

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: {
            email: true,
            avatarUrl: true
          }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ message: "Event tidak ditemukan" });
    }

    return res.status(200).json({
      message: "Event fetched successfully",
      data: event,
    });
  } catch (error) {
    console.error("Fetch event detail error:", error);
    return res.status(500).json({ message: "Terjadi kesalahan server saat mengambil detail event" });
  }
};

/**
 * POST /api/events
 * Membuat event baru (Hanya untuk Role Organizer)
 */
export const createEvent = async (req: any, res: Response) => {
  try {
    const { name, price, totalSeats, startDate, endDate, location, venue, description } = req.body;
    
    // Validasi input minimal
    if (!name || !price || !totalSeats || !startDate || !location) {
      return res.status(400).json({ message: "Semua field wajib diisi" });
    }

    const event = await prisma.event.create({
      data: {
        name,
        location,
        venue,
        description,
        price: Number(price),
        totalSeats: parseInt(totalSeats),
        availableSeats: parseInt(totalSeats),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        organizerId: req.user.userId,
        // Pastikan folder uploads/events sudah dibuat jika menggunakan multer lokal
        imageUrl: req.file ? `/uploads/events/${req.file.filename}` : null
      },
    });

    res.status(201).json({ 
      message: "Event berhasil dipublikasikan", 
      data: event 
    });
  } catch (error: any) {
    console.error("Create event error:", error);
    res.status(500).json({ message: "Gagal membuat event baru", error: error.message });
  }
};

export const updateEvent = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { name, price, totalSeats, startDate, endDate, location, venue, description } = req.body;
    const userId = req.user.userId;

    // 1. Cek apakah event ada dan milik organizer yang login
    const existingEvent = await prisma.event.findUnique({ where: { id } });

    if (!existingEvent) {
      return res.status(404).json({ message: "Event tidak ditemukan" });
    }

    if (existingEvent.organizerId !== userId) {
      return res.status(403).json({ message: "Anda tidak memiliki akses untuk mengubah event ini" });
    }

    // 2. Siapkan data update
    // availableSeats disesuaikan jika totalSeats berubah (logika sederhana)
    const seatsDiff = parseInt(totalSeats) - existingEvent.totalSeats;
    const newAvailableSeats = Math.max(0, existingEvent.availableSeats + seatsDiff);

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        name,
        location,
        venue,
        description,
        price: price ? Number(price) : undefined,
        totalSeats: totalSeats ? parseInt(totalSeats) : undefined,
        availableSeats: totalSeats ? newAvailableSeats : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        // Jika ada file baru, update imageUrl. Jika tidak, tetap gunakan yang lama.
        imageUrl: req.file ? `/uploads/events/${req.file.filename}` : existingEvent.imageUrl
      },
    });

    res.status(200).json({ 
      message: "Event berhasil diperbarui", 
      data: updatedEvent 
    });
  } catch (error: any) {
    console.error("Update event error:", error);
    res.status(500).json({ message: "Gagal memperbarui event", error: error.message });
  }
};

/**
 * DELETE /api/events/:id
 */
export const deleteEvent = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const existingEvent = await prisma.event.findUnique({ where: { id } });

    if (!existingEvent || existingEvent.organizerId !== userId) {
      return res.status(403).json({ message: "Aksi tidak diizinkan" });
    }

    await prisma.event.delete({ where: { id } });

    res.status(200).json({ message: "Event berhasil dihapus" });
  } catch (error: any) {
    res.status(500).json({ message: "Gagal menghapus event" });
  }
};