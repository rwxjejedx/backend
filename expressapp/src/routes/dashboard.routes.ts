import { Router } from "express";
import { prisma } from "../prisma.js";
import { verifyToken } from "../middleware/aut.js";

const router = Router();

router.get("/summary", verifyToken, async (req: any, res) => {
  const userId = req.user.userId;
  const role = req.user.role;

  try {
    if (role === "customer") {
      // --- Dashboard untuk Customer ---
      const [transactions, points, coupons] = await Promise.all([
        prisma.transaction.count({ where: { customerId: userId } }),
        prisma.userPoint.aggregate({
          where: { userId, isUsed: false, expiredAt: { gt: new Date() } },
          _sum: { amount: true }
        }),
        prisma.userCoupon.count({
          where: { userId, isUsed: false, expiredAt: { gt: new Date() } }
        })
      ]);

      return res.json({
        role,
        summary: {
          totalTicketsBought: transactions,
          activePoints: points._sum.amount || 0,
          activeCoupons: coupons
        }
      });

    } else if (role === "organizer") {
      // --- Dashboard untuk Organizer ---
      const events = await prisma.event.findMany({
        where: { organizerId: userId },
        include: {
          _count: { select: { transactions: true } }
        }
      });

      const totalRevenue = await prisma.transaction.aggregate({
        where: {
          event: { organizerId: userId },
          status: "done"
        },
        _sum: { totalPrice: true }
      });

      return res.json({
        role,
        summary: {
          totalEventsCreated: events.length,
          totalTicketsSold: events.reduce((acc, curr) => acc + curr._count.transactions, 0),
          totalRevenue: totalRevenue._sum.totalPrice || 0,
          eventList: events.map(e => ({
            name: e.name,
            sold: e.totalSeats - e.availableSeats,
            remaining: e.availableSeats
          }))
        }
      });
    }

    res.status(400).json({ message: "Role tidak dikenali" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal memuat dashboard" });
  }
});

export default router;