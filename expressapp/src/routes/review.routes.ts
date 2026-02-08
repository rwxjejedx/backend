import { Router } from "express";
import { prisma } from "../prisma.js";
import { verifyToken } from "../middleware/aut.js";

const router = Router();

// --- POST: Memberikan Review Baru ---
router.post("/", verifyToken, async (req: any, res) => {
  const { transactionId, rating, comment } = req.body;
  const customerId = req.user.userId;

  try {
    // 1. Validasi: Apakah transaksi ini milik user tersebut dan sudah selesai (done)?
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        customerId: customerId,
        status: "done"
      }
    });

    if (!transaction) {
      return res.status(403).json({ 
        message: "Hanya transaksi yang sudah selesai (done) yang dapat direview." 
      });
    }

    // 2. Simpan Review
    const review = await prisma.review.create({
      data: {
        transactionId,
        rating: Math.min(5, Math.max(1, rating)), // Pastikan rating di rentang 1-5
        comment
      }
    });

    res.status(201).json({
      message: "Terima kasih atas ulasan Anda!",
      data: review
    });
  } catch (error: any) {
    // Jika user mencoba review dua kali untuk transaksi yang sama
    if (error.code === 'P2002') {
      return res.status(400).json({ message: "Anda sudah memberikan ulasan untuk transaksi ini." });
    }
    res.status(500).json({ message: "Gagal mengirim ulasan." });
  }
});

// --- GET: Melihat Review untuk Event Tertentu ---
router.get("/event/:eventId", async (req, res) => {
  const { eventId } = req.params;

  try {
    const reviews = await prisma.review.findMany({
      where: {
        transaction: { eventId }
      },
      include: {
        transaction: {
          select: {
            customer: { select: { email: true } }
          }
        }
      }
    });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Gagal memuat ulasan." });
  }
});

export default router;