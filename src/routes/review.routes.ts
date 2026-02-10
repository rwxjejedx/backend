import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { verifyToken } from "../middleware/aut.js"; // Sesuaikan dengan nama file middleware Anda (aut.js atau auth.js)

const router = Router();

/**
 * POST: Membuat review baru
 * Proteksi: Token valid, Transaksi DONE, Event sudah berakhir, Belum pernah review
 */
router.post("/", verifyToken, async (req: any, res) => {
  const { transactionId, rating, comment } = req.body;
  const customerId = req.user.userId;

  try {
    // 1. Validasi input dasar
    if (!transactionId || !rating) {
      return res.status(400).json({ message: "Transaction ID dan rating harus diisi" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating harus antara 1-5" });
    }

    // 2. Validasi Transaksi & Kepemilikan
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        customerId: customerId,
        status: "DONE"
      },
      include: {
        review: true,
        event: true
      }
    });

    if (!transaction) {
      return res.status(403).json({ 
        message: "Hanya transaksi yang sudah selesai (DONE) yang dapat direview." 
      });
    }

    // 3. Cek apakah sudah pernah review (Unique Constraint)
    if (transaction.review) {
      return res.status(400).json({ message: "Anda sudah memberikan review untuk transaksi ini." });
    }

    // 4. Cek apakah event sudah selesai (User Experience)
    const eventEnded = new Date(transaction.event.endDate) < new Date();
    if (!eventEnded) {
      return res.status(400).json({
        message: "Event belum selesai. Review hanya bisa diberikan setelah event berakhir."
      });
    }

    // 5. Simpan Review
    const review = await prisma.review.create({
      data: {
        transactionId,
        rating: Math.min(5, Math.max(1, rating)),
        comment: comment || null
      }
    });

    res.status(201).json({
      message: "Terima kasih atas ulasan Anda!",
      data: review
    });
  } catch (error: any) {
    console.error("Create review error:", error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: "Anda sudah memberikan ulasan untuk transaksi ini." });
    }
    res.status(500).json({ message: "Gagal mengirim ulasan." });
  }
});

/**
 * GET: Review untuk event tertentu (Public)
 */
router.get("/event/:eventId", async (req, res) => {
  const { eventId } = req.params;

  try {
    const reviews = await prisma.review.findMany({
      where: {
        transaction: { 
          eventId,
          status: "DONE"
        }
      },
      include: {
        transaction: {
          select: {
            customer: { 
              select: { 
                email: true,
                avatarUrl: true 
              } 
            },
            
          }
        }
      },
      orderBy: { id: 'desc' }
    });

    const formattedReviews = reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      customerEmail: review.transaction.customer.email,
      customerAvatar: review.transaction.customer.avatarUrl,
      // createdAt: review.transaction.createdAt <-- INI JUGA DIHAPUS JIKA DI SCHEMA TIDAK ADA
    }));

    res.json({ data: formattedReviews, total: reviews.length });
  } catch (error) {
    console.error("Get reviews error:", error);
    res.status(500).json({ message: "Gagal memuat ulasan." });
  }
});

/**
 * GET: Statistik Review (Average & Distribution)
 */
router.get("/event/:eventId/stats", async (req, res) => {
  const { eventId } = req.params;

  try {
    const reviews = await prisma.review.findMany({
      where: {
        transaction: { eventId, status: "DONE" }
      },
      select: { rating: true }
    });

    if (reviews.length === 0) {
      return res.json({
        total: 0,
        averageRating: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      });
    }

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / reviews.length;

    const ratingDistribution = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length,
    };

    res.json({
      total: reviews.length,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution
    });
  } catch (error) {
    res.status(500).json({ message: "Gagal memuat statistik ulasan" });
  }
});

/**
 * DELETE: Hapus Review (Owner Only)
 */
router.delete("/:reviewId", verifyToken, async (req: any, res) => {
  const { reviewId } = req.params;
  const customerId = req.user.userId;

  try {
    const existingReview = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { transaction: { select: { customerId: true } } }
    });

    if (!existingReview) {
      return res.status(404).json({ message: "Review tidak ditemukan" });
    }

    if (existingReview.transaction.customerId !== customerId) {
      return res.status(403).json({ message: "Anda tidak memiliki akses hapus." });
    }

    await prisma.review.delete({ where: { id: reviewId } });
    res.json({ message: "Review berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: "Gagal menghapus review" });
  }
});

export default router;