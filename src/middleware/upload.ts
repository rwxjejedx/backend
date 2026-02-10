import multer from "multer";
import path from "path";
import fs from "fs";

// Pastikan folder uploads ada, jika tidak ada maka buat otomatis
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // File akan disimpan di folder /uploads
  },
  filename: (req, file, cb) => {
    // Menamai file: timestamp-namaasli.ext (agar tidak ada nama file duplikat)
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

export const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // Batas 2MB
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|webp/;
    const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = fileTypes.test(file.mimetype);

    if (extName && mimeType) {
      return cb(null, true);
    } else {
      cb(new Error("Hanya diperbolehkan mengunggah gambar (jpg, png, webp)!"));
    }
  },
});