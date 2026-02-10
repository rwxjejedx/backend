import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "rahasia_eventix_2026";

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: role || "customer",
        referralCode: `EVT-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      },
    });
    res.status(201).json({ message: "Registrasi berhasil", data: { email: user.email } });
  } catch (error) {
    res.status(400).json({ message: "Email sudah terdaftar" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (user && (await bcrypt.compare(password, user.password))) {
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
      return res.json({ 
        token, 
        user: { id: user.id, email: user.email, role: user.role, avatarUrl: user.avatarUrl } 
      });
    }
    res.status(401).json({ message: "Email atau password salah" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const updatePassword = async (req: any, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: "Password lama salah" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ message: "Password berhasil diperbarui" });
  } catch (error) {
    res.status(500).json({ message: "Gagal update password" });
  }
};
// --- FUNGSI LOGOUT ---
export const logout = async (req: Request, res: Response) => {
  try {
    // Karena menggunakan JWT, logout sebenarnya cukup menghapus token di Frontend.
    // Di Backend, kita hanya memberikan respon sukses.
    res.status(200).json({ 
      message: "Logout berhasil. Silakan hapus token dari local storage." 
    });
  } catch (error) {
    res.status(500).json({ message: "Gagal memproses logout" });
  }
};