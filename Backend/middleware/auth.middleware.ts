import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import bcrypt from 'bcryptjs';
import User, { IUser } from '../models/user.models';
import tokenBlacklist from '../utils/tokenBlacklist';

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export const signupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const schema = Joi.object({
      name: Joi.string().min(2).max(50).required(),
      companyName: Joi.string().max(100).optional().allow(''),
      email: Joi.string().email().trim().lowercase().required(),
      password: Joi.string()
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/)
        .required()
        .messages({
          'string.pattern.base':
            'Password must be at least 8 characters and include uppercase, lowercase, number, and special character',
        }),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      res.status(400).json({ message: error.details[0].message });
      return;
    }

    const exists = await User.findOne({ email: value.email });
    if (exists) {
      res.status(400).json({ message: 'Email already registered' });
      return;
    }

    value.password = await bcrypt.hash(value.password, 12);
    req.body = value;
    next();
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const loginValidation = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const schema = Joi.object({
    email: Joi.string().email().trim().lowercase().required(),
    password: Joi.string().min(8).required(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }

  req.body = value;
  next();
};

export const generateToken = (user: IUser): string => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET as string,
    { expiresIn: '1d' }
  );
};

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized — no token' });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (await tokenBlacklist.has(token)) {
    res.status(401).json({ message: 'Token expired, please login again' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; role: string };
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }
    req.user = user as IUser;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const adminOnly = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ message: 'Admin access only' });
    return;
  }
  next();
};
