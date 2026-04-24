import multer, { StorageEngine } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

const useCloudinary =
  !!process.env.CLOUDINARY_URL ||
  !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

let storage: StorageEngine;

if (useCloudinary) {
  const { v2: cloudinary } = require('cloudinary');
  const { CloudinaryStorage } = require('multer-storage-cloudinary');

  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'gwiza-cvs',
      format: async () => 'pdf',
      public_id: (_req: Request, file: Express.Multer.File) => {
        const safeName = path.basename(file.originalname, '.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
        return `${Date.now()}-${safeName}`;
      },
      resource_type: 'raw',
      access_mode: 'public',
      type: 'upload'
      
    },
  });

  console.log('✅ Using Cloudinary for file storage');
} else {
  const uploadDir = path.join(__dirname, '..', 'uploads');

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safeName}`);
    },
  });

  console.log('⚠️  Using local disk storage (not suitable for production)');
}

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isPdfMime = file.mimetype === 'application/pdf';

  if (ext !== '.pdf' || !isPdfMime) {
    cb(new Error('Only PDF files are allowed'));
    return;
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export default upload;
