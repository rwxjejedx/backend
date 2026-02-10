import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export const getProfile = async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      // Gunakan select untuk menentukan field apa saja yang dikirim (lebih aman)
      select: {
        id: true,
        email: true,
        role: true,
        referralCode: true,
        avatarUrl: true,
        // TAMBAHKAN INI agar poin muncul di ProfilePage
        points: {
          where: {
            isUsed: false,
            expiredAt: { gt: new Date() } // Hanya ambil poin yang belum expired
          }
        }
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    // Response ini akan diterima oleh Frontend sebagai response.data.data
    res.json({ data: user }); 
  } catch (error) {
    console.error("Error getProfile:", error);
    res.status(500).json({ message: "Gagal memuat profil" });
  }
};

export const updateAvatar = async (req: any, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ message: "File wajib diunggah" });

    const updated = await prisma.user.update({
      where: { id: req.user.userId },
      data: { avatarUrl: `/uploads/avatars/${req.file.filename}` },
      select: { id: true, email: true, role: true, avatarUrl: true, referralCode: true }
    });

    res.json({ message: "Avatar berhasil diperbarui", data: updated });
  } catch (error) {
    res.status(500).json({ message: "Gagal upload avatar" });
  }
};