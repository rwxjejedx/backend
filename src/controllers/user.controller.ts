import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export const getProfile = async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        role: true,
        referralCode: true,
        avatarUrl: true,
      },
    });
    res.json({ data: user });
  } catch (error) {
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