import multer from "multer";
import path from "path";
import fs from "fs";

// Folder penyimpanan khusus event
const eventDir = "uploads/events";
if (!fs.existsSync(eventDir)) {
  fs.mkdirSync(eventDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, eventDir);
  },
  filename: (req, file, cb) => {
    // Penamaan: event-timestamp-random.ext
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `event-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

export const uploadEvent = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit lebih besar (5MB) untuk banner event
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|webp/;
    const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = fileTypes.test(file.mimetype);

    if (extName && mimeType) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file gambar (jpg, png, webp) yang diperbolehkan!"));
    }
  },
});