import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema(
  {
    registrationId: {
      type: String,
      required: [true, 'Registration ID is required'],
      trim: true,
      uppercase: true
    },
    fullName: {
      type: String,
      required: [true, 'Full Name is required'],
      trim: true
    },
    registerNumber: {
      type: String,
      required: [true, 'Register Number is required'],
      uppercase: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    phone: {
      type: String,
      trim: true,
      default: 'N/A'
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true
    },
    section: {
      type: String,
      required: [true, 'Section is required'],
      uppercase: true,
      trim: true
    },
    year: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true
    },
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      enum: ['Male', 'Female', 'Other']
    },
    residency: {
      type: String,
      required: true,
      enum: ['Hosteler', 'Dayscholar', 'Hosteller', 'Day Scholar'],
      default: 'Dayscholar'
    },
    registrationStatus: {
      type: String,
      enum: ['registered', 'cancelled'],
      default: 'registered'
    },
    transactionId: {
      type: String,
      uppercase: true,
      trim: true,
      default: null
    },
    paymentScreenshot: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
      storageProvider: { type: String, default: 'none' }
    },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PAID'],
      default: 'UNPAID',
      index: true
    },
    verificationStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING',
      index: true
    },
    paymentDate: {
      type: Date,
      default: null
    },
    rejectionReason: {
      type: String,
      default: ''
    },
    registeredAt: {
      type: Date,
      default: Date.now
    },
    verifiedAt: {
      type: Date,
      default: null
    },

    // Backward compatibility aliases & supplemental fields
    id: {
      type: String,
      trim: true,
      index: true
    },
    name: {
      type: String,
      trim: true
    },
    regNo: {
      type: String,
      uppercase: true,
      trim: true,
      index: true
    },
    branch: {
      type: String,
      trim: true
    },
    txnId: {
      type: String,
      uppercase: true,
      trim: true,
      sparse: true,
      index: true
    },
    proofUrl: {
      type: String,
      default: null
    },
    proofPublicId: {
      type: String,
      default: null
    },
    storageProvider: {
      type: String,
      enum: ['cloudinary', 'local', 'none'],
      default: 'none'
    },
    college: {
      type: String,
      trim: true,
      default: 'KLU / AgriGen Campus'
    },
    track: {
      type: String,
      default: 'AgriVerse: UE Course'
    },
    gate: {
      type: String,
      default: 'Admin Block Seminar Hall'
    },
    status: {
      type: String,
      enum: ['VERIFIED', 'PENDING_PAYMENT', 'PENDING_AUDIT', 'REJECTED'],
      default: 'PENDING_PAYMENT'
    },
    paymentMode: {
      type: String,
      enum: ['PAY_NOW', 'PAY_LATER', 'OFFLINE_WALKIN', 'OFFLINE'],
      default: 'PAY_LATER'
    },
    adminNotes: {
      type: String,
      default: ''
    },
    joinedWhatsapp: {
      type: String,
      enum: ['Yes', 'No', ''],
      default: 'Yes'
    }
  },
  {
    timestamps: true,
    collection: 'registrations'
  }
);

// Key Schema Indexes:
registrationSchema.index({ registerNumber: 1 }, { unique: true });
registrationSchema.index({ registrationId: 1 }, { unique: true });
registrationSchema.index(
  { transactionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      transactionId: { $type: 'string' }
    }
  }
);
registrationSchema.index({ createdAt: -1 });

// Mongoose Validation & Pre-Save Hooks
registrationSchema.pre('validate', function () {
  // Synchronize fullName <-> name
  if (this.fullName) {
    this.fullName = this.fullName.trim();
    if (!this.name) this.name = this.fullName;
  } else if (this.name) {
    this.fullName = this.name.trim();
  }

  // Synchronize registerNumber <-> regNo
  if (this.registerNumber) {
    this.registerNumber = this.registerNumber.trim().toUpperCase();
    if (!this.regNo) this.regNo = this.registerNumber;
  } else if (this.regNo) {
    this.registerNumber = this.regNo.trim().toUpperCase();
  }

  // Primary identifier: stores uppercased Register Number
  if (!this.registrationId) {
    this.registrationId = this.registerNumber || this.regNo || (this.id ? this.id.trim().toUpperCase() : '');
  } else {
    this.registrationId = this.registrationId.trim().toUpperCase();
  }

  // Synchronize legacy id
  if (!this.id) {
    this.id = this.registrationId;
  }

  // Clean strings
  if (this.email) {
    this.email = this.email.trim().toLowerCase();
  } else if (this.email === undefined || this.email === null) {
    this.email = '';
  }

  if (this.phone) {
    this.phone = this.phone.trim();
  } else if (this.phone === undefined || this.phone === null) {
    this.phone = 'N/A';
  }

  if (this.department) {
    this.department = this.department.trim();
    if (!this.branch) this.branch = this.department;
  } else if (this.branch) {
    this.department = this.branch.trim();
  }

  if (this.section) {
    this.section = this.section.trim().toUpperCase();
  }

  if (this.year) {
    this.year = this.year.trim();
  }

  // Synchronize transactionId <-> txnId
  const rawTxn = (this.transactionId || this.txnId || '').trim().toUpperCase();
  if (rawTxn) {
    this.transactionId = rawTxn;
    this.txnId = rawTxn;
  } else {
    this.transactionId = undefined;
    this.txnId = undefined;
  }

  // Synchronize paymentScreenshot <-> proofUrl
  if (!this.paymentScreenshot) {
    this.paymentScreenshot = { url: '', publicId: '', storageProvider: 'none' };
  }
  if (this.proofUrl && !this.paymentScreenshot.url) {
    this.paymentScreenshot.url = this.proofUrl;
    if (this.proofPublicId) this.paymentScreenshot.publicId = this.proofPublicId;
  } else if (this.paymentScreenshot.url && !this.proofUrl) {
    this.proofUrl = this.paymentScreenshot.url;
    if (this.paymentScreenshot.publicId) this.proofPublicId = this.paymentScreenshot.publicId;
  }

  // Timestamps & Status synchronizations
  if (!this.registeredAt) {
    this.registeredAt = this.createdAt || new Date();
  }

  if (this.verificationStatus === 'VERIFIED' || this.verificationStatus === 'REJECTED') {
    if (!this.verifiedAt) {
      this.verifiedAt = new Date();
    }
    this.status = this.verificationStatus;
  } else if (this.status === 'VERIFIED' || this.status === 'REJECTED') {
    this.verificationStatus = this.status;
    if (!this.verifiedAt) {
      this.verifiedAt = new Date();
    }
  }

  if (this.paymentStatus === 'PAID') {
    if (!this.paymentDate) {
      this.paymentDate = new Date();
    }
    if (this.status === 'PENDING_PAYMENT') {
      this.status = 'PENDING_AUDIT';
    }
  }
});

// High-concurrency query optimization indexes (avoids full-collection scans under heavy load)
registrationSchema.index({ email: 1 });
registrationSchema.index({ phone: 1 });
registrationSchema.index({ status: 1, paymentStatus: 1 });

const Registration = mongoose.model('Registration', registrationSchema, 'registrations');
export default Registration;
