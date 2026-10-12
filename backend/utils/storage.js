import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Cloudinary if credentials are present
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('☁️  Cloudinary CDN storage engine active');
} else {
  console.log('📁 Cloudinary not configured; defaulting to Local Disk storage fallback (/uploads)');
}

// Multer in-memory storage buffer (up to 10MB JPG/PNG/WEBP)
const storage = multer.memoryStorage();

const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only JPG, PNG, and WEBP files up to 10MB are permitted.'), false);
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max buffer
  },
  fileFilter
});

// Local upload directory fallback (/public/uploads/payment_screenshots/)
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'payment_screenshots');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Upload memory buffer to Cloudinary CDN with automatic fallback to Local Disk (/public/uploads/payment_screenshots/)
 */
export async function processAndStoreProof(fileBuffer, originalName, mimeType, regId) {
  if (!fileBuffer) return { proofUrl: null, storageProvider: 'none', publicId: null };

  // 1. Try Cloudinary Primary CDN
  if (isCloudinaryConfigured) {
    try {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: process.env.CLOUDINARY_FOLDER || 'NewForm',
            public_id: `${regId}_proof`,
            resource_type: 'image'
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(fileBuffer);
      });

      return {
        proofUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        storageProvider: 'cloudinary'
      };
    } catch (cdnErr) {
      console.warn('⚠️ Cloudinary upload failed, falling back to local disk:', cdnErr.message);
    }
  }

  // 2. Auto-Fallback: Local Disk Storage (/public/uploads/payment_screenshots/)
  try {
    const ext = path.extname(originalName) || (mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg');
    const safeFilename = `${regId}_${Date.now()}${ext}`;
    const destinationPath = path.join(uploadsDir, safeFilename);

    await fs.promises.writeFile(destinationPath, fileBuffer);

    return {
      proofUrl: `/uploads/payment_screenshots/${safeFilename}`,
      publicId: safeFilename,
      storageProvider: 'local'
    };
  } catch (diskErr) {
    console.error('❌ Local disk write failed:', diskErr);
    return {
      proofUrl: null,
      publicId: null,
      storageProvider: 'none'
    };
  }
}

/**
 * Delete asset with automated cleanup from Cloudinary or local disk
 */
export async function deleteStoredAsset(publicId, storageProvider) {
  if (!publicId) return;
  try {
    if (storageProvider === 'cloudinary' && isCloudinaryConfigured) {
      await cloudinary.uploader.destroy(publicId);
    } else {
      const localFile = path.join(uploadsDir, publicId);
      if (fs.existsSync(localFile)) {
        await fs.promises.unlink(localFile);
      }
    }
  } catch (err) {
    console.warn('⚠️ Asset cleanup notice:', err.message);
  }
}
