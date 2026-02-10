// backend/src/controllers/auth.controller.ts
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "rahasia_eventix_2026";

// --- LOGIN ---
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email dan password harus diisi" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Email atau password salah" });
    }

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      message: "Login berhasil",
      token,
      user: { id: user.id, email: user.email, role: user.role, avatarUrl: user.avatarUrl, referralCode: user.referralCode }
    });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// --- REGISTER (WITH REFERRAL) ---
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, role, referralCode: inputReferralCode } = req.body;

    if (!email || !password) return res.status(400).json({ message: "Email dan password wajib diisi" });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ message: "Email sudah terdaftar" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const myNewReferralCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    let referredById = null;
    if (inputReferralCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode: inputReferralCode } });
      if (!referrer) return res.status(400).json({ message: "Kode referral tidak valid" });
      referredById = referrer.id;
    }

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          role: role || "customer",
          referralCode: myNewReferralCode,
          referredById: referredById,
        },
      });

      if (referredById) {
        await tx.userPoint.create({
          data: {
            userId: referredById,
            amount: 10000,
            isUsed: false,
            expiredAt: new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000),
          },
        });
      }
      return user;
    });

    const token = jwt.sign({ userId: newUser.id, email: newUser.email, role: newUser.role }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ message: "Registrasi berhasil", token, user: newUser });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// --- GET PROFILE ---
export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        avatarUrl: true,
        referralCode: true,
        // Penting: Include userPoints untuk kalkulasi di Frontend
        points: {
          where: {
            isUsed: false,
            expiredAt: { gt: new Date() }
          }
        }
      },
    });

    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil profile" });
  }
};

// --- UPDATE PROFILE ---
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { avatarUrl } = req.body;
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
    res.json({ message: "Profile updated", user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: "Gagal update profile" });
  }
};

// --- CHANGE PASSWORD ---
export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { oldPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    const isValidPassword = await bcrypt.compare(oldPassword, user.password);
    if (!isValidPassword) return res.status(401).json({ message: "Password lama salah" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

    res.json({ message: "Password berhasil diubah" });
  } catch (error) {
    res.status(500).json({ message: "Gagal ubah password" });
  }
};

// --- LOGOUT ---
export const logout = async (req: Request, res: Response) => {
  res.json({ message: "Logout berhasil" });
};