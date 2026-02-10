import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "rahasia_eventix_2026";

/**
 * REGISTER: Mendukung sistem Referral & Poin
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, role, referralCode: usedReferralCode } = req.body;
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await prisma.$transaction(async (tx) => {
      // 1. Buat User Baru
      const newUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          role: role || "customer",
          // Membuat referral code unik
          referralCode: `EVT-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
        },
      });

      // 2. Logika Referral
      if (usedReferralCode) {
        const referrer = await tx.user.findUnique({
          where: { referralCode: usedReferralCode }
        });

        // Pastikan referrer ditemukan dan bukan dirinya sendiri
        if (referrer && referrer.email !== email) {
          const expiryDate = new Date();
          expiryDate.setMonth(expiryDate.getMonth() + 3); // Berlaku 3 bulan

          // PERBAIKAN DI SINI: Gunakan userPoint (camelCase dari UserPoint)
          await tx.userPoint.create({
            data: {
              userId: referrer.id,
              amount: 10000,
              expiredAt: expiryDate,
              isUsed: false
            }
          });
        }
      }

      return newUser;
    });

    res.status(201).json({ 
      success: true, 
      message: "Registrasi berhasil", 
      data: { email: result.email } 
    });
  } catch (error) {
    // Tambahkan log ini agar kamu bisa melihat detail error di terminal
    console.error("EROR REGISTRASI:", error); 
    res.status(500).json({ message: "Terjadi kesalahan pada server" });
  }
};

/**
 * LOGIN: Mengembalikan Token & Identitas User
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { points: true } // Opsional: Sertakan data poin saat login
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Email atau password salah" });
    }

    // Buat JWT Token
    const token = jwt.sign(
      { userId: user.id, role: user.role }, 
      JWT_SECRET, 
      { expiresIn: "24h" }
    );

    res.json({ 
      success: true,
      message: "Login berhasil",
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        avatarUrl: user.avatarUrl,
        referralCode: user.referralCode
      } 
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * UPDATE PASSWORD: Butuh Token (Verified)
 */
export const updatePassword = async (req: any, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: "Password lama tidak sesuai" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ success: true, message: "Password berhasil diperbarui" });
  } catch (error) {
    res.status(500).json({ message: "Gagal memperbarui password" });
  }
};

/**
 * LOGOUT: Memberikan instruksi ke Frontend
 */
export const logout = async (req: Request, res: Response) => {
  res.status(200).json({ 
    success: true,
    message: "Logout berhasil" 
  });
};