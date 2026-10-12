import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config();

// Configure Cloudinary as Primary CDN Storage Engine
export const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
  console.log(' Cloudinary CDN storage engine active (All images stored in Cloudinary, URLs stored in MongoDB)');
} else {
  console.warn(' WARNING: Cloudinary credentials missing in .env! Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
}

// Multer in-memory storage buffer (up to 10MB JPG/PNG/WEBP)
const storage = multer.memoryStorage();

const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

const fileFilter = (req, file, cb) => {
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only JPG, PNG, and WEBP images up to 10MB are permitted.'), false);
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max buffer
  },
  fileFilter
});

/**
 * Upload a memory Buffer, base64 data URI, or image stream directly to Cloudinary CDN
 *
 * @param {Buffer|string} fileInput - Memory buffer or data:image base64 string
 * @param {Object} options - Custom Cloudinary options (folder, publicId, etc.)
 * @returns {Promise<{ proofUrl: string, url: string, publicId: string, storageProvider: string }>}
 */
export async function uploadToCloudinary(fileInput, options = {}) {
  if (!fileInput) return null;

  if (!isCloudinaryConfigured) {
    throw new Error('Cloudinary is not configured. Images must be stored in Cloudinary and cannot be stored directly in MongoDB.');
  }

  const baseFolder = process.env.CLOUDINARY_FOLDER || 'NewForm';
  const subfolder = options.subfolder || options.folder || 'payment_screenshots';
  const fullFolder = subfolder.startsWith(baseFolder) ? subfolder : `${baseFolder}/${subfolder}`;
  
  const publicId = options.publicId
    ? `${options.publicId}`
    : `asset_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

  // 1. Buffer Upload via upload_stream
  if (Buffer.isBuffer(fileInput)) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: fullFolder,
          public_id: publicId,
          resource_type: 'image',
          overwrite: true
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary stream upload error:', error);
            return reject(new Error(`Cloudinary upload failed: ${error.message}`));
          }
          resolve({
            proofUrl: result.secure_url,
            url: result.secure_url,
            publicId: result.public_id,
            storageProvider: 'cloudinary',
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height
          });
        }
      );
      uploadStream.end(fileInput);
    });
  }

  // 2. Base64 Data URI or URL Upload via uploader.upload
  if (typeof fileInput === 'string' && (fileInput.startsWith('data:image') || fileInput.startsWith('http://') || fileInput.startsWith('https://'))) {
    try {
      const result = await cloudinary.uploader.upload(fileInput, {
        folder: fullFolder,
        public_id: publicId,
        resource_type: 'image',
        overwrite: true
      });
      return {
        proofUrl: result.secure_url,
        url: result.secure_url,
        publicId: result.public_id,
        storageProvider: 'cloudinary',
        format: result.format,
        bytes: result.bytes,
        width: result.width,
        height: result.height
      };
    } catch (err) {
      console.error('Cloudinary base64 upload error:', err);
      throw new Error(`Cloudinary upload failed: ${err.message}`);
    }
  }

  throw new Error('Unsupported image input type for Cloudinary upload.');
}

/**
 * Process and upload image proof / screenshot to Cloudinary CDN
 * Only the resulting Cloudinary HTTPS URL is stored in MongoDB.
 *
 * @param {Buffer|string} fileInput - Memory buffer or base64 string
 * @param {string} originalName - Original filename
 * @param {string} mimeType - Image mime type
 * @param {string} regId - Registration ID or unique identifier
 * @param {string} subfolder - Subfolder in Cloudinary (e.g. 'payment_screenshots', 'qr_codes')
 */
export async function processAndStoreProof(fileInput, originalName, mimeType, regId, subfolder = 'payment_screenshots') {
  if (!fileInput) {
    return { proofUrl: null, storageProvider: 'none', publicId: null };
  }

  const cleanRegKey = (regId || 'proof').toString().replace(/[^a-zA-Z0-9_-]/g, '_');
  const safePublicId = `${cleanRegKey}_${Date.now()}`;

  const cdnResult = await uploadToCloudinary(fileInput, {
    subfolder,
    publicId: safePublicId
  });

  return {
    proofUrl: cdnResult.proofUrl,
    publicId: cdnResult.publicId,
    storageProvider: 'cloudinary'
  };
}

/**
 * Automated asset deletion from Cloudinary CDN
 */
export async function deleteStoredAsset(publicId, storageProvider = 'cloudinary') {
  if (!publicId) return;
  try {
    if (isCloudinaryConfigured) {
      const res = await cloudinary.uploader.destroy(publicId);
      console.log(`Cloudinary asset destroyed [${publicId}]:`, res);
    }
  } catch (err) {
    console.warn('Cloudinary asset cleanup notice:', err.message);
  }
}
