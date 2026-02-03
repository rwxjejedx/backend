import { Router } from "express";
import { prisma } from "../prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "rahasia_eventix_2026";

// Register
router.post("/register", async (req, res) => {
  const { email, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: role || "customer",
        referralCode: `EVT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
      }
    });
    res.status(201).json({ message: "User created", data: { email: user.email } });
  } catch (err) {
    res.status(400).json({ message: "Email sudah terdaftar" });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
    return res.json({ token, role: user.role });
  }
  res.status(401).json({ message: "Invalid credentials" });
});

export default router;