// @ts-nocheck
import { Router } from "express";
import { prisma } from "../prisma.js";
import { verifyToken, isOrganizer } from "../middleware/aut.js";
import multer from "multer";
import path from "path";
import { TransactionStatus } from "@prisma/client";

const router = Router();

/* =========================
   MULTER CONFIG
========================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    if (ext) return cb(null, true);
    cb(new Error("Hanya file JPG / PNG yang diperbolehkan"));
  },
});

/* =========================
   POST /api/transactions/checkout
========================= */
router.post("/checkout", verifyToken, async (req, res) => {
  const { eventId, usePoints, couponId } = req.body;
  const customerId = req.user.userId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
      });

      if (!event || event.availableSeats < 1) {
        throw new Error("Event tidak ditemukan atau tiket habis");
      }

      let finalPrice = Number(event.price);
      let discount = 0;

      // ===== POINTS =====
      if (usePoints) {
        const points = await tx.userPoint.findMany({
          where: {
            userId: customerId,
            isUsed: false,
            expiredAt: { gt: new Date() },
          },
        });

        const totalPoints = points.reduce((a, b) => a + b.amount, 0);
        discount += totalPoints;

        await tx.userPoint.updateMany({
          where: { userId: customerId, isUsed: false },
          data: { isUsed: true },
        });
      }

      // ===== COUPON =====
      if (couponId) {
        const coupon = await tx.userCoupon.findFirst({
          where: {
            id: couponId,
            userId: customerId,
            isUsed: false,
            expiredAt: { gt: new Date() },
          },
        });

        if (coupon) {
          discount += (finalPrice * coupon.discountVal) / 100;
          await tx.userCoupon.update({
            where: { id: couponId },
            data: { isUsed: true },
          });
        }
      }

      finalPrice = Math.max(0, finalPrice - discount);

      // Kurangi stok
      await tx.event.update({
        where: { id: eventId },
        data: { availableSeats: { decrement: 1 } },
      });

      // Buat transaksi
      const transaction = await tx.transaction.create({
        data: {
          customerId,
          eventId,
          totalPrice: finalPrice,
          status: TransactionStatus.WAITING_PAYMENT,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 jam
        },
      });

      return transaction;
    });

    res.status(201).json({
      message: "Checkout berhasil",
      data: result,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* =========================
   UPLOAD PAYMENT
========================= */
router.patch(
  "/upload-payment/:id",
  verifyToken,
  upload.single("paymentProof"),
  async (req, res) => {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: "File wajib diunggah" });
    }

    const trx = await prisma.transaction.findUnique({ where: { id } });

    if (!trx || trx.customerId !== req.user.userId) {
      return res.status(404).json({ message: "Transaksi tidak ditemukan" });
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        paymentProofUrl: `/uploads/${req.file.filename}`,
        status: TransactionStatus.WAITING_CONFIRMATION,
      },
    });

    res.json({ message: "Bukti pembayaran diunggah", data: updated });
  }
);

/* =========================
   ORGANIZER APPROVAL
========================= */
router.get("/approvals", verifyToken, isOrganizer, async (req, res) => {
  const data = await prisma.transaction.findMany({
    where: {
      status: TransactionStatus.WAITING_CONFIRMATION,
      event: { organizerId: req.user.userId },
    },
  });

  res.json(data);
});

router.patch("/confirm/:id", verifyToken, isOrganizer, async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

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

    return res.json({ message: "Pembayaran ditolak & tiket dikembalikan" });
  }

  res.status(400).json({ message: "Aksi tidak valid" });
});

export default router;
