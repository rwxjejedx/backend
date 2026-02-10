// backend/src/routes/transaction.routes.ts
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { 
  getMyTickets,
  getTransactionHistory,
  getTransactionById 
} from "../controllers/transsaction.controller.js";
import { verifyToken, isOrganizer } from "../middleware/aut.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { TransactionStatus } from "@prisma/client";

const router = Router();

/* =========================
   SETUP FOLDER UPLOADS
========================= */
const uploadDir = "uploads/payments";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); 
  },
  filename: (req, file, cb) => {
    cb(null, `PAY-${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    if (extname) return cb(null, true);
    cb(new Error("Hanya file JPG / PNG yang diperbolehkan"));
  }
});

/* =========================
   POST /api/transactions/checkout
========================= */
router.post("/checkout", verifyToken, async (req, res) => {
  const { eventId, usePoints } = req.body;
  const customerId = (req as any).user.userId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validasi Event & Stok
      const event = await tx.event.findUnique({ where: { id: eventId } });
      if (!event || event.availableSeats < 1) {
        throw new Error("Tiket habis atau event tidak ada");
      }

      let finalPrice = Number(event.price);

      // 2. Potongan Poin
      if (usePoints) {
        const points = await tx.userPoint.findMany({
          where: { 
            userId: customerId, 
            isUsed: false, 
            expiredAt: { gt: new Date() } 
          }
        });
        const totalPoints = points.reduce((sum, p) => sum + p.amount, 0);
        
        finalPrice = Math.max(0, finalPrice - totalPoints);

        await tx.userPoint.updateMany({
          where: { userId: customerId, isUsed: false },
          data: { isUsed: true }
        });
      }

      // 3. Kurangi Kuota & Buat Transaksi
      await tx.event.update({
        where: { id: eventId },
        data: { availableSeats: { decrement: 1 } }
      });

      return await tx.transaction.create({
        data: {
          customerId,
          eventId,
          totalPrice: finalPrice,
          status: TransactionStatus.WAITING_PAYMENT,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
        }
      });
    });

    res.status(201).json({ message: "Checkout Berhasil", data: result });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

/* =========================
   PATCH /api/transactions/upload-payment/:id
========================= */
router.patch(
  "/upload-payment/:id",
  verifyToken,
  upload.single("paymentProof"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({ 
          message: "File bukti pembayaran wajib diunggah" 
        });
      }

      // Pastikan transaksi ini milik user yang sedang login
      const trx = await prisma.transaction.findUnique({ where: { id } });
      if (!trx || trx.customerId !== (req as any).user.userId) {
        return res.status(404).json({ 
          message: "Transaksi tidak ditemukan" 
        });
      }

      const updated = await prisma.transaction.update({
        where: { id },
        data: {
          paymentProofUrl: `/uploads/payments/${req.file.filename}`,
          status: TransactionStatus.WAITING_CONFIRMATION,
        },
      });

      res.json({ 
        message: "Bukti pembayaran berhasil diunggah", 
        data: updated 
      });
    } catch (error: any) {
      console.error("UPLOAD ERROR:", error.message);
      res.status(500).json({ 
        message: "Gagal mengunggah bukti", 
        detail: error.message 
      });
    }
  }
);

/* =========================
   ORGANIZER APPROVAL ROUTES
========================= */
router.get("/approvals", verifyToken, isOrganizer, async (req, res) => {
  const data = await prisma.transaction.findMany({
    where: {
      status: TransactionStatus.WAITING_CONFIRMATION,
      event: { organizerId: (req as any).user.userId },
    },
    include: {
      customer: { select: { email: true } },
      event: { select: { name: true } }
    }
  });
  res.json(data);
});

router.patch("/confirm/:id", verifyToken, isOrganizer, async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  try {
    if (action === "approve") {
      await prisma.transaction.update({
        where: { id },
        data: { status: TransactionStatus.DONE },
      });
      return res.json({ message: "Pembayaran disetujui" });
    }

    if (action === "reject") {
      await prisma.$transaction(async (tx) => {
        const trx = await tx.transaction.update({
          where: { id },
          data: { status: TransactionStatus.REJECTED },
        });

        await tx.event.update({
          where: { id: trx.eventId },
          data: { availableSeats: { increment: 1 } },
        });
      });
      return res.json({ message: "Pembayaran ditolak & kuota dikembalikan" });
    }

    res.status(400).json({ message: "Aksi tidak valid" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/* =========================
   USER TRANSACTION ROUTES
========================= */

// GET My Tickets (menggunakan controller)
router.get("/my-tickets", verifyToken, getMyTickets);

// GET Transaction History (menggunakan controller)
router.get("/history", verifyToken, getTransactionHistory);

// GET Transaction Detail by ID (menggunakan controller)
router.get("/:id", verifyToken, getTransactionById);

export default router;