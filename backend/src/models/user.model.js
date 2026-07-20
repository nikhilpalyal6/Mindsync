import mongoose from 'mongoose';
import { ROLES, DEFAULT_ROLE, AUTH_PROVIDERS } from '../constants/index.js';
import { hashPassword, comparePassword } from '../utils/password.utils.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    profileImage: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      default: '',
    },
    role: {
      type: String,
      enum: {
        values: Object.values(ROLES),
        message: '{VALUE} is not a valid role',
      },
      default: DEFAULT_ROLE,
    },
    provider: {
      type: String,
      enum: {
        values: Object.values(AUTH_PROVIDERS),
        message: '{VALUE} is not a valid auth provider',
      },
      default: AUTH_PROVIDERS.LOCAL,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    appleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    lastPasswordChanged: {
      type: Date,
      default: null,
    },
    refreshToken: {
      type: String,
      select: false,
      default: null,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    emailVerificationToken: {
      type: String,
      select: false,
      default: null,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
      default: null,
    },
    passwordResetToken: {
      type: String,
      select: false,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationExpires;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationExpires;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

userSchema.pre('save', async function hashUserPassword(next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    this.password = await hashPassword(this.password);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function compareUserPassword(candidatePassword) {
  return comparePassword(candidatePassword, this.password);
};

userSchema.methods.updateLastLogin = async function updateUserLastLogin() {
  this.lastLogin = new Date();
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.clearRefreshToken = async function clearUserRefreshToken() {
  this.refreshToken = null;
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.storeRefreshToken = async function storeUserRefreshToken(token) {
  this.refreshToken = token;
  await this.save({ validateBeforeSave: false });
};

userSchema.statics.findByEmail = function findUserByEmail(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByUsername = function findUserByUsername(username) {
  return this.findOne({ username: username.toLowerCase() });
};

userSchema.statics.findByEmailOrUsername = function findUserByEmailOrUsername(identifier) {
  const lowerIdentifier = identifier.toLowerCase();
  return this.findOne({
    $or: [{ email: lowerIdentifier }, { username: lowerIdentifier }],
  });
};

userSchema.methods.incrementFailedLoginAttempts = async function incrementFailedLoginAttempts() {
  this.failedLoginAttempts += 1;
  if (this.failedLoginAttempts >= 5) {
    this.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
  }
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.resetFailedLoginAttempts = async function resetFailedLoginAttempts() {
  this.failedLoginAttempts = 0;
  this.lockUntil = null;
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.isAccountLocked = function isAccountLocked() {
  return this.lockUntil && this.lockUntil > Date.now();
};

userSchema.methods.setEmailVerificationToken = async function setEmailVerificationToken(token) {
  this.emailVerificationToken = token;
  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.clearEmailVerificationToken = async function clearEmailVerificationToken() {
  this.emailVerificationToken = null;
  this.emailVerificationExpires = null;
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.setPasswordResetToken = async function setPasswordResetToken(token) {
  this.passwordResetToken = token;
  this.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.clearPasswordResetToken = async function clearPasswordResetToken() {
  this.passwordResetToken = null;
  this.passwordResetExpires = null;
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.markEmailVerified = async function markEmailVerified() {
  this.isVerified = true;
  this.emailVerificationToken = null;
  this.emailVerificationExpires = null;
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.setPassword = async function setPassword(newPassword) {
  this.password = newPassword;
  this.lastPasswordChanged = new Date();
  this.passwordResetToken = null;
  this.passwordResetExpires = null;
  await this.save();
};

userSchema.methods.softDelete = async function softDelete() {
  this.isActive = false;
  await this.save({ validateBeforeSave: false });
};

const User = mongoose.model('User', userSchema);

export default User;
