// backend/src/controllers/transaction.controller.ts
import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

// Create Transaction
export const createTransaction = async (req: Request, res: Response) => {
  try {
    const { eventId, totalPrice } = req.body;
    const customerId = (req as any).user.userId;

    // 1. Cek apakah event ada dan kuota masih tersedia
    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) return res.status(404).json({ message: "Event tidak ditemukan" });
    if (event.availableSeats <= 0) {
      return res.status(400).json({ message: "Maaf, tiket sudah habis" });
    }

    // 2. Jalankan transaksi database
    const result = await prisma.$transaction(async (tx) => {
      // A. Buat record transaksi
      const transaction = await tx.transaction.create({
        data: {
          customerId,
          eventId,
          totalPrice: totalPrice,
          status: "WAITING_PAYMENT",
          // Set expired dalam 2 jam untuk pembayaran
          expiresAt: new Date(new Date().getTime() + 2 * 60 * 60 * 1000),
        },
      });

      // B. Kurangi availableSeats di tabel Event
      await tx.event.update({
        where: { id: eventId },
        data: {
          availableSeats: { decrement: 1 }
        }
      });

      return transaction;
    });

    res.status(201).json({
      message: "Transaksi berhasil dibuat, silakan upload bukti pembayaran",
      data: result
    });

  } catch (error) {
    console.error("TRANSACTION ERROR:", error);
    res.status(500).json({ message: "Gagal memproses transaksi" });
  }
};

// Get My Tickets (untuk halaman My Tickets)
export const getMyTickets = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const transactions = await prisma.transaction.findMany({
      where: {
        customerId: userId,
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            price: true,
            // Tambahkan field lain jika ada di schema
            // venue: true,
            // imageUrl: true,
          },
        },
        review: {
          select: {
            id: true,
            rating: true,
            comment: true,
          },
        },
      },
      orderBy: {
        expiresAt: 'desc',
      },
    });

    res.json({
      data: transactions,
    });
  } catch (error) {
    console.error("Get my tickets error:", error);
    res.status(500).json({
      message: "Gagal mengambil tiket",
    });
  }
};

// Get Transaction History (untuk halaman Transaction History)
export const getTransactionHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const transactions = await prisma.transaction.findMany({
      where: {
        customerId: userId,
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            price: true,
            // venue: true,
          },
        },
      },
      orderBy: {
        expiresAt: 'desc',
      },
    });

    res.json({
      data: transactions,
    });
  } catch (error) {
    console.error("Get transaction history error:", error);
    res.status(500).json({
      message: "Gagal mengambil riwayat transaksi",
    });
  }
};

// Get Transaction Detail by ID
export const getTransactionById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        customerId: userId,
      },
      include: {
        event: true,
        review: true,
      },
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaksi tidak ditemukan",
      });
    }

    res.json({
      data: transaction,
    });
  } catch (error) {
    console.error("Get transaction error:", error);
    res.status(500).json({
      message: "Gagal mengambil detail transaksi",
    });
  }
};

// Upload Payment Proof
export const uploadPaymentProof = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;
    const { paymentProofUrl } = req.body;

    // Cek apakah transaksi milik user
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        customerId: userId,
        status: "WAITING_PAYMENT",
      },
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaksi tidak ditemukan atau sudah diproses",
      });
    }

    // Update status dan payment proof
    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: {
        paymentProofUrl,
        status: "WAITING_CONFIRMATION",
      },
    });

    res.json({
      message: "Bukti pembayaran berhasil diupload, menunggu konfirmasi admin",
      data: updatedTransaction,
    });
  } catch (error) {
    console.error("Upload payment proof error:", error);
    res.status(500).json({
      message: "Gagal mengupload bukti pembayaran",
    });
  }
};

// Confirm Payment (Admin/Organizer only)
export const confirmPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // "DONE" or "REJECTED"

    if (!["DONE", "REJECTED"].includes(status)) {
      return res.status(400).json({
        message: "Status harus DONE atau REJECTED",
      });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { event: true },
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaksi tidak ditemukan",
      });
    }

    if (transaction.status !== "WAITING_CONFIRMATION") {
      return res.status(400).json({
        message: "Transaksi tidak dalam status menunggu konfirmasi",
      });
    }

    // Jika ditolak, kembalikan seat
    if (status === "REJECTED") {
      await prisma.$transaction([
        prisma.transaction.update({
          where: { id },
          data: { status: "REJECTED" },
        }),
        prisma.event.update({
          where: { id: transaction.eventId },
          data: { availableSeats: { increment: 1 } },
        }),
      ]);

      return res.json({
        message: "Pembayaran ditolak, seat dikembalikan",
      });
    }

    // Jika diterima
    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: { status: "DONE" },
    });

    res.json({
      message: "Pembayaran dikonfirmasi, tiket aktif",
      data: updatedTransaction,
    });
  } catch (error) {
    console.error("Confirm payment error:", error);
    res.status(500).json({
      message: "Gagal mengkonfirmasi pembayaran",
    });
  }
};

// Cancel Transaction
export const cancelTransaction = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        customerId: userId,
        status: "WAITING_PAYMENT",
      },
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaksi tidak ditemukan atau tidak bisa dibatalkan",
      });
    }

    // Cancel dan kembalikan seat
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id },
        data: { status: "CANCELED" },
      }),
      prisma.event.update({
        where: { id: transaction.eventId },
        data: { availableSeats: { increment: 1 } },
      }),
    ]);

    res.json({
      message: "Transaksi berhasil dibatalkan",
    });
  } catch (error) {
    console.error("Cancel transaction error:", error);
    res.status(500).json({
      message: "Gagal membatalkan transaksi",
    });
  }
};