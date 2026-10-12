import mongoose from 'mongoose';

/**
 * Sub-Schema: QRCodeItemSchema
 */
const QRCodeItemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => `qr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    },
    title: {
      type: String,
      default: 'UPI QR Code',
      trim: true
    },
    url: {
      type: String,
      required: true,
      trim: true
    },
    publicId: {
      type: String,
      default: ''
    },
    upiId: {
      type: String,
      default: '',
      trim: true
    },
    active: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },

    // Backward compatibility aliases
    imageUrl: { type: String },
    isActive: { type: Boolean },
    storageProvider: { type: String, default: 'default' }
  },
  { _id: true }
);

QRCodeItemSchema.pre('validate', function () {
  if (this.url && !this.imageUrl) {
    this.imageUrl = this.url;
  } else if (this.imageUrl && !this.url) {
    this.url = this.imageUrl;
  }
  if (this.active !== undefined && this.isActive === undefined) {
    this.isActive = this.active;
  } else if (this.isActive !== undefined && this.active === undefined) {
    this.active = this.isActive;
  }
});

/**
 * Sub-Schema: WhatsAppGroupSchema
 */
const WhatsAppGroupSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => `wa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    url: {
      type: String,
      required: true,
      trim: true
    },
    active: {
      type: Boolean,
      default: true
    },
    order: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    },

    // Backward compatibility aliases
    inviteUrl: { type: String },
    isActive: { type: Boolean },
    priority: { type: Number }
  },
  { _id: true }
);

WhatsAppGroupSchema.pre('validate', function () {
  if (this.url && !this.inviteUrl) {
    this.inviteUrl = this.url;
  } else if (this.inviteUrl && !this.url) {
    this.url = this.inviteUrl;
  }
  if (this.active !== undefined && this.isActive === undefined) {
    this.isActive = this.active;
  } else if (this.isActive !== undefined && this.active === undefined) {
    this.active = this.isActive;
  }
  if (this.order !== undefined && this.priority === undefined) {
    this.priority = this.order;
  } else if (this.priority !== undefined && this.order === undefined) {
    this.order = this.priority;
  }
});

/**
 * EventSettings Schema
 */
const eventSettingsSchema = new mongoose.Schema(
  {
    eventCode: {
      type: String,
      unique: true,
      default: 'AGRIVERSE_2026'
    },
    eventName: {
      type: String,
      default: 'Modern Agriculture: Sustainable Practices, Innovations & Future Farming'
    },
    registrationOpen: {
      type: Boolean,
      default: true
    },
    registrationLimit: {
      type: Number,
      required: true,
      min: 1,
      default: 100
    },
    currentRegistrations: {
      type: Number,
      required: true,
      default: 0
    },
    registrationFee: {
      type: Number,
      min: 0,
      default: 0
    },
    qrCode: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' }
    },
    qrCodes: {
      type: [QRCodeItemSchema],
      default: []
    },
    whatsappGroups: {
      type: [WhatsAppGroupSchema],
      default: []
    },

    // Backward compatibility aliases
    isOpen: {
      type: Boolean,
      default: true
    },
    fee: {
      type: Number,
      default: 0
    },
    whatsappLink: {
      type: String,
      default: 'https://chat.whatsapp.com/invite/AgriVerseUECourse2026'
    }
  },
  {
    timestamps: true,
    collection: 'eventsettings'
  }
);

eventSettingsSchema.pre('validate', function () {
  // Synchronize registrationOpen <-> isOpen
  if (this.registrationOpen !== undefined && this.isOpen === undefined) {
    this.isOpen = this.registrationOpen;
  } else if (this.isOpen !== undefined && this.registrationOpen === undefined) {
    this.registrationOpen = this.isOpen;
  } else if (this.registrationOpen !== undefined && this.isOpen !== undefined) {
    this.isOpen = this.registrationOpen;
  }

  // Synchronize registrationFee <-> fee
  if (this.registrationFee !== undefined && this.fee === undefined) {
    this.fee = this.registrationFee;
  } else if (this.fee !== undefined && this.registrationFee === undefined) {
    this.registrationFee = this.fee;
  } else if (this.registrationFee !== undefined && this.fee !== undefined) {
    this.fee = this.registrationFee;
  }
});

/**
 * Atomic Slot Claim:
 * Atomically increments currentRegistrations if and only if currentRegistrations < registrationLimit
 */
eventSettingsSchema.statics.claimSlotAtomic = async function (eventCode = 'AGRIVERSE_2026') {
  let doc = await this.findOne({ eventCode });
  if (!doc) {
    doc = await this.create({
      eventCode,
      registrationLimit: 1000,
      currentRegistrations: 0,
      registrationOpen: true,
      isOpen: true,
      registrationFee: 0,
      fee: 0
    });
  }

  const isRegOpen = doc.registrationOpen !== false && doc.isOpen !== false;
  if (!isRegOpen) {
    return { success: false, isOpen: false, isFull: false };
  }

  const limit = Math.max(500, Number(doc.registrationLimit || 1000));

  // Atomic lock-free increment at database engine level (prevents Mongoose VersionError under 150+ concurrent bursts)
  const updatedDoc = await this.findOneAndUpdate(
    {
      eventCode,
      $or: [{ registrationOpen: true }, { isOpen: true }],
      currentRegistrations: { $lt: limit }
    },
    {
      $inc: { currentRegistrations: 1 }
    },
    { new: true }
  );

  if (!updatedDoc) {
    const current = await this.findOne({ eventCode });
    const full = current ? current.currentRegistrations >= limit : false;
    return {
      success: false,
      isFull: full,
      isOpen: current ? (current.registrationOpen !== false && current.isOpen !== false) : false
    };
  }

  return { success: true, settings: updatedDoc };
};

const EventSettings = mongoose.model('EventSettings', eventSettingsSchema, 'eventsettings');
export default EventSettings;
