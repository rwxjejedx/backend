// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "rahasia_eventix_2026";

export const verifyToken = (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Akses ditolak, token hilang" });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(403).json({ message: "Token tidak valid" });
  }
};

export const isOrganizer = (req: any, res: Response, next: NextFunction) => {
  if (req.user.role !== "organizer") {
    return res.status(403).json({ message: "Akses khusus Organizer!" });
  }
  next();
};

// Tambahan: middleware untuk user biasa (opsional)
export const isUser = (req: any, res: Response, next: NextFunction) => {
  if (req.user.role !== "user" && req.user.role !== "organizer") {
    return res.status(403).json({ message: "Akses ditolak!" });
  }
  next();
};

// Tambahan: middleware untuk admin (jika ada role admin)
export const isAdmin = (req: any, res: Response, next: NextFunction) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Akses khusus Admin!" });
  }
  next();
};