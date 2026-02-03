import { Router } from "express";
import { prisma } from "../prisma.js";
import { verifyToken, isOrganizer } from "../middleware/aut.js"
import multer from "multer";
import path from "path";

const router = Router();
// --- Konfigurasi Multer ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // Menamai file: timestamp-namaasli.jpg
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // Batas 2MB
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) return cb(null, true);
    cb(new Error("Hanya file gambar (JPG/PNG) yang diperbolehkan!"));
  }
});

router.post("/buy", verifyToken, async (req: any, res) => {
  const { eventId, usePoints, couponId } = req.body;
  const customerId = req.user.userId;

  try {
    // 1. Gunakan Transaction (Atomic) agar data konsisten
    const result = await prisma.$transaction(async (tx) => {
      // a. Cek ketersediaan event & kursi
      const event = await tx.event.findUnique({
        where: { id: eventId },
      });

      if (!event || event.availableSeats < 1) {
        throw new Error("Tiket sudah habis atau event tidak ditemukan");
      }

      let finalPrice = Number(event.price);
      let discount = 0;

      // b. Logika Poin (Potongan maks 10.000 atau sesuai saldo)
      if (usePoints) {
        const points = await tx.userPoint.findMany({
          where: { userId: customerId, isUsed: false, expiredAt: { gt: new Date() } }
        });
        const totalPoints = points.reduce((acc, p) => acc + p.amount, 0);
        
        // Contoh: Potong semua poin yang ada
        discount += totalPoints;
        
        // Tandai poin sebagai terpakai
        await tx.userPoint.updateMany({
          where: { userId: customerId, isUsed: false },
          data: { isUsed: true }
        });
      }

      // c. Logika Kupon (Diskon persentase, misal 10%)
      if (couponId) {
        const coupon = await tx.userCoupon.findFirst({
          where: { id: couponId, userId: customerId, isUsed: false, expiredAt: { gt: new Date() } }
        });
        
        if (coupon) {
          const couponDiscount = (finalPrice * coupon.discountVal) / 100;
          discount += couponDiscount;
          
          await tx.userCoupon.update({
            where: { id: couponId },
            data: { isUsed: true }
          });
        }
      }

      finalPrice = Math.max(0, finalPrice - discount);

      // d. Kurangi stok tiket
      await tx.event.update({
        where: { id: eventId },
        data: { availableSeats: { decrement: 1 } }
      });

      // e. Buat record transaksi
      const transaction = await tx.transaction.create({
        data: {
          customerId,
          eventId,
          totalPrice: finalPrice,
          status: "waiting_for_payment",
          expiresAt: new Date(new Date().getTime() + 2 * 60 * 60 * 1000) // 2 jam untuk bayar
        }
      });

      return transaction;
    });

    res.status(201).json({ message: "Pesanan berhasil dibuat", data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// --- Existing Route: Buy Ticket ---
// (Tetap simpan code pembelian yang sebelumnya di sini)

// --- NEW Route: Upload Bukti Pembayaran ---
router.patch("/upload-payment/:id", verifyToken, upload.single("paymentProof"), async (req: any, res) => {
  const { id } = req.params; // ID Transaksi

  try {
    if (!req.file) {
      return res.status(400).json({ message: "File bukti pembayaran wajib diunggah" });
    }

    const transaction = await prisma.transaction.findUnique({ where: { id } });

    if (!transaction || transaction.customerId !== req.user.userId) {
      return res.status(404).json({ message: "Transaksi tidak ditemukan" });
    }

    if (transaction.status !== "waiting_for_payment") {
      return res.status(400).json({ message: "Transaksi ini tidak dalam status menunggu pembayaran" });
    }

    // Update transaksi dengan URL file dan ubah status
    const updatedTrx = await prisma.transaction.update({
      where: { id },
      data: {
        paymentProofUrl: `/uploads/${req.file.filename}`,
        status: "waiting_for_confirmation"
      }
    });

    res.json({
      message: "Bukti pembayaran berhasil diunggah. Menunggu konfirmasi organizer.",
      data: updatedTrx
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// --- GET: List Pembayaran yang Menunggu Konfirmasi (Hanya untuk Organizer) ---
router.get("/approvals", verifyToken, isOrganizer, async (req: any, res) => {
  try {
    const pendingApprovals = await prisma.transaction.findMany({
      where: {
        status: "waiting_for_confirmation",
        event: { organizerId: req.user.userId } // Hanya event milik organizer ini
      },
      include: {
        customer: { select: { email: true } },
        event: { select: { name: true } }
      }
    });
    res.json(pendingApprovals);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data persetujuan" });
  }
});

// --- PATCH: Setujui atau Tolak Pembayaran ---
router.patch("/confirm/:id", verifyToken, isOrganizer, async (req: any, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'approve' atau 'reject'

  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { event: true }
    });

    if (!transaction || transaction.event.organizerId !== req.user.userId) {
      return res.status(404).json({ message: "Transaksi tidak ditemukan" });
    }

    if (action === "approve") {
  await prisma.$transaction(async (tx) => {
    // 1. UPDATE status transaksi menjadi DONE
    const updatedTrx = await tx.transaction.update({
      where: { id: id }, // ID dari params
      data: { 
        status: "done" // Mengubah status menjadi done
      },
      include: { 
        customer: true // Mengambil data customer untuk pengecekan referral
      }
    });

    // 2. CEK apakah ini transaksi pertama yang berhasil (done)
    const transactionCount = await tx.transaction.count({
      where: { 
        customerId: updatedTrx.customerId, 
        status: "done",
        NOT: { id: id } // Kecualikan transaksi yang baru saja kita 'done'-kan
      }
    });

    // 3. LOGIKA REFERRAL: Jika ini transaksi pertama & ada kode pengajak
    if (transactionCount === 0 && updatedTrx.customer.referredById) {
      const referrer = await tx.user.findUnique({
        where: { referralCode: updatedTrx.customer.referredById }
      });

      if (referrer) {
        await tx.userPoint.create({
          data: {
            userId: referrer.id,
            amount: 10000,
            expiredAt: new Date(new Date().setMonth(new Date().getMonth() + 3)),
            isUsed: false
          }
        });
      }
    }
  });

  return res.json({ message: "Pembayaran disetujui & poin referral diproses!" });
}
    
    if (action === "reject") {
      // 1. Update status jadi REJECTED
      await prisma.transaction.update({
        where: { id },
        data: { status: "rejected" }
      });

      // 2. Kembalikan stok kursi karena pembayaran ditolak
      await prisma.event.update({
        where: { id: transaction.eventId },
        data: { availableSeats: { increment: 1 } }
      });

      return res.json({ message: "Pembayaran ditolak, stok tiket telah dikembalikan." });
    }

    res.status(400).json({ message: "Aksi tidak valid (gunakan approve/reject)" });
  } catch (error) {
    res.status(500).json({ message: "Gagal memproses konfirmasi" });
  }
});

export default router;