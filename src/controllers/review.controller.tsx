// backend/src/controllers/review.controller.ts
import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

// Create Review
export const createReview = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { transactionId, rating, comment } = req.body;

    // Validasi input
    if (!transactionId || !rating) {
      return res.status(400).json({
        message: "Transaction ID dan rating harus diisi",
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        message: "Rating harus antara 1-5",
      });
    }

    // Cek apakah transaksi milik user
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        customerId: userId,
        status: "DONE",
      },
      include: {
        review: true,
      },
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaksi tidak ditemukan atau belum selesai",
      });
    }

    // Cek apakah sudah ada review
    if (transaction.review) {
      return res.status(400).json({
        message: "Anda sudah memberikan review untuk transaksi ini",
      });
    }

    // Buat review
    const review = await prisma.review.create({
      data: {
        transactionId,
        rating,
        comment: comment || null,
      },
    });

    res.status(201).json({
      message: "Review berhasil dibuat",
      data: review,
    });
  } catch (error) {
    console.error("Create review error:", error);
    res.status(500).json({
      message: "Terjadi kesalahan server",
    });
  }
};