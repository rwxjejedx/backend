import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  // Koneksi Database
  DATABASE_URL: z.string().url("DATABASE_URL harus berupa URL yang valid"),
  DIRECT_URL: z.string().url("DIRECT_URL harus berupa URL yang valid"),
  
  // Konfigurasi Server
  // Kita ambil string dari .env, lalu transform ke number
  PORT: z
    .string()
    .default("3000")
    .transform((val) => parseInt(val, 10)),
    
  // Mode Aplikasi
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
    
  // Keamanan
  JWT_SECRET: z.string().min(8, "JWT_SECRET minimal harus 8 karakter"),
});

// Lakukan parsing terhadap process.env
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Variabel lingkungan (.env) tidak valid:");
  // Menampilkan pesan error yang rapi
  console.error(_env.error.format());
  process.exit(1);
}

// Export data yang sudah tervalidasi dan memiliki tipe data yang kuat
export const env = _env.data;