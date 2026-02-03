import cron from "node-cron";
import { prisma } from "../prisma.js";

// Menjalankan pengecekan setiap 1 menit
export const initCronJobs = () => {
  cron.schedule("* * * * *", async () => {
    console.log("Checking for expired transactions...");

    try {
      // 1. Cari transaksi yang sudah expired
      const expiredTransactions = await prisma.transaction.findMany({
        where: {
          status: "waiting_for_payment",
          expiresAt: { lt: new Date() } // Lewat dari waktu sekarang
        }
      });

      if (expiredTransactions.length === 0) return;

      // 2. Gunakan Transaction untuk mengembalikan stok
      await prisma.$transaction(async (tx) => {
        for (const trx of expiredTransactions) {
          // Update status transaksi jadi expired
          await tx.transaction.update({
            where: { id: trx.id },
            data: { status: "expired" }
          });

          // Kembalikan stok kursi ke event terkait
          await tx.event.update({
            where: { id: trx.eventId },
            data: { availableSeats: { increment: 1 } }
          });

          console.log(`Transaction ${trx.id} expired. Seat restored to event ${trx.eventId}`);
        }
      });
    } catch (error) {
      console.error("Cron Job Error:", error);
    }
  });
};