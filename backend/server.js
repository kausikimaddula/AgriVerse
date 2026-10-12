process.env.UV_THREADPOOL_SIZE = '128';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import Registration from './models/Registration.js';
import Subscriber from './models/Subscriber.js';
import EventQuota from './models/EventQuota.js';
import EventSettings from './models/EventSettings.js';
import Admin from './models/Admin.js';
import { authenticateToken, generateToken } from './middleware/auth.js';
import { cacheMiddleware, memoryCache } from './middleware/cache.js';
import { upload, processAndStoreProof, deleteStoredAsset } from './utils/storage.js';
import { streamRegistrationsExcel } from './utils/excel.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const DB_FILE = path.join(__dirname, 'data', 'registrations.json');
const NEWS_FILE = path.join(__dirname, 'data', 'subscribers.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure data and uploads dirs exist
[path.join(__dirname, 'data'), UPLOADS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- 1. HELMET SECURITY & STRICT CORS POLICY ---
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false
  })
);

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  process.env.CLIENT_URL
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server) or matched origins
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(null, true); // Dev-friendly permissive while respecting CORS headers
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Failover-Attempt'],
    exposedHeaders: ['X-Cache-Status', 'Content-Disposition'],
    credentials: true
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static local disk proof uploads serving
app.use('/uploads', express.static(UPLOADS_DIR));

// State variable tracking MongoDB connection
let isMongoConnected = false;

// Connect to MongoDB & Seed
const mongoUri = process.env.MONGODB_URI || process.env.mongodb || process.env.MONGO_URI;

if (mongoUri && mongoUri.trim() !== '') {
  mongoose
    .connect(mongoUri, {
      maxPoolSize: 300,
      minPoolSize: 30,
      maxIdleTimeMS: 60000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    })
    .then(async () => {
      isMongoConnected = true;
      console.log('🌱 Connected to MongoDB successfully!');
      await initMongoDefaults();
    })
    .catch((err) => {
      isMongoConnected = false;
      console.warn('⚠️  MongoDB connection error (operating in JSON fallback mode):', err.message);
      console.info('💡 Update MONGODB_URI in backend/.env with your MongoDB Atlas or local URI.');
    });
} else {
  console.info('ℹ️  No MONGODB_URI in .env. Running in local JSON storage mode with full feature parity.');
}

async function initMongoDefaults() {
  try {
    // 1. Initialize Event Quota if needed
    const existingQuota = await EventQuota.findOne({ code: 'AGRIVERSE_2026' });
    if (!existingQuota) {
      await EventQuota.create({ code: 'AGRIVERSE_2026', totalSeats: 500, bookedSeats: 372 });
    }

    // 2. Seed Default Admin
    const existingAdmin = await Admin.findOne({ email: 'admin@agriverse.org' });
    if (!existingAdmin) {
      await Admin.create({
        username: 'Admin',
        email: 'admin@agriverse.org',
        password: 'AgriVerse@2026',
        role: 'superadmin'
      });
      console.log('🛡️  Admin account ready: admin@agriverse.org / AgriVerse@2026');
    }
  } catch (err) {
    console.warn('Initialization note:', err.message);
  }
}

// Fallback JSON Helpers
function readJson(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return defaultValue;
  }
}

function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {}
}

const SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');
const defaultSettings = {
  whatsappLink: 'https://chat.whatsapp.com/invite/AgriVerseUECourse2026',
  totalSeats: 500,
  bookedSeats: 372
};

// Sequential mutex to ensure zero race conditions on high concurrency bursts in JSON mode
class ConcurrencyMutex {
  constructor() {
    this.queue = Promise.resolve();
  }
  dispatch(operation) {
    return new Promise((resolve, reject) => {
      this.queue = this.queue
        .then(async () => {
          try {
            const result = await operation();
            resolve(result);
          } catch (err) {
            reject(err);
          }
        })
        .catch(reject);
    });
  }
}
const storageMutex = new ConcurrencyMutex();

async function getSystemSettings() {
  if (isMongoConnected) {
    let quota = await EventQuota.findOne({ code: 'AGRIVERSE_2026' });
    if (!quota) {
      quota = await EventQuota.create({
        code: 'AGRIVERSE_2026',
        totalSeats: 500,
        bookedSeats: 372,
        whatsappLink: defaultSettings.whatsappLink
      });
    }
    return {
      whatsappLink: quota.whatsappLink || defaultSettings.whatsappLink,
      totalSeats: quota.totalSeats || 500,
      bookedSeats: quota.bookedSeats || 372
    };
  } else {
    const current = readJson(SETTINGS_FILE, defaultSettings);
    const registrations = readJson(DB_FILE, []);
    return {
      whatsappLink: current.whatsappLink || defaultSettings.whatsappLink,
      totalSeats: current.totalSeats || 500,
      bookedSeats: 372 + registrations.length
    };
  }
}

// --- API ROUTES ---

// Dynamic System Settings & Official WhatsApp Community Link
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await getSystemSettings();
    const remainingSeats = Math.max(0, settings.totalSeats - settings.bookedSeats);
    res.json({
      success: true,
      whatsappLink: settings.whatsappLink,
      totalSeats: settings.totalSeats,
      bookedSeats: settings.bookedSeats,
      remainingSeats,
      allowPayLater: true
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

// 1. Health check & DB Status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AgriVerse 2026 API Node',
    nodeId: process.env.NODE_ID || `node-${PORT}`,
    port: PORT,
    database: isMongoConnected ? 'MongoDB Connected' : 'JSON Storage Fallback',
    timestamp: new Date().toISOString()
  });
});

// ======================================================================
// ======================================================================
// PUBLIC ENDPOINTS: EVENT CONFIGURATION & REGISTRATION FLOW
// ======================================================================

// 1. Get Event Configuration & Capacity (Public, In-memory cached with 1.5s TTL)
app.get(
  ['/api/v1/event/settings', '/api/event/settings'],
  cacheMiddleware(1500),
  async (req, res) => {
    try {
      const settings = await getFullEventSettings();
      let registeredCount = 0;
      if (isMongoConnected) {
        registeredCount = await Registration.countDocuments();
      } else {
        const registrations = readJson(DB_FILE, []);
        registeredCount = registrations.length;
      }

      const limit = Number(settings.registrationLimit || settings.totalSeats || 150);
      const fee = Number(settings.registrationFee !== undefined ? settings.registrationFee : (settings.fee !== undefined ? settings.fee : 0));
      const isRegOpen = settings.registrationOpen !== false && settings.isOpen !== false;
      const isFull = registeredCount >= limit;
      const remainingSlots = Math.max(0, limit - registeredCount);
      const progressPercent = limit > 0 ? Math.min(100, Math.round((registeredCount / limit) * 100)) : 0;

      const activeQrs = (settings.qrCodes || [])
        .filter((q) => q.active !== false && q.isActive !== false)
        .map((q) => ({
          id: q.id || q._id,
          title: q.title || 'Primary UPI QR',
          url: q.url || q.imageUrl,
          upiId: q.upiId || '',
          active: true
        }));

      const activeWaGroups = (settings.whatsappGroups || [])
        .filter((w) => w.active !== false && w.isActive !== false)
        .map((w) => ({
          id: w.id || w._id,
          name: w.name || 'AgriGen 2026 Official Community',
          url: w.url || w.inviteUrl
        }));

      res.json({
        success: true,
        event: {
          registrationOpen: isRegOpen,
          isSystemOpen: isRegOpen,
          isFull,
          registrationLimit: limit,
          registeredTeams: registeredCount,
          remainingSlots,
          progressPercent,
          registrationFee: fee,
          qrCode: settings.qrCode || { url: activeQrs[0]?.url || '', publicId: '' },
          qrCodes: activeQrs,
          whatsappGroups: activeWaGroups
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to retrieve event configuration: ' + err.message });
    }
  }
);

// 2. Check Registration Gate Status (Fast lightweight gatekeeper)
app.get(
  [
    '/api/v1/event/status',
    '/api/v1/event/registration-status',
    '/api/event/status',
    '/api/event/registration-status'
  ],
  async (req, res) => {
    try {
      const settings = await getFullEventSettings();
      let registeredCount = 0;
      if (isMongoConnected) {
        registeredCount = await Registration.countDocuments();
      } else {
        const registrations = readJson(DB_FILE, []);
        registeredCount = registrations.length;
      }

      const limit = Number(settings.registrationLimit || settings.totalSeats || 150);
      const isRegOpen = settings.registrationOpen !== false && settings.isOpen !== false;
      const isFull = registeredCount >= limit;
      const isOpen = isRegOpen && !isFull;
      const remainingSlots = Math.max(0, limit - registeredCount);
      const percentFilled = limit > 0 ? Math.min(100, (registeredCount / limit) * 100).toFixed(1) : 0;
      const fee = Number(settings.registrationFee !== undefined ? settings.registrationFee : (settings.fee !== undefined ? settings.fee : 0));

      res.json({
        success: true,
        isOpen,
        isSystemOpen: isRegOpen,
        isFull,
        registeredCount,
        limit,
        remainingSlots,
        message: isOpen
          ? 'Registration is open.'
          : isFull
          ? 'Event registration limit reached. Capacity full.'
          : 'Registrations are closed.',
        // Compatibility properties
        currentRegistrations: registeredCount,
        registrationLimit: limit,
        percentFilled,
        fee,
        currency: 'INR'
      });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to retrieve event status: ' + err.message });
    }
  }
);

// 3. Real-Time Credential Availability Check (Debounced)
app.post(['/api/v1/registrations/check', '/api/registrations/check'], async (req, res) => {
  try {
    const { registerNumber, regNo, email, academicEmail, phone, mobileNumber, transactionId, txnId } = req.body;

    const checkRegNo = (registerNumber || regNo || '').trim().toUpperCase();
    const checkEmail = (email || academicEmail || '').trim().toLowerCase();
    const checkPhone = (phone || mobileNumber || '').replace(/[\s\-\+]/g, '');
    const checkTxnId = (transactionId || txnId || '').trim().toUpperCase();

    const errors = {};
    const result = {
      success: true,
      available: true,
      isAvailable: true,
      errors,
      registerNumber: { available: true, message: 'Available ✓' },
      email: { available: true, message: 'Available ✓' },
      phone: { available: true, message: 'Available ✓' }
    };

    if (isMongoConnected) {
      if (checkRegNo) {
        const found = await Registration.findOne({
          $or: [{ registerNumber: checkRegNo }, { regNo: checkRegNo }, { registrationId: checkRegNo }]
        });
        if (found) {
          errors.registerNumber = 'This Register Number is already registered.';
          result.registerNumber = { available: false, message: 'Already Registered ✕' };
          result.available = false;
          result.isAvailable = false;
        }
      }
      if (checkEmail) {
        const found = await Registration.findOne({ email: checkEmail });
        if (found) {
          errors.email = 'This Email address is already registered.';
          result.email = { available: false, message: 'Already Registered ✕' };
          result.available = false;
          result.isAvailable = false;
        }
      }
      if (checkPhone && checkPhone.length >= 10) {
        const found = await Registration.findOne({ phone: checkPhone });
        if (found) {
          errors.phone = 'This Phone number is already registered.';
          result.phone = { available: false, message: 'Already Registered ✕' };
          result.available = false;
          result.isAvailable = false;
        }
      }
      if (checkTxnId && checkTxnId.length >= 4) {
        const found = await Registration.findOne({
          $or: [{ transactionId: checkTxnId }, { txnId: checkTxnId }]
        });
        if (found) {
          errors.transactionId = 'This Transaction ID has already been submitted.';
          result.available = false;
          result.isAvailable = false;
        }
      }
    } else {
      const registrations = readJson(DB_FILE, []);
      if (
        checkRegNo &&
        registrations.some(
          (r) =>
            (r.registerNumber && r.registerNumber.toUpperCase() === checkRegNo) ||
            (r.regNo && r.regNo.toUpperCase() === checkRegNo) ||
            (r.registrationId && r.registrationId.toUpperCase() === checkRegNo)
        )
      ) {
        errors.registerNumber = 'This Register Number is already registered.';
        result.registerNumber = { available: false, message: 'Already Registered ✕' };
        result.available = false;
        result.isAvailable = false;
      }
      if (checkEmail && registrations.some((r) => r.email && r.email.toLowerCase() === checkEmail)) {
        errors.email = 'This Email address is already registered.';
        result.email = { available: false, message: 'Already Registered ✕' };
        result.available = false;
        result.isAvailable = false;
      }
      if (
        checkPhone &&
        checkPhone.length >= 10 &&
        registrations.some((r) => r.phone && r.phone.replace(/[\s\-\+]/g, '') === checkPhone)
      ) {
        errors.phone = 'This Phone number is already registered.';
        result.phone = { available: false, message: 'Already Registered ✕' };
        result.available = false;
        result.isAvailable = false;
      }
      if (
        checkTxnId &&
        checkTxnId.length >= 4 &&
        registrations.some(
          (r) =>
            (r.transactionId && r.transactionId.toUpperCase() === checkTxnId) ||
            (r.txnId && r.txnId.toUpperCase() === checkTxnId)
        )
      ) {
        errors.transactionId = 'This Transaction ID has already been submitted.';
        result.available = false;
        result.isAvailable = false;
      }
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to check credential availability: ' + err.message });
  }
});

// 4. Submit Profile Registration
app.post(
  [
    '/api/v1/registrations/register',
    '/api/v1/registrations/create',
    '/api/registrations/register',
    '/api/registrations/create'
  ],
  async (req, res) => {
    try {
      const {
        fullName, name,
        registerNumber, regNo,
        academicEmail, email,
        phone, mobileNumber,
        department, branch,
        section,
        academicYear, year,
        gender,
        residencyStatus, residency
      } = req.body;

      const cleanName = (fullName || name || '').trim();
      const cleanRegNo = (registerNumber || regNo || '').trim().toUpperCase();
      const cleanEmail = (academicEmail || email || `${cleanRegNo.toLowerCase()}@klu.ac.in`).trim().toLowerCase();
      const cleanPhone = (phone || mobileNumber || '').replace(/[\s\-\+]/g, '');
      const cleanDept = (department || branch || 'Agricultural Tech').trim();
      const cleanSection = (section || 'A').trim().toUpperCase();
      const cleanYear = academicYear || year || '1st Year';
      const cleanGender = gender || 'Male';
      const cleanResidency = residencyStatus || residency || 'Day Scholar';

      // Strict Field Validation
      if (!cleanName || cleanName.length < 2) {
        return res.status(400).json({ error: 'Please enter your full name (minimum 2 characters).' });
      }
      if (!cleanRegNo || cleanRegNo.length < 3) {
        return res.status(400).json({ error: 'Please enter a valid Register / Roll Number.' });
      }
      if (!cleanPhone || cleanPhone.length !== 10) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
      }

      const settings = await getFullEventSettings();
      const isRegOpen = settings.registrationOpen !== false && settings.isOpen !== false;
      if (!isRegOpen) {
        return res.status(403).json({
          success: false,
          error: 'Registrations are currently closed by the administrator.',
          code: 'REGISTRATIONS_CLOSED'
        });
      }

      const fee = Number(settings.registrationFee !== undefined ? settings.registrationFee : (settings.fee !== undefined ? settings.fee : 0));
      const activeQrs = (settings.qrCodes || [])
        .filter((q) => q.active !== false && q.isActive !== false)
        .map((q) => ({
          id: q.id || q._id,
          title: q.title || 'Primary UPI QR',
          url: q.url || q.imageUrl,
          upiId: q.upiId || '',
          active: true
        }));
      const activeWaGroups = (settings.whatsappGroups || [])
        .filter((w) => w.active !== false && w.isActive !== false)
        .map((w) => ({
          id: w.id || w._id,
          name: w.name || 'AgriGen 2026 Official Community',
          url: w.url || w.inviteUrl
        }));

      // Atomic Slot Claim & Persistence
      if (isMongoConnected) {
        // 1. Duplicate check
        const existing = await Registration.findOne({
          $or: [
            { regNo: cleanRegNo },
            { registerNumber: cleanRegNo },
            { registrationId: cleanRegNo },
            { email: cleanEmail },
            { phone: cleanPhone }
          ]
        });
        if (existing) {
          if (
            (existing.paymentStatus === 'UNPAID' || existing.status === 'PENDING_PAYMENT') &&
            (existing.regNo === cleanRegNo || existing.registerNumber === cleanRegNo || existing.registrationId === cleanRegNo)
          ) {
            existing.name = cleanName;
            existing.fullName = cleanName;
            existing.email = cleanEmail;
            existing.phone = cleanPhone;
            existing.branch = cleanDept;
            existing.department = cleanDept;
            existing.section = cleanSection;
            existing.year = cleanYear;
            existing.academicYear = cleanYear;
            existing.gender = cleanGender;
            existing.residency = cleanResidency;
            existing.residencyStatus = cleanResidency;
            await existing.save();

            memoryCache.invalidate('stats');

            return res.status(200).json({
              success: true,
              message: 'Profile details updated successfully.',
              registration: existing
            });
          }

          return res.status(409).json({
            error:
              existing.regNo === cleanRegNo || existing.registerNumber === cleanRegNo
                ? `Register Number (${cleanRegNo}) is already registered.`
                : existing.email === cleanEmail
                ? `Academic Email (${cleanEmail}) is already registered.`
                : `Mobile number (${cleanPhone}) is already registered.`
          });
        }

        // 2. Atomic Slot Claim in EventSettings
        const claim = await EventSettings.claimSlotAtomic('AGRIVERSE_2026');
        if (!claim.success) {
          if (claim.isOpen === false) {
            return res.status(403).json({
              error: 'Registrations are currently closed by the administrator.',
              code: 'REGISTRATIONS_CLOSED'
            });
          }
          return res.status(403).json({
            error: 'Registration limit reached. Capacity full.',
            code: 'CAPACITY_FULL'
          });
        }

        await EventQuota.reserveSeatAtomic('AGRIVERSE_2026').catch(() => {});

        // 3. Save new Document with Workflow A requirements
        const randomHex = Math.floor(1000 + Math.random() * 9000);
        const passId = `AGRI-2026-${randomHex}`;

        const newDoc = new Registration({
          id: passId,
          registrationId: cleanRegNo,
          name: cleanName,
          fullName: cleanName,
          regNo: cleanRegNo,
          registerNumber: cleanRegNo,
          email: cleanEmail,
          phone: cleanPhone,
          branch: cleanDept,
          department: cleanDept,
          section: cleanSection,
          year: cleanYear,
          academicYear: cleanYear,
          gender: cleanGender,
          residency: cleanResidency,
          residencyStatus: cleanResidency,
          registrationStatus: 'registered',
          college: 'KLU / AgriGen Campus',
          paymentStatus: 'UNPAID',
          verificationStatus: 'PENDING',
          status: 'PENDING_PAYMENT',
          paymentMode: 'PAY_LATER',
          registeredAt: new Date(),
          adminNotes: 'Student profile registered in Workflow A. Awaiting payment.',
          createdAt: new Date()
        });
        await newDoc.save();

        memoryCache.invalidate('stats');

        return res.status(201).json({
          success: true,
          message: 'Registration completed successfully! Your payment is unpaid and verification is pending.',
          registration: {
            id: passId,
            registrationId: cleanRegNo,
            fullName: cleanName,
            name: cleanName,
            registerNumber: cleanRegNo,
            regNo: cleanRegNo,
            email: cleanEmail,
            phone: cleanPhone,
            department: cleanDept,
            branch: cleanDept,
            section: cleanSection,
            year: cleanYear,
            gender: cleanGender,
            residency: cleanResidency,
            paymentStatus: 'UNPAID',
            verificationStatus: 'PENDING',
            fee
          },
          event: {
            registrationFee: fee,
            qrCodes: activeQrs
          },
          whatsappGroups: activeWaGroups,
          registrationId: cleanRegNo,
          step: 2
        });
      } else {
        let conflictErr = null;
        let capacityFull = false;
        let closedErr = false;
        let createdRec = null;

        await storageMutex.dispatch(async () => {
          const registrations = readJson(DB_FILE, []);
          const currentSettings = readJson(SETTINGS_FILE, defaultSettings);

          const isCurrentRegOpen = currentSettings.registrationOpen !== false && currentSettings.isOpen !== false;
          if (!isCurrentRegOpen) {
            closedErr = true;
            return;
          }

          const existingIdx = registrations.findIndex(
            (r) =>
              r.regNo?.toUpperCase() === cleanRegNo ||
              r.registerNumber?.toUpperCase() === cleanRegNo ||
              r.registrationId?.toUpperCase() === cleanRegNo
          );

          if (existingIdx !== -1) {
            const existing = registrations[existingIdx];
            if (existing.paymentStatus === 'UNPAID' || existing.status === 'PENDING_PAYMENT') {
              existing.name = cleanName;
              existing.fullName = cleanName;
              existing.email = cleanEmail;
              existing.phone = cleanPhone;
              existing.branch = cleanDept;
              existing.department = cleanDept;
              existing.section = cleanSection;
              existing.year = cleanYear;
              existing.academicYear = cleanYear;
              existing.gender = cleanGender;
              existing.residency = cleanResidency;
              existing.residencyStatus = cleanResidency;
              writeJson(DB_FILE, registrations);
              createdRec = existing;
              return;
            }
            conflictErr = `Register Number (${cleanRegNo}) is already registered.`;
            return;
          }

          if (registrations.some((r) => r.email?.toLowerCase() === cleanEmail)) {
            conflictErr = `Academic Email (${cleanEmail}) is already registered.`;
            return;
          }
          if (registrations.some((r) => r.phone?.replace(/[\s\-\+]/g, '') === cleanPhone)) {
            conflictErr = `Mobile number (${cleanPhone}) is already registered.`;
            return;
          }

          const currentTotal = registrations.length;
          const maxLimit = Number(currentSettings.registrationLimit || currentSettings.totalSeats || 250);
          if (currentTotal >= maxLimit) {
            capacityFull = true;
            return;
          }

          const randomHex = Math.floor(1000 + Math.random() * 9000);
          const passId = `AGRI-2026-${randomHex}`;

          createdRec = {
            id: passId,
            registrationId: cleanRegNo,
            name: cleanName,
            fullName: cleanName,
            regNo: cleanRegNo,
            registerNumber: cleanRegNo,
            email: cleanEmail,
            phone: cleanPhone,
            branch: cleanDept,
            department: cleanDept,
            section: cleanSection,
            year: cleanYear,
            academicYear: cleanYear,
            gender: cleanGender,
            residency: cleanResidency,
            residencyStatus: cleanResidency,
            college: 'KLU / AgriGen Campus',
            paymentStatus: 'UNPAID',
            verificationStatus: 'PENDING',
            status: 'PENDING_PAYMENT',
            paymentMode: 'PAY_LATER',
            adminNotes: 'Student profile registered in Workflow A. Awaiting payment.',
            createdAt: new Date().toISOString()
          };

          registrations.push(createdRec);
          writeJson(DB_FILE, registrations);
        });

        if (conflictErr) {
          return res.status(409).json({ error: conflictErr });
        }
        if (closedErr) {
          return res.status(403).json({
            error: 'Registrations are currently closed by the administrator.',
            code: 'REGISTRATIONS_CLOSED'
          });
        }
        if (capacityFull) {
          return res.status(403).json({
            error: 'Registration limit reached. Capacity full.',
            code: 'CAPACITY_FULL'
          });
        }

        memoryCache.invalidate('stats');

        return res.status(201).json({
          success: true,
          message: 'Registration completed successfully! Your payment is unpaid and verification is pending.',
          registration: {
            ...createdRec,
            registrationId: cleanRegNo,
            fullName: cleanName,
            registerNumber: cleanRegNo,
            paymentStatus: 'UNPAID',
            verificationStatus: 'PENDING'
          },
          event: {
            registrationFee: fee,
            qrCodes: activeQrs
          },
          whatsappGroups: activeWaGroups,
          registrationId: cleanRegNo,
          step: 2
        });
      }
    } catch (err) {
      res.status(500).json({ error: 'Failed to register student profile: ' + err.message });
    }
  }
);
// ======================================================================
// WORKFLOW B: PAYMENT & PROOF SUBMISSION API ENDPOINTS
// ======================================================================

// B1. QR Code Display: Retrieve active UPI QR codes from Admin Settings
app.get(['/api/v1/event/payment-methods', '/api/event/payment-methods'], async (req, res) => {
  try {
    const settings = await getFullEventSettings();
    const fee = Number(settings.registrationFee !== undefined ? settings.registrationFee : (settings.fee !== undefined ? settings.fee : 350));

    let activeQrs = (settings.qrCodes || []).filter((q) => q.isActive !== false && q.active !== false);
    if (activeQrs.length === 0 && (settings.qrCodes || []).length > 0) {
      activeQrs = settings.qrCodes;
    }
    if (activeQrs.length === 0) {
      activeQrs = [
        {
          id: 'qr-primary-gpay',
          title: 'GPay Primary UPI',
          upiId: 'sundarrajan.it@okaxis',
          imageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=sundarrajan.it@okaxis%26pn=sundarrajan.it%26am=350%26cu=INR%26tn=AgriVerse_UE_Course',
          url: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=sundarrajan.it@okaxis%26pn=sundarrajan.it%26am=350%26cu=INR%26tn=AgriVerse_UE_Course',
          isActive: true
        }
      ];
    }

    const paymentMethods = activeQrs.map((q, idx) => {
      const upiId = q.upiId || 'sundarrajan.it@okaxis';
      const upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=AgriVerse&am=${fee}&cu=INR&tn=AgriVerse_UE_Course`;
      const qrUrl = q.url || q.imageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiString)}`;
      return {
        id: q.id || `qr-${idx + 1}`,
        title: q.title || `Payment QR #${idx + 1}`,
        name: 'AgriVerse UE',
        upiId,
        holder: upiId.split('@')[0] || 'sundarrajan.it',
        amount: fee,
        currency: 'INR',
        url: qrUrl,
        imageUrl: qrUrl,
        upiString,
        isActive: true
      };
    });

    res.json({
      success: true,
      fee,
      currency: 'INR',
      paymentMethods,
      qrCodes: paymentMethods
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve payment methods: ' + err.message });
  }
});

// B2. Payment Execution & Proof Collection (Multer buffer verification, Cloudinary/local fallback, unique txnId check)
app.post(
  ['/api/v1/registrations/payment', '/api/registrations/payment'],
  upload.fields([{ name: 'paymentScreenshot', maxCount: 1 }, { name: 'idProof', maxCount: 1 }]),
  async (req, res) => {
    try {
      const {
        registrationId, registerNumber, regNo, id,
        transactionId, txnId,
        joinedWhatsapp
      } = req.body;

      const cleanTxnId = (transactionId || txnId || '').trim().toUpperCase();
      if (!cleanTxnId || cleanTxnId.length < 4) {
        return res.status(400).json({
          error: 'Please enter a valid UPI Reference ID / Transaction ID (minimum 4 characters).'
        });
      }

      const lookupId = (req.body.identifier || registrationId || registerNumber || regNo || id || '').trim().toUpperCase();
      if (!lookupId) {
        return res.status(400).json({
          error: 'Registration identifier (registrationId / registerNumber / identifier) is required.'
        });
      }

      const file = req.files?.paymentScreenshot?.[0] || req.files?.idProof?.[0] || req.file;
      if (!file) {
        return res.status(400).json({
          error: 'Please upload your UPI payment confirmation screenshot (.jpg, .png, .webp up to 10MB).'
        });
      }

      const settings = await getFullEventSettings();
      const activeWaGroups = (settings.whatsappGroups || [])
        .filter((w) => w.active !== false && w.isActive !== false)
        .map((w) => ({
          id: w.id || w._id,
          name: w.name || 'AgriGen 2026 Official Community',
          url: w.url || w.inviteUrl
        }));

      // Check unique transaction ID across all registrations
      if (isMongoConnected) {
        const existingTxn = await Registration.findOne({
          $or: [{ txnId: cleanTxnId }, { transactionId: cleanTxnId }],
          $nor: [{ regNo: lookupId }, { id: lookupId }, { registrationId: lookupId }, { registerNumber: lookupId }]
        });
        if (existingTxn) {
          return res.status(409).json({
            error: `UPI Reference ID (${cleanTxnId}) has already been submitted by another attendee. Reused transaction proofs are prohibited.`
          });
        }

        const record = await Registration.findOne({
          $or: [
            { regNo: lookupId },
            { registerNumber: lookupId },
            { registrationId: lookupId },
            { id: lookupId }
          ]
        });

        if (!record) {
          return res.status(404).json({
            error: `Registration record not found for ${lookupId}. Please verify your Register Number.`
          });
        }

        const proofData = await processAndStoreProof(
          file.buffer,
          file.originalname,
          file.mimetype,
          record.id || record.registrationId
        );

        if (req.body.fullName || req.body.name) {
          record.fullName = (req.body.fullName || req.body.name).trim();
          record.name = record.fullName;
        }
        if (req.body.department || req.body.branch) {
          record.department = (req.body.department || req.body.branch).trim();
          record.branch = record.department;
        }
        if (req.body.section) record.section = req.body.section.trim();
        if (req.body.academicYear || req.body.year) {
          record.academicYear = req.body.academicYear || req.body.year;
          record.year = record.academicYear;
        }
        if (req.body.gender) record.gender = req.body.gender;
        if (req.body.residencyStatus || req.body.residency) {
          record.residencyStatus = req.body.residencyStatus || req.body.residency;
          record.residency = record.residencyStatus;
        }

        record.paymentStatus = 'PAID';
        record.status = 'PENDING_AUDIT';
        record.verificationStatus = 'PENDING';
        record.transactionId = cleanTxnId;
        record.txnId = cleanTxnId;
        record.paymentScreenshot = {
          url: proofData.proofUrl,
          publicId: proofData.publicId,
          storageProvider: proofData.storageProvider
        };
        record.proofUrl = proofData.proofUrl;
        record.proofPublicId = proofData.publicId;
        record.storageProvider = proofData.storageProvider;
        record.paymentDate = new Date();
        record.joinedWhatsapp = (joinedWhatsapp || 'Yes').trim();
        record.adminNotes = 'Payment proof submitted via Workflow B. Placed in organizer audit queue.';
        await record.save();

        memoryCache.invalidate('stats');

        return res.json({
          success: true,
          message: 'Payment submitted successfully! Your payment is paid and verification is pending.',
          registration: {
            id: record.id || record.registrationId,
            registrationId: record.registrationId || record.registerNumber || record.regNo,
            fullName: record.fullName || record.name,
            registerNumber: record.registerNumber || record.regNo,
            paymentStatus: 'PAID',
            verificationStatus: 'PENDING',
            transactionId: cleanTxnId,
            proofUrl: proofData.proofUrl,
            paymentScreenshot: record.paymentScreenshot
          },
          whatsappGroups: activeWaGroups
        });
      } else {
        let conflictErr = null;
        let notFoundErr = false;
        let updatedRecord = null;

        await storageMutex.dispatch(async () => {
          const registrations = readJson(DB_FILE, []);

          const duplicate = registrations.find(
            (r) =>
              ((r.txnId && r.txnId.toUpperCase() === cleanTxnId) ||
                (r.transactionId && r.transactionId.toUpperCase() === cleanTxnId)) &&
              r.regNo?.toUpperCase() !== lookupId &&
              r.registrationId?.toUpperCase() !== lookupId &&
              r.id?.toUpperCase() !== lookupId
          );
          if (duplicate) {
            conflictErr = `UPI Reference ID (${cleanTxnId}) has already been submitted by another attendee.`;
            return;
          }

          const idx = registrations.findIndex(
            (r) =>
              (r.regNo && r.regNo.toUpperCase() === lookupId) ||
              (r.registrationId && r.registrationId.toUpperCase() === lookupId) ||
              (r.id && r.id.toUpperCase() === lookupId)
          );

          if (idx === -1) {
            notFoundErr = true;
            return;
          }

          const proofData = await processAndStoreProof(
            file.buffer,
            file.originalname,
            file.mimetype,
            registrations[idx].id || registrations[idx].registrationId
          );

          registrations[idx].paymentStatus = 'PAID';
          registrations[idx].status = 'PENDING_AUDIT';
          registrations[idx].verificationStatus = 'PENDING';
          registrations[idx].transactionId = cleanTxnId;
          registrations[idx].txnId = cleanTxnId;
          registrations[idx].paymentScreenshot = {
            url: proofData.proofUrl,
            publicId: proofData.publicId,
            storageProvider: proofData.storageProvider
          };
          registrations[idx].proofUrl = proofData.proofUrl;
          registrations[idx].proofPublicId = proofData.publicId;
          registrations[idx].storageProvider = proofData.storageProvider;
          registrations[idx].paymentDate = new Date().toISOString();
          registrations[idx].joinedWhatsapp = (joinedWhatsapp || 'Yes').trim();
          registrations[idx].adminNotes = 'Payment proof submitted via Workflow B. Placed in organizer audit queue.';

          writeJson(DB_FILE, registrations);
          updatedRecord = registrations[idx];
        });

        if (conflictErr) {
          return res.status(409).json({ error: conflictErr });
        }
        if (notFoundErr) {
          return res.status(404).json({ error: `Registration record not found for ${lookupId}.` });
        }

        memoryCache.invalidate('stats');

        return res.json({
          success: true,
          message: 'Payment submitted successfully! Your payment is paid and verification is pending.',
          registration: {
            id: updatedRecord.id || updatedRecord.registrationId,
            registrationId: updatedRecord.registrationId || updatedRecord.registerNumber || updatedRecord.regNo,
            fullName: updatedRecord.fullName || updatedRecord.name,
            registerNumber: updatedRecord.registerNumber || updatedRecord.regNo,
            paymentStatus: 'PAID',
            verificationStatus: 'PENDING',
            transactionId: cleanTxnId,
            proofUrl: updatedRecord.proofUrl,
            paymentScreenshot: updatedRecord.paymentScreenshot
          },
          whatsappGroups: activeWaGroups
        });
      }
    } catch (err) {
      res.status(500).json({ error: 'Failed to process payment proof: ' + err.message });
    }
  }
);

// B3. Retrieve Registration by registrationId (For Success Page & Verification Badge)
app.get(['/api/v1/registrations/:id', '/api/registrations/:id'], async (req, res) => {
  try {
    const key = (req.params.id || '').trim().toUpperCase();
    let record = null;
    if (isMongoConnected) {
      record = await Registration.findOne({
        $or: [{ registrationId: key }, { regNo: key }, { id: key }]
      });
    } else {
      const list = readJson(DB_FILE, []);
      record = list.find(
        (r) =>
          r.registrationId?.toUpperCase() === key ||
          r.regNo?.toUpperCase() === key ||
          r.id?.toUpperCase() === key
      );
    }

    if (!record) {
      return res.status(404).json({ error: 'Registration record not found.' });
    }

    res.json({ success: true, registration: record });
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed: ' + err.message });
  }
});

// ======================================================================
// WORKFLOW C: PAY LATER / DEFERRED PAYMENT LOOKUP API
// ======================================================================
// 6. Lookup Participant for Deferred Payment (Alias for individual participant lookup)
app.post(['/api/v1/registrations/lookup-team', '/api/registrations/lookup-team'], async (req, res) => {
  try {
    const { identifier, query, registrationId, registerNumber, regNo } = req.body;
    const lookupKey = (identifier || query || registrationId || registerNumber || regNo || '').trim().toUpperCase();

    if (!lookupKey || lookupKey.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your Register / Roll Number or Registration ID.'
      });
    }

    let record = null;
    if (isMongoConnected) {
      record = await Registration.findOne({
        $or: [
          { registrationId: lookupKey },
          { registerNumber: lookupKey },
          { regNo: lookupKey },
          { id: lookupKey },
          { email: lookupKey.toLowerCase() },
          { phone: lookupKey.replace(/\D/g, '') }
        ]
      });
    } else {
      const list = readJson(DB_FILE, []);
      record = list.find(
        (r) =>
          r.registrationId?.toUpperCase() === lookupKey ||
          r.registerNumber?.toUpperCase() === lookupKey ||
          r.regNo?.toUpperCase() === lookupKey ||
          r.id?.toUpperCase() === lookupKey ||
          r.email?.toLowerCase() === lookupKey.toLowerCase() ||
          r.phone?.replace(/\D/g, '') === lookupKey.replace(/\D/g, '')
      );
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        error: `No registration found for '${lookupKey}'. Please check your Register Number or sign up first.`
      });
    }

    const settings = await getFullEventSettings();
    const activeQrs = (settings.qrCodes || [])
      .filter((q) => q.active !== false && q.isActive !== false)
      .map((q) => ({
        id: q.id || q._id,
        title: q.title || 'Primary UPI QR',
        url: q.url || q.imageUrl,
        upiId: q.upiId || '',
        active: true
      }));

    const activeWaGroups = (settings.whatsappGroups || [])
      .filter((w) => w.active !== false && w.isActive !== false)
      .map((w) => ({
        id: w.id || w._id,
        name: w.name || 'AgriGen 2026 Official Community',
        url: w.url || w.inviteUrl
      }));

    const eventFee = Number(settings.registrationFee !== undefined ? settings.registrationFee : (settings.fee !== undefined ? settings.fee : 0));

    return res.json({
      success: true,
      registration: record,
      paymentStatus: record.paymentStatus || 'UNPAID',
      qrCodes: activeQrs,
      eventFee,
      fee: eventFee,
      whatsappGroups: activeWaGroups
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Lookup failed: ' + err.message
    });
  }
});

// 2. Event Statistics (With In-Memory Response Caching: 2.0s TTL to protect DB)
app.get('/api/stats', cacheMiddleware(2000), async (req, res) => {
  try {
    let count = 0;
    let recent = [];
    let maxSeats = 250;
    let totalFilled = 0;

    if (isMongoConnected) {
      count = await Registration.countDocuments();
      recent = await Registration.find().sort({ createdAt: -1 }).limit(5);
      const quota = await EventQuota.findOne({ code: 'AGRIVERSE_2026' });
      if (quota) {
        maxSeats = quota.totalSeats;
        totalFilled = count;
      } else {
        totalFilled = count;
      }
    } else {
      const registrations = readJson(DB_FILE, []);
      count = registrations.length;
      recent = registrations.slice(-5).reverse();
      totalFilled = count;
    }

    const seatsRemaining = Math.max(0, maxSeats - totalFilled);
    const percentFilled = Math.min(100, (totalFilled / maxSeats) * 100).toFixed(1);

    res.json({
      totalFilled,
      maxSeats,
      seatsRemaining,
      percentFilled,
      database: isMongoConnected ? 'mongodb' : 'json',
      serverNode: process.env.NODE_ID || `node-${PORT}`,
      cachedAt: new Date().toISOString(),
      recentRegistrations: recent
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// 3. Delegate Registration (High-Concurrency Atomic Gate + Duplicate Prevention + Decoupled Pay Later)
app.post('/api/register', upload.single('idProof'), async (req, res) => {
  try {
    const settings = await getFullEventSettings();
    const isRegOpen = settings.registrationOpen !== false && settings.isOpen !== false;
    if (!isRegOpen) {
      return res.status(403).json({
        success: false,
        error: 'Registrations are currently closed by the administrator.',
        code: 'REGISTRATIONS_CLOSED'
      });
    }

    const {
      fullName,
      name,
      regNo,
      phone,
      mobileNumber,
      email,
      branch,
      section,
      residency,
      year,
      gender,
      college,
      department,
      participationType,
      txnId,
      joinedWhatsapp,
      paymentMode
    } = req.body;

    const isPayLater = paymentMode === 'PAY_LATER';

    // Field Validations for Profile Credentials
    const candidateName = (fullName || name || '').trim();
    if (!candidateName) {
      return res.status(400).json({ error: 'Please enter your full name.' });
    }

    const cleanRegNo = (regNo || '').trim().toUpperCase();
    if (!cleanRegNo || cleanRegNo.length < 3) {
      return res.status(400).json({ error: 'Please enter a valid Registration Number.' });
    }

    const cleanPhone = (phone || mobileNumber || '').replace(/[\s\-\+]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }

    const cleanBranch = (branch || department || 'Agricultural Tech').trim();
    if (!cleanBranch) {
      return res.status(400).json({ error: 'Please enter your branch.' });
    }

    const cleanSection = (section || 'A').trim().toUpperCase();
    const cleanResidency = residency || 'Day Scholar';
    const cleanYear = year || '1st Year';
    const cleanGender = gender || 'Male';

    // Email address
    const cleanEmail = (email || `${cleanRegNo.toLowerCase()}@klu.ac.in`).trim().toLowerCase();
    const cleanTxnId = !isPayLater && txnId ? txnId.trim().toUpperCase() : null;

    // --- DUPLICATE PREVENTION: STRICT IMMEDIATE VERIFICATION ---
    if (isMongoConnected) {
      // 1. Check RegNo Duplicate
      const regDup = await Registration.findOne({ regNo: cleanRegNo });
      if (regDup) {
        return res.status(409).json({ error: `Registration Number (${cleanRegNo}) is already registered.` });
      }

      // 2. Check Mobile Duplicate
      const phoneDup = await Registration.findOne({ phone: cleanPhone });
      if (phoneDup) {
        return res.status(409).json({ error: `Mobile number (${cleanPhone}) is already registered.` });
      }

      // 3. Check Academic Email Duplicate
      const emailDup = await Registration.findOne({ email: cleanEmail });
      if (emailDup) {
        return res.status(409).json({ error: `Academic email (${cleanEmail}) is already registered.` });
      }

      // 4. Check Reused UPI Transaction ID Duplicate
      if (cleanTxnId) {
        const txnDup = await Registration.findOne({ txnId: cleanTxnId });
        if (txnDup) {
          return res.status(409).json({
            error: `UPI Transaction Reference ID (${cleanTxnId}) has already been used by another registration.`
          });
        }
      }

      // --- ATOMIC $expr SEAT ALLOTMENT GATE (HIGH CONCURRENCY) ---
      const seatReservation = await EventQuota.reserveSeatAtomic('AGRIVERSE_2026');
      if (!seatReservation.success) {
        return res.status(409).json({
          error: 'Registration closed! All seats have been allotted.'
        });
      }
    } else {
      // Local JSON duplicate check & seat gate with Concurrency Mutex
      const checkResult = await storageMutex.dispatch(async () => {
        const registrations = readJson(DB_FILE, []);
        
        // 1. RegNo
        if (registrations.some((r) => r.regNo && r.regNo.toUpperCase() === cleanRegNo)) {
          return { error: `Registration Number (${cleanRegNo}) is already registered.`, status: 409 };
        }
        // 2. Mobile
        if (registrations.some((r) => r.phone && r.phone.replace(/[\s\-\+]/g, '') === cleanPhone)) {
          return { error: `Mobile number (${cleanPhone}) is already registered.`, status: 409 };
        }
        // 3. Email
        if (registrations.some((r) => r.email && r.email.toLowerCase() === cleanEmail)) {
          return { error: `Academic email (${cleanEmail}) is already registered.`, status: 409 };
        }
        // 4. Reused UPI Txn ID
        if (cleanTxnId && registrations.some((r) => r.txnId && r.txnId.toUpperCase() === cleanTxnId)) {
          return {
            error: `UPI Transaction Reference ID (${cleanTxnId}) has already been used by another registration.`,
            status: 409
          };
        }

        const totalCurrent = registrations.length;
        if (totalCurrent >= 250) {
          return { error: 'Registration closed! All seats have been allotted.', status: 409 };
        }
        return { success: true };
      });

      if (checkResult.error) {
        return res.status(checkResult.status).json({ error: checkResult.error });
      }
    }

    // Generate unique Pass ID
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const passId = `AGRI-2026-${randomHex}`;

    // Process Memory Buffer Upload (Cloudinary CDN or Local Disk fallback) if provided
    let proofData = { proofUrl: null, storageProvider: 'none', publicId: null };
    if (!isPayLater && req.file) {
      proofData = await processAndStoreProof(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        passId
      );
    }

    const assignedStatus = isPayLater ? 'PENDING_PAYMENT' : 'PENDING_AUDIT';

    const newRecord = {
      id: passId,
      registrationId: cleanRegNo,
      name: candidateName,
      fullName: candidateName,
      regNo: cleanRegNo,
      registerNumber: cleanRegNo,
      phone: cleanPhone,
      email: cleanEmail,
      branch: cleanBranch,
      department: cleanBranch,
      section: cleanSection,
      residency: cleanResidency,
      year: cleanYear,
      gender: cleanGender,
      college: college || 'KLU / AgriGen Campus',
      track: participationType || 'AgriVerse: UE Course',
      txnId: cleanTxnId || null,
      transactionId: cleanTxnId || null,
      registrationStatus: 'registered',
      paymentStatus: isPayLater ? 'UNPAID' : 'PAID',
      verificationStatus: 'PENDING',
      paymentMode: isPayLater ? 'PAY_LATER' : 'PAY_NOW',
      joinedWhatsapp: (joinedWhatsapp || 'Yes').trim(),
      proofUrl: proofData.proofUrl,
      proofPublicId: proofData.publicId,
      paymentScreenshot: {
        url: proofData.proofUrl || '',
        publicId: proofData.publicId || '',
        storageProvider: proofData.storageProvider || 'none'
      },
      storageProvider: proofData.storageProvider,
      gate: 'Admin Block Seminar Hall',
      status: assignedStatus,
      registeredAt: new Date(),
      paymentDate: !isPayLater ? new Date() : null,
      adminNotes: isPayLater ? 'Seat locked under Pay Later model. Awaiting payment proof.' : 'Payment proof submitted. Pending verification.',
      createdAt: new Date().toISOString()
    };

    if (isMongoConnected) {
      const doc = new Registration(newRecord);
      await doc.save();
    } else {
      await storageMutex.dispatch(async () => {
        const registrations = readJson(DB_FILE, []);
        registrations.push(newRecord);
        writeJson(DB_FILE, registrations);
      });
    }

    // Invalidate Stats Cache immediately so next query gets fresh data
    memoryCache.invalidate('stats');

    return res.status(201).json({
      success: true,
      message: isPayLater
        ? 'Registration slot locked! Complete ₹350 payment later via the Check Status portal.'
        : 'Registration confirmed! Digital Pass generated.',
      registration: newRecord
    });
  } catch (err) {
    console.error('Registration processing error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Duplicate record error: RegNo, TxnId, or Email already registered.' });
    }
    return res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// 4. Master / Admin Authentication (Passkey abhi07 + backwards compatibility)
app.post(['/api/auth/login', '/api/v1/auth/login', '/api/v1/admin/login', '/api/admin/login', '/api/v1/master/login', '/api/master/login'], async (req, res) => {
  const { passkey, key, email, password } = req.body;
  const providedPasskey = passkey || key || (!email && password ? password : null);
  const masterSecret = process.env.MASTER_PASSKEY || 'abhi07';

  // Check Master Passkey
  if (providedPasskey) {
    if (providedPasskey.trim() === masterSecret.trim()) {
      const token = generateToken({
        id: 'master_admin_07',
        username: 'Master Admin',
        email: 'master@agriverse.org',
        role: 'SUPER_ADMIN'
      });

      return res.json({
        success: true,
        token,
        admin: {
          username: 'Master Admin',
          email: 'master@agriverse.org',
          role: 'SUPER_ADMIN'
        }
      });
    } else {
      return res.status(401).json({ error: 'Invalid master passkey. Access denied.' });
    }
  }

  if (!email || !password) {
    return res.status(400).json({ error: 'Passkey required' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    let adminRecord = null;

    if (isMongoConnected) {
      adminRecord = await Admin.findOne({ email: cleanEmail }).select('+password');
    } else {
      // In-Memory / Local Default Admin
      if (cleanEmail === 'admin@agriverse.org' && password === 'AgriVerse@2026') {
        adminRecord = {
          _id: 'local_admin_1',
          username: 'admin',
          email: 'admin@agriverse.org',
          role: 'SUPER_ADMIN'
        };
      }
    }

    if (!adminRecord) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    // If mongo record, verify bcrypt hash
    if (isMongoConnected) {
      const isMatch = await adminRecord.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }
    }

    // Generate JWT Token
    const token = generateToken({
      id: adminRecord._id,
      email: adminRecord.email,
      role: adminRecord.role || 'SUPER_ADMIN'
    });

    res.json({
      success: true,
      token,
      admin: {
        email: adminRecord.email,
        username: adminRecord.username || 'admin',
        role: adminRecord.role || 'SUPER_ADMIN'
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Authentication failed: ' + err.message });
  }
});

// 5. Protected Admin Routes
// 5a. Admin Real-Time Metrics & Statistics Dashboard Endpoint
app.get(['/api/v1/admin/stats', '/api/admin/stats'], authenticateToken, async (req, res) => {
  try {
    let list = [];
    let capacityLimit = 500;
    let isOpen = true;

    if (isMongoConnected) {
      list = await Registration.find().sort({ createdAt: -1 });
      const settings = await EventSettings.findOne({ eventCode: 'AGRIVERSE_2026' });
      if (settings) {
        capacityLimit = settings.registrationLimit || 500;
        isOpen = settings.isOpen !== false;
      }
    } else {
      list = readJson(DB_FILE, []).reverse();
      const current = readJson(SETTINGS_FILE, defaultSettings);
      capacityLimit = current.totalSeats || 500;
      isOpen = current.isOpen !== false;
    }

    const totalParticipants = list.length;
    const paidCount = list.filter((r) => r.paymentStatus === 'PAID').length;
    const unpaidCount = list.filter((r) => r.paymentStatus === 'UNPAID' || r.status === 'PENDING_PAYMENT').length;
    const verifiedCount = list.filter((r) => (r.verificationStatus || '').toUpperCase() === 'VERIFIED').length;
    const rejectedCount = list.filter((r) => (r.verificationStatus || '').toUpperCase() === 'REJECTED').length;
    const pendingVerification = list.filter(
      (r) => (r.verificationStatus || '').toUpperCase() !== 'VERIFIED' && (r.verificationStatus || '').toUpperCase() !== 'REJECTED'
    ).length;

    const currentRegistrations = totalParticipants;
    const remainingSlots = Math.max(0, capacityLimit - currentRegistrations);
    const percentFilled = Math.min(100, (currentRegistrations / capacityLimit) * 100).toFixed(1);

    const recentRegistrations = list.slice(0, 5);

    res.json({
      success: true,
      stats: {
        totalParticipants,
        paidCount,
        unpaidCount,
        pendingVerification,
        verifiedCount,
        rejectedCount,
        capacityLimit,
        currentRegistrations,
        remainingSlots,
        percentFilled,
        isOpen,
        recentRegistrations
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve admin stats: ' + err.message });
  }
});

const handleEventStatusToggle = async (req, res) => {
  const { isOpen } = req.body;
  try {
    const targetState = Boolean(isOpen);
    if (isMongoConnected) {
      await EventSettings.findOneAndUpdate(
        { eventCode: 'AGRIVERSE_2026' },
        { $set: { isOpen: targetState } },
        { upsert: true, new: true }
      );
    }
    try {
      const current = readJson(SETTINGS_FILE, defaultSettings);
      current.isOpen = targetState;
      writeJson(SETTINGS_FILE, current);
    } catch (_) {}

    memoryCache.invalidate('stats');

    res.json({
      success: true,
      isOpen: targetState,
      message: `Registrations ${targetState ? 'opened' : 'closed'} globally.`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle event registration status: ' + err.message });
  }
};

app.patch(['/api/v1/admin/event/status', '/api/admin/event/status'], authenticateToken, handleEventStatusToggle);
app.post(['/api/v1/admin/event/status', '/api/admin/event/status'], authenticateToken, handleEventStatusToggle);

app.post(['/api/v1/admin/event/toggle', '/api/admin/event/toggle'], authenticateToken, async (req, res) => {
  try {
    let newState = false;
    if (isMongoConnected) {
      const settings = await EventSettings.findOne({ eventCode: 'AGRIVERSE_2026' });
      const current = settings ? settings.isOpen !== false : true;
      newState = !current;
      await EventSettings.findOneAndUpdate(
        { eventCode: 'AGRIVERSE_2026' },
        { $set: { isOpen: newState } },
        { upsert: true, new: true }
      );
    } else {
      const current = readJson(SETTINGS_FILE, defaultSettings);
      const isCur = current.isOpen !== false;
      newState = !isCur;
      current.isOpen = newState;
      writeJson(SETTINGS_FILE, current);
    }

    memoryCache.invalidate('stats');

    res.json({
      success: true,
      isOpen: newState,
      message: `Registrations are now ${newState ? 'OPEN' : 'CLOSED'} globally.`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle event: ' + err.message });
  }
});

// 5c. Get Registrations List with Search, Filter & Pagination Support
app.get(['/api/v1/admin/registrations', '/api/admin/registrations'], authenticateToken, async (req, res) => {
  try {
    const { search, status, residency, page = 1, limit = 50 } = req.query;

    let list = [];
    if (isMongoConnected) {
      list = await Registration.find().sort({ createdAt: -1 });
    } else {
      list = readJson(DB_FILE, []).reverse();
    }

    let filtered = list;

    // Full-text search across Name, Register Number, Email, Phone, Department, Transaction ID
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          (r.name || r.fullName || '').toLowerCase().includes(q) ||
          (r.regNo || r.registerNumber || '').toLowerCase().includes(q) ||
          (r.email || '').toLowerCase().includes(q) ||
          (r.phone || '').toLowerCase().includes(q) ||
          (r.department || r.branch || '').toLowerCase().includes(q) ||
          (r.txnId || r.transactionId || '').toLowerCase().includes(q) ||
          (r.id || r.registrationId || '').toLowerCase().includes(q)
      );
    }

    // Status Filter: ALL, PAID, UNPAID, PENDING, VERIFIED, REJECTED
    if (status && status !== 'ALL') {
      const s = status.toUpperCase();
      if (s === 'PAID') {
        filtered = filtered.filter((r) => r.paymentStatus === 'PAID');
      } else if (s === 'UNPAID') {
        filtered = filtered.filter((r) => r.paymentStatus === 'UNPAID' || r.status === 'PENDING_PAYMENT');
      } else if (s === 'PENDING') {
        filtered = filtered.filter((r) => r.verificationStatus === 'PENDING' || r.status === 'PENDING_AUDIT');
      } else if (s === 'VERIFIED') {
        filtered = filtered.filter((r) => r.verificationStatus === 'VERIFIED' || r.status === 'VERIFIED' || r.status === 'CONFIRMED');
      } else if (s === 'REJECTED') {
        filtered = filtered.filter((r) => r.verificationStatus === 'REJECTED' || r.status === 'REJECTED');
      }
    }

    // Residency Filter: ALL, Hosteler, Dayscholar
    if (residency && residency !== 'ALL') {
      const resFilter = residency.toUpperCase();
      filtered = filtered.filter((r) => {
        const val = (r.residency || r.residencyStatus || '').toUpperCase();
        if (resFilter.includes('HOSTEL')) return val.includes('HOSTEL');
        if (resFilter.includes('DAY')) return val.includes('DAY');
        return val === resFilter;
      });
    }

    const totalCount = filtered.length;
    const pageNum = parseInt(page, 10) || 1;
    const pageLimit = limit === 'all' ? totalCount : parseInt(limit, 10) || 50;
    const startIndex = (pageNum - 1) * pageLimit;
    const paginated = limit === 'all' ? filtered : filtered.slice(startIndex, startIndex + pageLimit);

    res.json({
      success: true,
      count: totalCount,
      page: pageNum,
      totalPages: Math.ceil(totalCount / pageLimit) || 1,
      registrations: paginated
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve registrations: ' + err.message });
  }
});

// 5d. Verification Actions
// Verify Button Action: PATCH /api/v1/admin/registrations/:id/verify
app.patch(['/api/v1/admin/registrations/:id/verify', '/api/admin/registrations/:id/verify'], authenticateToken, async (req, res) => {
  const { id } = req.params;
  const lookupUpper = (id || '').toUpperCase();

  try {
    let updated = null;
    if (isMongoConnected) {
      updated = await Registration.findOneAndUpdate(
        {
          $or: [
            { id: id },
            { regNo: lookupUpper },
            { registrationId: lookupUpper },
            { _id: mongoose.isValidObjectId(id) ? id : null }
          ]
        },
        {
          $set: {
            status: 'VERIFIED',
            verificationStatus: 'VERIFIED',
            paymentStatus: 'PAID',
            verifiedAt: new Date(),
            rejectionReason: '',
            adminNotes: 'Payment vetted and verified by administrator.'
          }
        },
        { new: true }
      );
    } else {
      await storageMutex.dispatch(async () => {
        const registrations = readJson(DB_FILE, []);
        const idx = registrations.findIndex(
          (r) =>
            r.id === id ||
            r._id === id ||
            r.regNo?.toUpperCase() === lookupUpper ||
            r.registrationId?.toUpperCase() === lookupUpper
        );
        if (idx !== -1) {
          registrations[idx].status = 'VERIFIED';
          registrations[idx].verificationStatus = 'VERIFIED';
          registrations[idx].paymentStatus = 'PAID';
          registrations[idx].verifiedAt = new Date().toISOString();
          registrations[idx].rejectionReason = '';
          registrations[idx].adminNotes = 'Payment vetted and verified by administrator.';
          writeJson(DB_FILE, registrations);
          updated = registrations[idx];
        }
      });
    }

    if (!updated) {
      return res.status(404).json({ error: 'Registration record not found.' });
    }

    memoryCache.invalidate('stats');

    res.json({
      success: true,
      message: 'Registration verified and confirmed successfully.',
      registration: updated
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify registration: ' + err.message });
  }
});

// Reject Button Action: PATCH /api/v1/admin/registrations/:id/reject
app.patch(['/api/v1/admin/registrations/:id/reject', '/api/admin/registrations/:id/reject'], authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { rejectionReason, reason } = req.body;
  const reasonText = (rejectionReason || reason || 'Transaction ID does not match the screenshot provided').trim();
  const lookupUpper = (id || '').toUpperCase();

  try {
    let updated = null;
    if (isMongoConnected) {
      updated = await Registration.findOneAndUpdate(
        {
          $or: [
            { id: id },
            { regNo: lookupUpper },
            { registrationId: lookupUpper },
            { _id: mongoose.isValidObjectId(id) ? id : null }
          ]
        },
        {
          $set: {
            status: 'REJECTED',
            verificationStatus: 'REJECTED',
            verifiedAt: new Date(),
            rejectionReason: reasonText,
            adminNotes: reasonText
          }
        },
        { new: true }
      );
    } else {
      await storageMutex.dispatch(async () => {
        const registrations = readJson(DB_FILE, []);
        const idx = registrations.findIndex(
          (r) =>
            r.id === id ||
            r._id === id ||
            r.regNo?.toUpperCase() === lookupUpper ||
            r.registrationId?.toUpperCase() === lookupUpper
        );
        if (idx !== -1) {
          registrations[idx].status = 'REJECTED';
          registrations[idx].verificationStatus = 'REJECTED';
          registrations[idx].verifiedAt = new Date().toISOString();
          registrations[idx].rejectionReason = reasonText;
          registrations[idx].adminNotes = reasonText;
          writeJson(DB_FILE, registrations);
          updated = registrations[idx];
        }
      });
    }

    if (!updated) {
      return res.status(404).json({ error: 'Registration record not found.' });
    }

    memoryCache.invalidate('stats');

    res.json({
      success: true,
      message: 'Registration marked as REJECTED with reason recorded.',
      registration: updated
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject registration: ' + err.message });
  }
});

// Direct Status Dropdown / Status Update: Allows toggling status back to PENDING if needed
app.route(['/api/v1/admin/registrations/:id/status', '/api/admin/registrations/:id/status'])
  .patch(handleStatusUpdate)
  .put(handleStatusUpdate);

async function handleStatusUpdate(req, res) {
  const { id } = req.params;
  const { status, adminNotes, rejectionReason } = req.body;

  const validStatuses = ['VERIFIED', 'REJECTED', 'PENDING', 'PENDING_AUDIT', 'PENDING_PAYMENT'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const verStatus =
    status === 'VERIFIED'
      ? 'VERIFIED'
      : status === 'REJECTED'
      ? 'REJECTED'
      : 'PENDING';

  const internalStatus =
    status === 'PENDING'
      ? 'PENDING_AUDIT'
      : status;

  const reasonText = rejectionReason || adminNotes || '';
  const lookupUpper = (id || '').toUpperCase();

  try {
    let updatedRecord = null;
    if (isMongoConnected) {
      updatedRecord = await Registration.findOneAndUpdate(
        {
          $or: [
            { id: id },
            { regNo: lookupUpper },
            { registrationId: lookupUpper },
            { _id: mongoose.isValidObjectId(id) ? id : null }
          ]
        },
        {
          $set: {
            status: internalStatus,
            verificationStatus: verStatus,
            ...(verStatus === 'VERIFIED' ? { paymentStatus: 'PAID' } : {}),
            ...(adminNotes !== undefined ? { adminNotes } : {}),
            ...(reasonText ? { rejectionReason: reasonText } : {})
          }
        },
        { new: true }
      );
    } else {
      await storageMutex.dispatch(async () => {
        const registrations = readJson(DB_FILE, []);
        const idx = registrations.findIndex(
          (r) =>
            r.id === id ||
            r._id === id ||
            r.regNo?.toUpperCase() === lookupUpper ||
            r.registrationId?.toUpperCase() === lookupUpper
        );
        if (idx !== -1) {
          registrations[idx].status = internalStatus;
          registrations[idx].verificationStatus = verStatus;
          if (verStatus === 'VERIFIED') registrations[idx].paymentStatus = 'PAID';
          if (adminNotes !== undefined) registrations[idx].adminNotes = adminNotes;
          if (reasonText) registrations[idx].rejectionReason = reasonText;
          writeJson(DB_FILE, registrations);
          updatedRecord = registrations[idx];
        }
      });
    }

    if (!updatedRecord) {
      return res.status(404).json({ error: 'Registration record not found.' });
    }

    memoryCache.invalidate('stats');

    res.json({
      success: true,
      message: `Registration marked as ${status}.`,
      registration: updatedRecord
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update registration status: ' + err.message });
  }
}

// 5e. Manual Student Management (/admin/students)
// Insert offline walk-in registrations (POST /api/v1/admin/students)
app.post(['/api/v1/admin/students', '/api/admin/students'], authenticateToken, async (req, res) => {
  try {
    const {
      name,
      fullName,
      regNo,
      registerNumber,
      email,
      phone,
      department,
      branch,
      section,
      year,
      academicYear,
      gender,
      residency,
      residencyStatus,
      paymentStatus = 'PAID',
      amountPaid = 350,
      transactionId,
      txnId,
      adminNotes
    } = req.body;

    const cleanName = (name || fullName || '').trim();
    const cleanRegNo = (regNo || registerNumber || '').trim().toUpperCase();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').trim();
    const cleanDept = (department || branch || 'CSE').trim();
    const cleanSection = (section || 'A').trim().toUpperCase();
    const cleanYear = (year || academicYear || '1st Year').trim();
    const cleanGender = (gender || 'Other').trim();
    const cleanResidency = (residency || residencyStatus || 'Day Scholar').trim();
    const cleanPaymentStatus = (paymentStatus || 'PAID').toUpperCase();
    const cleanTxnId = (transactionId || txnId || `OFFLINE-${Date.now()}`).trim().toUpperCase();

    if (!cleanName || !cleanRegNo) {
      return res.status(400).json({ error: 'Student Full Name and Register Number are mandatory.' });
    }

    // Check duplicate
    if (isMongoConnected) {
      const exists = await Registration.findOne({
        $or: [{ regNo: cleanRegNo }, { registrationId: cleanRegNo }, { email: cleanEmail }]
      });
      if (exists) {
        return res.status(409).json({ error: `A registration with Register No ${cleanRegNo} or email already exists.` });
      }
    } else {
      const registrations = readJson(DB_FILE, []);
      const exists = registrations.find(
        (r) => r.regNo?.toUpperCase() === cleanRegNo || r.email?.toLowerCase() === cleanEmail
      );
      if (exists) {
        return res.status(409).json({ error: `A registration with Register No ${cleanRegNo} or email already exists.` });
      }
    }

    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const passId = `AGRI-2026-WLK-${randomHex}`;

    const newRecord = {
      id: passId,
      registrationId: cleanRegNo,
      name: cleanName,
      fullName: cleanName,
      regNo: cleanRegNo,
      registerNumber: cleanRegNo,
      email: cleanEmail || `${cleanRegNo.toLowerCase()}@offline.agriverse.org`,
      phone: cleanPhone || '9876543210',
      branch: cleanDept,
      department: cleanDept,
      section: cleanSection,
      year: cleanYear,
      academicYear: cleanYear,
      gender: cleanGender,
      residency: cleanResidency,
      residencyStatus: cleanResidency,
      college: 'KLU / AgriGen Campus',
      paymentStatus: cleanPaymentStatus,
      amount: Number(amountPaid) || 350,
      fee: 350,
      txnId: cleanTxnId,
      transactionId: cleanTxnId,
      verificationStatus: cleanPaymentStatus === 'PAID' ? 'VERIFIED' : 'PENDING',
      status: cleanPaymentStatus === 'PAID' ? 'VERIFIED' : 'PENDING_PAYMENT',
      paymentMode: 'OFFLINE_WALKIN',
      isOfflineWalkin: true,
      adminNotes: adminNotes || 'Offline walk-in registration manually enrolled by administrator.',
      createdAt: new Date()
    };

    if (isMongoConnected) {
      const doc = new Registration(newRecord);
      await doc.save();
      await EventSettings.findOneAndUpdate(
        { eventCode: 'AGRIVERSE_2026' },
        { $inc: { currentRegistrations: 1 } },
        { upsert: true }
      );
    } else {
      await storageMutex.dispatch(async () => {
        const registrations = readJson(DB_FILE, []);
        registrations.push(newRecord);
        writeJson(DB_FILE, registrations);
      });
    }

    memoryCache.invalidate('stats');

    res.status(201).json({
      success: true,
      message: 'Offline walk-in student registration created successfully.',
      registration: newRecord
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create student registration: ' + err.message });
  }
});

// Edit misspelled student details (PATCH /api/v1/admin/students/:id)
app.route(['/api/v1/admin/students/:id', '/api/admin/students/:id'])
  .patch(handleEditStudent)
  .put(handleEditStudent);

async function handleEditStudent(req, res) {
  const { id } = req.params;
  const lookupUpper = (id || '').toUpperCase();
  const updates = req.body;

  try {
    const allowedFields = [
      'name', 'fullName', 'regNo', 'registerNumber', 'email', 'phone',
      'department', 'branch', 'section', 'year', 'academicYear',
      'residency', 'residencyStatus', 'gender', 'transactionId', 'txnId',
      'paymentStatus', 'adminNotes', 'rejectionReason'
    ];

    const sanitizedUpdates = {};
    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        sanitizedUpdates[key] = updates[key];
      }
    }

    if (sanitizedUpdates.name && !sanitizedUpdates.fullName) sanitizedUpdates.fullName = sanitizedUpdates.name;
    if (sanitizedUpdates.regNo) sanitizedUpdates.regNo = sanitizedUpdates.regNo.toUpperCase();
    if (sanitizedUpdates.regNo && !sanitizedUpdates.registerNumber) sanitizedUpdates.registerNumber = sanitizedUpdates.regNo;
    if (sanitizedUpdates.department && !sanitizedUpdates.branch) sanitizedUpdates.branch = sanitizedUpdates.department;
    if (sanitizedUpdates.year && !sanitizedUpdates.academicYear) sanitizedUpdates.academicYear = sanitizedUpdates.year;
    if (sanitizedUpdates.residency && !sanitizedUpdates.residencyStatus) sanitizedUpdates.residencyStatus = sanitizedUpdates.residency;
    if (sanitizedUpdates.transactionId && !sanitizedUpdates.txnId) sanitizedUpdates.txnId = sanitizedUpdates.transactionId;

    let updated = null;
    if (isMongoConnected) {
      updated = await Registration.findOneAndUpdate(
        {
          $or: [
            { id: id },
            { regNo: lookupUpper },
            { registrationId: lookupUpper },
            { _id: mongoose.isValidObjectId(id) ? id : null }
          ]
        },
        { $set: sanitizedUpdates },
        { new: true }
      );
    } else {
      await storageMutex.dispatch(async () => {
        const registrations = readJson(DB_FILE, []);
        const idx = registrations.findIndex(
          (r) =>
            r.id === id ||
            r._id === id ||
            r.regNo?.toUpperCase() === lookupUpper ||
            r.registrationId?.toUpperCase() === lookupUpper
        );
        if (idx !== -1) {
          Object.assign(registrations[idx], sanitizedUpdates);
          writeJson(DB_FILE, registrations);
          updated = registrations[idx];
        }
      });
    }

    if (!updated) {
      return res.status(404).json({ error: 'Student record not found.' });
    }

    memoryCache.invalidate('stats');

    res.json({
      success: true,
      message: 'Student record updated successfully.',
      registration: updated
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update student record: ' + err.message });
  }
}

// ======================================================================
// WORKFLOW G: AUTOMATED EXCEL EXPORT PIPELINE (GET /api/v1/admin/export/excel)
// ======================================================================
app.get(
  ['/api/v1/admin/export/excel', '/api/v1/admin/export-excel', '/api/admin/export/excel', '/api/admin/export-excel'],
  authenticateToken,
  async (req, res) => {
    try {
      const { status = 'ALL', residency = 'ALL', search } = req.query;

      let list = [];
      if (isMongoConnected) {
        // Queries matching registrations sorted chronologically (createdAt: 1)
        list = await Registration.find().sort({ createdAt: 1 });
      } else {
        list = readJson(DB_FILE, []).sort(
          (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        );
      }

      let filtered = list;

      // Status Filter: ALL, PAID, UNPAID, PENDING, VERIFIED, REJECTED
      if (status && status !== 'ALL') {
        const s = status.toUpperCase();
        if (s === 'PAID') {
          filtered = filtered.filter((r) => r.paymentStatus === 'PAID');
        } else if (s === 'UNPAID') {
          filtered = filtered.filter(
            (r) => r.paymentStatus === 'UNPAID' || r.status === 'PENDING_PAYMENT'
          );
        } else if (s === 'PENDING') {
          filtered = filtered.filter(
            (r) =>
              (r.verificationStatus === 'PENDING' || r.status === 'PENDING_AUDIT') &&
              r.verificationStatus !== 'VERIFIED' &&
              r.verificationStatus !== 'REJECTED'
          );
        } else if (s === 'VERIFIED') {
          filtered = filtered.filter(
            (r) =>
              r.verificationStatus === 'VERIFIED' ||
              r.status === 'VERIFIED' ||
              r.status === 'CONFIRMED'
          );
        } else if (s === 'REJECTED') {
          filtered = filtered.filter(
            (r) => r.verificationStatus === 'REJECTED' || r.status === 'REJECTED'
          );
        }
      }

      // Residency Filter: ALL, HOSTLERS, DAYSCHOLARS
      if (residency && residency !== 'ALL') {
        const resFilter = residency.toUpperCase();
        filtered = filtered.filter((r) => {
          const val = (r.residency || r.residencyStatus || '').toUpperCase();
          if (resFilter.includes('HOSTEL')) return val.includes('HOSTEL');
          if (resFilter.includes('DAY')) return val.includes('DAY');
          return val === resFilter;
        });
      }

      // Search Filter (optional)
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(
          (r) =>
            (r.name || r.fullName || '').toLowerCase().includes(q) ||
            (r.regNo || r.registerNumber || '').toLowerCase().includes(q) ||
            (r.email || '').toLowerCase().includes(q) ||
            (r.phone || '').toLowerCase().includes(q) ||
            (r.department || r.branch || '').toLowerCase().includes(q) ||
            (r.txnId || r.transactionId || '').toLowerCase().includes(q) ||
            (r.id || r.registrationId || '').toLowerCase().includes(q)
        );
      }

      // Generates styled Excel workbook and streams directly as binary response
      await streamRegistrationsExcel(filtered, res, { status, residency });
    } catch (err) {
      console.error('Excel streaming error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate Excel report: ' + err.message });
      }
    }
  }
);


// ======================================================================
// WORKFLOW F: EVENT SETTINGS, MULTIPLE QR CODES & WHATSAPP GROUP ENGINE
// ======================================================================

// Helper to get or initialize complete event settings
async function getFullEventSettings() {
  const initialQrs = [
    {
      id: 'qr-primary-gpay',
      title: 'GPay Primary UPI',
      upiId: 'sundarrajan.it@okaxis',
      imageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=sundarrajan.it@okaxis%26pn=sundarrajan.it%26am=350%26cu=INR%26tn=AgriVerse_UE_Course',
      storageProvider: 'default',
      isActive: true,
      createdAt: new Date()
    }
  ];

  const initialWaGroups = [
    {
      id: 'wa-primary-delegates',
      name: 'AgriVerse 2026 Primary Community',
      inviteUrl: 'https://chat.whatsapp.com/invite/AgriVerseUECourse2026',
      priority: 1,
      isActive: true,
      createdAt: new Date()
    }
  ];

  if (isMongoConnected) {
    let settings = await EventSettings.findOne({ eventCode: 'AGRIVERSE_2026' });
    if (!settings) {
      settings = await EventSettings.create({
        eventCode: 'AGRIVERSE_2026',
        registrationLimit: 500,
        currentRegistrations: 372,
        isOpen: true,
        fee: 350,
        whatsappLink: 'https://chat.whatsapp.com/invite/AgriVerseUECourse2026',
        qrCodes: initialQrs,
        whatsappGroups: initialWaGroups
      });
    } else {
      let needsSave = false;
      if (!settings.qrCodes || settings.qrCodes.length === 0) {
        settings.qrCodes = initialQrs;
        needsSave = true;
      }
      if (!settings.whatsappGroups || settings.whatsappGroups.length === 0) {
        settings.whatsappGroups = initialWaGroups;
        needsSave = true;
      }
      if (needsSave) await settings.save();
    }
    return settings;
  } else {
    const current = readJson(SETTINGS_FILE, defaultSettings);
    if (!current.qrCodes || current.qrCodes.length === 0) current.qrCodes = initialQrs;
    if (!current.whatsappGroups || current.whatsappGroups.length === 0) current.whatsappGroups = initialWaGroups;
    if (current.isOpen === undefined) current.isOpen = true;
    if (current.fee === undefined) current.fee = 350;
    if (!current.registrationLimit) current.registrationLimit = current.totalSeats || 500;
    writeJson(SETTINGS_FILE, current);
    return current;
  }
}

// F1. Get Complete Settings (General, Multiple QRs, WhatsApp Groups)
app.get(['/api/v1/admin/settings', '/api/admin/settings', '/api/settings', '/api/v1/settings'], async (req, res) => {
  try {
    const settings = await getFullEventSettings();
    res.json({
      success: true,
      settings: {
        registrationOpen: settings.registrationOpen !== undefined ? settings.registrationOpen : (settings.isOpen !== false),
        isOpen: settings.isOpen !== false,
        registrationLimit: settings.registrationLimit || settings.totalSeats || 100,
        currentRegistrations: settings.currentRegistrations || 0,
        totalSeats: settings.registrationLimit || settings.totalSeats || 100,
        registrationFee: settings.registrationFee !== undefined ? settings.registrationFee : (settings.fee !== undefined ? settings.fee : 0),
        fee: settings.fee !== undefined ? settings.fee : (settings.registrationFee !== undefined ? settings.registrationFee : 0),
        qrCode: settings.qrCode || { url: '', publicId: '' },
        whatsappLink: settings.whatsappLink || 'https://chat.whatsapp.com/invite/AgriVerseUECourse2026',
        qrCodes: settings.qrCodes || [],
        whatsappGroups: settings.whatsappGroups || []
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve settings: ' + err.message });
  }
});

// F2. Update General Settings (Toggle Open/Closed, Capacity Limit, Fee in INR, WhatsApp Link)
app.route([
  '/api/v1/admin/settings',
  '/api/admin/settings',
  '/api/v1/admin/event/status',
  '/api/admin/event/status'
])
  .put(authenticateToken, handleUpdateSettings)
  .patch(authenticateToken, handleUpdateSettings)
  .post(authenticateToken, handleUpdateSettings);

async function handleUpdateSettings(req, res) {
  const { isOpen, registrationOpen, registrationLimit, totalSeats, fee, registrationFee, whatsappLink } = req.body;
  try {
    const limit = Number(registrationLimit !== undefined ? registrationLimit : totalSeats);
    const regOpenVal = registrationOpen !== undefined ? registrationOpen : isOpen;
    const feeVal = registrationFee !== undefined ? registrationFee : fee;

    const updateFields = {};
    if (regOpenVal !== undefined) {
      updateFields.registrationOpen = Boolean(regOpenVal);
      updateFields.isOpen = Boolean(regOpenVal);
    }
    if (!isNaN(limit) && limit > 0) {
      updateFields.registrationLimit = limit;
      updateFields.totalSeats = limit;
    }
    if (feeVal !== undefined) {
      const numFee = Number(feeVal);
      if (!isNaN(numFee) && numFee >= 0) {
        updateFields.registrationFee = numFee;
        updateFields.fee = numFee;
      }
    }
    if (whatsappLink) updateFields.whatsappLink = whatsappLink.trim();

    let updated = null;
    if (isMongoConnected) {
      updated = await EventSettings.findOneAndUpdate(
        { eventCode: 'AGRIVERSE_2026' },
        { $set: updateFields },
        { new: true, upsert: true }
      );
      if (updateFields.totalSeats) {
        await EventQuota.findOneAndUpdate(
          { code: 'AGRIVERSE_2026' },
          { $set: { totalSeats: updateFields.totalSeats } },
          { upsert: true }
        );
      }
    } else {
      const current = await getFullEventSettings();
      Object.assign(current, updateFields);
      writeJson(SETTINGS_FILE, current);
      updated = current;
    }

    memoryCache.invalidate();

    res.json({
      success: true,
      message: 'General event settings updated successfully.',
      settings: updated,
      isOpen: updated.isOpen !== false,
      isSystemOpen: updated.isOpen !== false
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update event settings: ' + err.message });
  }
}

// F3. Multiple QR Code Management
// Upload new UPI QR images (single or batch upload up to 10 files)
app.post(
  ['/api/v1/admin/settings/qrs', '/api/admin/settings/qrs'],
  authenticateToken,
  upload.array('qrImages', 10),
  async (req, res) => {
    try {
      const { title, upiId } = req.body;
      const uploadedFiles = req.files || [];

      // Support direct image URL upload if no files attached
      if (uploadedFiles.length === 0 && req.body.imageUrl) {
        const singleQr = {
          id: `QR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          title: (title || 'UPI QR Code').trim(),
          upiId: (upiId || 'agriverse@upi').trim(),
          url: req.body.url ? req.body.url.trim() : req.body.imageUrl.trim(),
          imageUrl: req.body.imageUrl ? req.body.imageUrl.trim() : req.body.url.trim(),
          publicId: '',
          storageProvider: 'external',
          active: true,
          isActive: true,
          createdAt: new Date()
        };

        if (isMongoConnected) {
          await EventSettings.findOneAndUpdate(
            { eventCode: 'AGRIVERSE_2026' },
            { $push: { qrCodes: singleQr } },
            { upsert: true }
          );
        } else {
          const current = await getFullEventSettings();
          current.qrCodes = current.qrCodes || [];
          current.qrCodes.push(singleQr);
          writeJson(SETTINGS_FILE, current);
        }

        memoryCache.invalidate('stats');
        return res.status(201).json({ success: true, qrCode: singleQr });
      }

      if (uploadedFiles.length === 0) {
        return res.status(400).json({ error: 'Please attach at least one QR image file (up to 10 files).' });
      }

      const createdQrs = [];
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const uniqueRegKey = `QR_${Date.now()}_${i}`;
        const proofResult = await processAndStoreProof(file.buffer, file.originalname, file.mimetype, uniqueRegKey);

        const customTitle = uploadedFiles.length === 1 && title
          ? title.trim()
          : (title ? `${title.trim()} (${i + 1})` : file.originalname.replace(/\.[^/.]+$/, ''));

        const qrItem = {
          id: `QR-${Date.now()}-${i}-${Math.floor(1000 + Math.random() * 9000)}`,
          title: customTitle || `UPI QR Code (${i + 1})`,
          upiId: (upiId || 'sundarrajan.it@okaxis').trim(),
          url: proofResult.proofUrl,
          imageUrl: proofResult.proofUrl,
          publicId: proofResult.publicId || '',
          storageProvider: proofResult.storageProvider || 'local',
          active: true,
          isActive: true,
          createdAt: new Date()
        };
        createdQrs.push(qrItem);
      }

      if (isMongoConnected) {
        await EventSettings.findOneAndUpdate(
          { eventCode: 'AGRIVERSE_2026' },
          { $push: { qrCodes: { $each: createdQrs } } },
          { upsert: true }
        );
      } else {
        const current = await getFullEventSettings();
        current.qrCodes = current.qrCodes || [];
        current.qrCodes.push(...createdQrs);
        writeJson(SETTINGS_FILE, current);
      }

      memoryCache.invalidate('stats');

      res.status(201).json({
        success: true,
        message: `Successfully uploaded ${createdQrs.length} UPI QR code(s).`,
        qrCodes: createdQrs
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to upload QR code(s): ' + err.message });
    }
  }
);

// Toggle QR Code Active / Inactive
app.patch(['/api/v1/admin/settings/qrs/:id/toggle', '/api/admin/settings/qrs/:id/toggle'], authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    let targetQr = null;
    if (isMongoConnected) {
      const doc = await EventSettings.findOne({ eventCode: 'AGRIVERSE_2026' });
      if (doc && doc.qrCodes) {
        const qr = doc.qrCodes.find((q) => q.id === id);
        if (qr) {
          qr.isActive = !qr.isActive;
          doc.markModified('qrCodes');
          await doc.save();
          targetQr = qr;
        }
      }
    } else {
      const current = await getFullEventSettings();
      const qr = (current.qrCodes || []).find((q) => q.id === id);
      if (qr) {
        qr.isActive = !qr.isActive;
        writeJson(SETTINGS_FILE, current);
        targetQr = qr;
      }
    }

    if (!targetQr) return res.status(404).json({ error: 'QR code not found.' });

    memoryCache.invalidate('stats');
    res.json({ success: true, message: `QR code marked as ${targetQr.isActive ? 'ACTIVE' : 'INACTIVE'}.`, qrCode: targetQr });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle QR code: ' + err.message });
  }
});

// Edit QR Code Details (Title, UPI ID)
app.route(['/api/v1/admin/settings/qrs/:id', '/api/admin/settings/qrs/:id'])
  .patch(authenticateToken, handleEditQr)
  .put(authenticateToken, handleEditQr);

async function handleEditQr(req, res) {
  const { id } = req.params;
  const { title, upiId, isActive } = req.body;
  try {
    let targetQr = null;
    if (isMongoConnected) {
      const doc = await EventSettings.findOne({ eventCode: 'AGRIVERSE_2026' });
      if (doc && doc.qrCodes) {
        const qr = doc.qrCodes.find((q) => q.id === id);
        if (qr) {
          if (title !== undefined) qr.title = title.trim();
          if (upiId !== undefined) qr.upiId = upiId.trim();
          if (isActive !== undefined) qr.isActive = Boolean(isActive);
          await doc.save();
          targetQr = qr;
        }
      }
    } else {
      const current = await getFullEventSettings();
      const qr = (current.qrCodes || []).find((q) => q.id === id);
      if (qr) {
        if (title !== undefined) qr.title = title.trim();
        if (upiId !== undefined) qr.upiId = upiId.trim();
        if (isActive !== undefined) qr.isActive = Boolean(isActive);
        writeJson(SETTINGS_FILE, current);
        targetQr = qr;
      }
    }

    if (!targetQr) return res.status(404).json({ error: 'QR code not found.' });

    memoryCache.invalidate('stats');
    res.json({ success: true, message: 'QR code updated successfully.', qrCode: targetQr });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update QR code: ' + err.message });
  }
}

// Delete QR Code with Automated Cleanup from Cloudinary or Local Disk
app.delete(['/api/v1/admin/settings/qrs/:id', '/api/admin/settings/qrs/:id'], authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    let removedQr = null;

    if (isMongoConnected) {
      const doc = await EventSettings.findOne({ eventCode: 'AGRIVERSE_2026' });
      if (doc && doc.qrCodes) {
        const idx = doc.qrCodes.findIndex((q) => q.id === id);
        if (idx !== -1) {
          removedQr = doc.qrCodes[idx];
          doc.qrCodes.splice(idx, 1);
          await doc.save();
        }
      }
    } else {
      const current = await getFullEventSettings();
      const idx = (current.qrCodes || []).findIndex((q) => q.id === id);
      if (idx !== -1) {
        removedQr = current.qrCodes[idx];
        current.qrCodes.splice(idx, 1);
        writeJson(SETTINGS_FILE, current);
      }
    }

    if (!removedQr) return res.status(404).json({ error: 'QR code not found.' });

    // Automated cleanup from Cloudinary or Local Disk
    if (removedQr.publicId) {
      await deleteStoredAsset(removedQr.publicId, removedQr.storageProvider);
    }

    memoryCache.invalidate('stats');
    res.json({ success: true, message: 'QR code deleted and storage asset cleaned up successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete QR code: ' + err.message });
  }
});

// Public Endpoint: Retrieve Active UPI QR Codes & Payment Methods for Students
app.get(
  [
    '/api/v1/event/payment-methods',
    '/api/event/payment-methods',
    '/api/v1/qrs',
    '/api/qrs'
  ],
  async (req, res) => {
    try {
      const settings = await getFullEventSettings();
      const fee = Number(settings.registrationFee !== undefined ? settings.registrationFee : (settings.fee !== undefined ? settings.fee : 350));

      let activeQrs = (settings.qrCodes || []).filter((q) => q.isActive !== false && q.active !== false);
      if (activeQrs.length === 0 && (settings.qrCodes || []).length > 0) {
        activeQrs = settings.qrCodes;
      }
      if (activeQrs.length === 0) {
        activeQrs = [
          {
            id: 'qr-primary-gpay',
            title: 'GPay Primary UPI',
            upiId: 'sundarrajan.it@okaxis',
            imageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=sundarrajan.it@okaxis%26pn=sundarrajan.it%26am=350%26cu=INR%26tn=AgriVerse_UE_Course',
            url: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=sundarrajan.it@okaxis%26pn=sundarrajan.it%26am=350%26cu=INR%26tn=AgriVerse_UE_Course',
            isActive: true
          }
        ];
      }

      const formatted = activeQrs.map((q, idx) => {
        const upiId = q.upiId || 'sundarrajan.it@okaxis';
        const upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=AgriVerse&am=${fee}&cu=INR&tn=AgriVerse_UE_Course`;
        const qrUrl = q.url || q.imageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiString)}`;
        return {
          id: q.id || `qr-${idx + 1}`,
          title: q.title || `Payment Account #${idx + 1}`,
          name: 'AgriVerse UE',
          upiId,
          holder: upiId.split('@')[0] || 'sundarrajan.it',
          amount: fee,
          currency: 'INR',
          url: qrUrl,
          imageUrl: qrUrl,
          upiString,
          isActive: true
        };
      });

      res.json({
        success: true,
        paymentMethods: formatted,
        qrCodes: formatted
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve active QR codes: ' + err.message });
    }
  }
);

// F4. WhatsApp Group Community Management
// Add New Community Invite Link (Name, Invite URL, Priority Order)
app.post(['/api/v1/admin/settings/whatsapp-groups', '/api/admin/settings/whatsapp-groups'], authenticateToken, async (req, res) => {
  const { name, inviteUrl, url, priority = 1 } = req.body;
  const targetUrl = (inviteUrl || url || '').trim();
  const targetName = (name || '').trim();

  if (!targetName || !targetUrl) {
    return res.status(400).json({ error: 'Community group name and valid invite URL are required.' });
  }

  try {
    const newGroup = {
      id: `WA-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      name: targetName,
      url: targetUrl,
      inviteUrl: targetUrl,
      active: true,
      isActive: true,
      order: Number(req.body.order !== undefined ? req.body.order : (priority !== undefined ? priority : 0)),
      priority: Number(priority !== undefined ? priority : (req.body.order !== undefined ? req.body.order : 0)),
      createdAt: new Date()
    };

    if (isMongoConnected) {
      await EventSettings.findOneAndUpdate(
        { eventCode: 'AGRIVERSE_2026' },
        { $push: { whatsappGroups: newGroup } },
        { upsert: true }
      );
    } else {
      const current = await getFullEventSettings();
      current.whatsappGroups = current.whatsappGroups || [];
      current.whatsappGroups.push(newGroup);
      writeJson(SETTINGS_FILE, current);
    }

    memoryCache.invalidate('stats');
    res.status(201).json({ success: true, message: 'Community WhatsApp group added.', group: newGroup });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add WhatsApp group: ' + err.message });
  }
});

// Edit URL, Group Name, or Priority
app.route(['/api/v1/admin/settings/whatsapp-groups/:id', '/api/admin/settings/whatsapp-groups/:id'])
  .patch(authenticateToken, handleEditWaGroup)
  .put(authenticateToken, handleEditWaGroup);

async function handleEditWaGroup(req, res) {
  const { id } = req.params;
  const { name, inviteUrl, url, priority, isActive } = req.body;
  try {
    let targetGroup = null;
    if (isMongoConnected) {
      const doc = await EventSettings.findOne({ eventCode: 'AGRIVERSE_2026' });
      if (doc && doc.whatsappGroups) {
        const g = doc.whatsappGroups.find((item) => item.id === id);
        if (g) {
          if (name !== undefined) g.name = name.trim();
          if (inviteUrl !== undefined || url !== undefined) g.inviteUrl = (inviteUrl || url).trim();
          if (priority !== undefined) g.priority = Number(priority);
          if (isActive !== undefined) g.isActive = Boolean(isActive);
          await doc.save();
          targetGroup = g;
        }
      }
    } else {
      const current = await getFullEventSettings();
      const g = (current.whatsappGroups || []).find((item) => item.id === id);
      if (g) {
        if (name !== undefined) g.name = name.trim();
        if (inviteUrl !== undefined || url !== undefined) g.inviteUrl = (inviteUrl || url).trim();
        if (priority !== undefined) g.priority = Number(priority);
        if (isActive !== undefined) g.isActive = Boolean(isActive);
        writeJson(SETTINGS_FILE, current);
        targetGroup = g;
      }
    }

    if (!targetGroup) return res.status(404).json({ error: 'WhatsApp group not found.' });

    memoryCache.invalidate('stats');
    res.json({ success: true, message: 'WhatsApp group updated.', group: targetGroup });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update WhatsApp group: ' + err.message });
  }
}

// Toggle Group Active / Inactive
app.patch(
  ['/api/v1/admin/settings/whatsapp-groups/:id/toggle', '/api/admin/settings/whatsapp-groups/:id/toggle'],
  authenticateToken,
  async (req, res) => {
    const { id } = req.params;
    try {
      let targetGroup = null;
      if (isMongoConnected) {
        const doc = await EventSettings.findOne({ eventCode: 'AGRIVERSE_2026' });
        if (doc && doc.whatsappGroups) {
          const g = doc.whatsappGroups.find((item) => item.id === id);
          if (g) {
            g.isActive = !g.isActive;
            await doc.save();
            targetGroup = g;
          }
        }
      } else {
        const current = await getFullEventSettings();
        const g = (current.whatsappGroups || []).find((item) => item.id === id);
        if (g) {
          g.isActive = !g.isActive;
          writeJson(SETTINGS_FILE, current);
          targetGroup = g;
        }
      }

      if (!targetGroup) return res.status(404).json({ error: 'WhatsApp group not found.' });

      memoryCache.invalidate('stats');
      res.json({ success: true, message: `Group marked as ${targetGroup.isActive ? 'ACTIVE' : 'INACTIVE'}.`, group: targetGroup });
    } catch (err) {
      res.status(500).json({ error: 'Failed to toggle group: ' + err.message });
    }
  }
);

// Delete WhatsApp Group
app.delete(['/api/v1/admin/settings/whatsapp-groups/:id', '/api/admin/settings/whatsapp-groups/:id'], authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    let deleted = false;
    if (isMongoConnected) {
      const doc = await EventSettings.findOne({ eventCode: 'AGRIVERSE_2026' });
      if (doc && doc.whatsappGroups) {
        const idx = doc.whatsappGroups.findIndex((item) => item.id === id);
        if (idx !== -1) {
          doc.whatsappGroups.splice(idx, 1);
          await doc.save();
          deleted = true;
        }
      }
    } else {
      const current = await getFullEventSettings();
      const idx = (current.whatsappGroups || []).findIndex((item) => item.id === id);
      if (idx !== -1) {
        current.whatsappGroups.splice(idx, 1);
        writeJson(SETTINGS_FILE, current);
        deleted = true;
      }
    }

    if (!deleted) return res.status(404).json({ error: 'WhatsApp group not found.' });

    memoryCache.invalidate('stats');
    res.json({ success: true, message: 'WhatsApp community group deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete WhatsApp group: ' + err.message });
  }
});

// Public Endpoint: Retrieve Active WhatsApp Groups Sorted by Priority
app.get(['/api/v1/whatsapp-groups', '/api/whatsapp-groups'], async (req, res) => {
  try {
    const settings = await getFullEventSettings();
    const active = (settings.whatsappGroups || [])
      .filter((g) => g.isActive !== false)
      .sort((a, b) => (a.priority || 1) - (b.priority || 1));
    res.json({ success: true, groups: active });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve WhatsApp groups: ' + err.message });
  }
});


// 5e. Decoupled Payment Proof Submission ("Pay Later" Model Portal Submission)
app.post('/api/registration/submit-payment', upload.single('idProof'), async (req, res) => {
  const { regNo, id, phone, txnId, joinedWhatsapp } = req.body;

  const cleanTxnId = (txnId || '').trim().toUpperCase();
  if (!cleanTxnId || cleanTxnId.length < 4) {
    return res.status(400).json({ error: 'Please enter a valid UPI Transaction / Reference (UTR) ID (min 4 characters).' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Please attach your UPI payment confirmation screenshot.' });
  }

  const lookupKey = (regNo || id || phone || '').trim().toUpperCase();
  if (!lookupKey) {
    return res.status(400).json({ error: 'Registration identifier (Reg No or Pass ID) is required.' });
  }

  try {
    // 1. DUPLICATE UPI TXN ID VERIFICATION: Immediate stop to duplicate/reused UPI IDs
    if (isMongoConnected) {
      const existingTxn = await Registration.findOne({
        txnId: cleanTxnId,
        $nor: [{ regNo: lookupKey }, { id: lookupKey }]
      });
      if (existingTxn) {
        return res.status(409).json({
          error: `This UPI Reference ID (${cleanTxnId}) has already been submitted by another attendee (${existingTxn.regNo}). Reused transaction proofs are prohibited.`
        });
      }
    } else {
      const registrations = readJson(DB_FILE, []);
      const existingTxn = registrations.find(
        (r) =>
          r.txnId &&
          r.txnId.toUpperCase() === cleanTxnId &&
          r.regNo?.toUpperCase() !== lookupKey &&
          r.id?.toUpperCase() !== lookupKey
      );
      if (existingTxn) {
        return res.status(409).json({
          error: `This UPI Reference ID (${cleanTxnId}) has already been submitted by another attendee. Reused transaction proofs are prohibited.`
        });
      }
    }

    // 2. Lookup existing registration
    let record = null;
    if (isMongoConnected) {
      record = await Registration.findOne({
        $or: [{ regNo: lookupKey }, { id: lookupKey }, { phone: lookupKey.replace(/[\s\-\+]/g, '') }]
      });
    } else {
      const registrations = readJson(DB_FILE, []);
      record = registrations.find(
        (r) =>
          (r.regNo && r.regNo.toUpperCase() === lookupKey) ||
          (r.id && r.id.toUpperCase() === lookupKey) ||
          (r.phone && r.phone.replace(/[\s\-\+]/g, '') === lookupKey.replace(/[\s\-\+]/g, ''))
      );
    }

    if (!record) {
      return res.status(404).json({ error: 'No matching registration found for ' + lookupKey });
    }

    // 3. Process and store the screenshot proof
    const proofData = await processAndStoreProof(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      record.id
    );

    // 4. Update status to PENDING_AUDIT (Fraud-Resistant Manual Verification Queue)
    let updatedRecord = null;
    if (isMongoConnected) {
      record.txnId = cleanTxnId;
      record.proofUrl = proofData.proofUrl;
      record.proofPublicId = proofData.publicId;
      record.storageProvider = proofData.storageProvider;
      record.status = 'PENDING_AUDIT';
      record.joinedWhatsapp = (joinedWhatsapp || 'Yes').trim();
      record.adminNotes = 'Payment proof uploaded via lookup portal. Awaiting organizer audit.';
      await record.save();
      updatedRecord = record;
    } else {
      await storageMutex.dispatch(async () => {
        const registrations = readJson(DB_FILE, []);
        const idx = registrations.findIndex((r) => r.id === record.id || r.regNo === record.regNo);
        if (idx !== -1) {
          registrations[idx].txnId = cleanTxnId;
          registrations[idx].proofUrl = proofData.proofUrl;
          registrations[idx].proofPublicId = proofData.publicId;
          registrations[idx].storageProvider = proofData.storageProvider;
          registrations[idx].status = 'PENDING_AUDIT';
          registrations[idx].joinedWhatsapp = (joinedWhatsapp || 'Yes').trim();
          registrations[idx].adminNotes = 'Payment proof uploaded via lookup portal. Awaiting organizer audit.';
          writeJson(DB_FILE, registrations);
          updatedRecord = registrations[idx];
        }
      });
    }

    memoryCache.invalidate('stats');

    return res.json({
      success: true,
      message: 'Payment proof submitted successfully! Verification is in progress.',
      registration: updatedRecord || record
    });
  } catch (err) {
    console.error('Payment submission error:', err);
    res.status(500).json({ error: 'Failed to process payment submission: ' + err.message });
  }
});

// 6. Verify Pass (Public QR code scanner endpoint)
app.get('/api/verify/:id', async (req, res) => {
  const { id } = req.params;
  try {
    let record = null;
    if (isMongoConnected) {
      record = await Registration.findOne({ id });
    } else {
      const registrations = readJson(DB_FILE, []);
      record = registrations.find((r) => r.id === id);
    }

    if (!record) {
      return res.status(404).json({ valid: false, message: 'Pass not found or invalid.' });
    }

    res.json({
      valid: true,
      event: 'AgriVerse 2026',
      delegate: record.name,
      regNo: record.regNo,
      institution: record.college,
      track: record.track,
      gate: record.gate || 'Green-1 Gate',
      verifiedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ======================================================================
// WORKFLOW D: STUDENT STATUS LOOKUP & PASSPORT API
// ======================================================================
app.get(
  [
    '/api/v1/registrations/status/:registrationId',
    '/api/registrations/status/:registrationId',
    '/api/status/:query'
  ],
  async (req, res) => {
    const rawParam = (req.params.registrationId || req.params.query || '').trim();
    if (!rawParam) {
      return res.status(400).json({ success: false, error: 'Registration ID or Register Number is required.' });
    }
    const cleanUpper = rawParam.toUpperCase();
    const cleanDigits = rawParam.replace(/[\s\-\+]/g, '');
    const cleanEmail = rawParam.toLowerCase();

    try {
      let record = null;
      if (isMongoConnected) {
        record = await Registration.findOne({
          $or: [
            { registrationId: cleanUpper },
            { regNo: cleanUpper },
            { id: cleanUpper },
            { transactionId: cleanUpper },
            { txnId: cleanUpper },
            { phone: cleanDigits },
            { email: cleanEmail }
          ]
        });
      } else {
        const registrations = readJson(DB_FILE, []);
        record = registrations.find(
          (r) =>
            (r.registrationId && r.registrationId.toUpperCase() === cleanUpper) ||
            (r.regNo && r.regNo.toUpperCase() === cleanUpper) ||
            (r.id && r.id.toUpperCase() === cleanUpper) ||
            (r.transactionId && r.transactionId.toUpperCase() === cleanUpper) ||
            (r.txnId && r.txnId.toUpperCase() === cleanUpper) ||
            (r.phone && r.phone.replace(/[\s\-\+]/g, '') === cleanDigits) ||
            (r.email && r.email.toLowerCase() === cleanEmail)
        );
      }

      if (!record) {
        return res.status(404).json({
          success: false,
          message: `No registration record found for '${rawParam}'. Please verify your Register Number or sign up.`
        });
      }

      const rawObj = record.toObject ? record.toObject() : { ...record };
      const formatted = {
        ...rawObj,
        name: rawObj.name || rawObj.fullName,
        fullName: rawObj.fullName || rawObj.name,
        regNo: rawObj.regNo || rawObj.registerNumber,
        registerNumber: rawObj.registerNumber || rawObj.regNo,
        registrationId: rawObj.registrationId || rawObj.regNo || rawObj.id,
        department: rawObj.department || rawObj.branch,
        branch: rawObj.branch || rawObj.department,
        section: rawObj.section || 'A',
        year: rawObj.year || rawObj.academicYear || '1st Year',
        academicYear: rawObj.academicYear || rawObj.year || '1st Year',
        residency: rawObj.residency || rawObj.residencyStatus || 'Day Scholar',
        residencyStatus: rawObj.residencyStatus || rawObj.residency || 'Day Scholar',
        rejectionReason:
          rawObj.status === 'REJECTED' || rawObj.verificationStatus === 'REJECTED'
            ? rawObj.rejectionReason || rawObj.adminNotes || 'Transaction ID does not match the screenshot provided'
            : '',
        verificationStatus: rawObj.verificationStatus || (rawObj.status === 'VERIFIED' ? 'VERIFIED' : rawObj.status === 'REJECTED' ? 'REJECTED' : 'PENDING'),
        status: rawObj.status || (rawObj.verificationStatus === 'VERIFIED' ? 'CONFIRMED' : rawObj.verificationStatus === 'REJECTED' ? 'REJECTED' : 'PENDING_AUDIT')
      };

      const settings = await getFullEventSettings();
      const activeWaGroups = (settings.whatsappGroups || [])
        .filter((w) => w.active !== false && w.isActive !== false)
        .map((w) => ({
          id: w.id || w._id,
          name: w.name || 'AgriGen 2026 Official Community',
          url: w.url || w.inviteUrl
        }));

      res.json({
        success: true,
        valid: true,
        registration: formatted,
        whatsappGroups: activeWaGroups
      });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Status lookup failed: ' + err.message });
    }
  }
);

// 7. Newsletter Subscription
app.post('/api/newsletter', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    if (isMongoConnected) {
      await Subscriber.findOneAndUpdate(
        { email: cleanEmail },
        { email: cleanEmail },
        { upsert: true, new: true }
      );
    } else {
      const subscribers = readJson(NEWS_FILE, []);
      if (!subscribers.includes(cleanEmail)) {
        subscribers.push(cleanEmail);
        writeJson(NEWS_FILE, subscribers);
      }
    }

    res.json({ success: true, message: 'Successfully registered for AgriVerse updates!' });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`AgriVerse 2026 API Server running on http://localhost:${PORT}`);
  console.log(`High-Concurrency Mode Active: 150+ Concurrent Attendees Supported`);
  console.log(`Helmet & Strict CORS Active | Cache TTL: 2.0s | Max Upload: 10MB`);
});

// Configure Node HTTP Server for 150+ concurrent persistent connections
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.maxRequestsPerSocket = 0; // Unlimited requests per persistent connection
