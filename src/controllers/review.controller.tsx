// backend/src/controllers/review.controller.ts
import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

// Ambil Review Saya
export const getMyReviews = async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;

    const reviews = await prisma.review.findMany({
      where: {
        transaction: {
          customerId: userId,
        },
      },
      include: {
        transaction: {
          include: {
            event: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                location: true,
                startDate: true,
              },
            },
          },
        },
      },
      orderBy: { id: "desc" },
    });

    const formattedData = reviews.map((rev) => ({
      id: rev.id,
      rating: rev.rating,
      comment: rev.comment,
      createdAt: rev.createdAt, // Menggunakan createdAt dari transaksi
      event: rev.transaction.event,
    }));

    res.json({ success: true, data: formattedData });
  } catch (error) {
    res.status(500).json({ message: "Gagal memuat ulasan Anda" });
  }
};

// Create Review (Pastikan ini juga diekspor)
export const createReview = async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const { transactionId, rating, comment } = req.body;

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, customerId: userId, status: "DONE" },
      include: { review: true }
    });

    if (!transaction || transaction.review) {
      return res.status(400).json({ message: "Transaksi tidak valid atau sudah direview" });
    }

    const review = await prisma.review.create({
      data: {
        transactionId,
        rating: Number(rating),
        comment: comment || null,
      },
    });

    res.status(201).json({ message: "Review berhasil dibuat", data: review });
  } catch (error) {
    res.status(500).json({ message: "Gagal membuat ulasan" });
  }
};