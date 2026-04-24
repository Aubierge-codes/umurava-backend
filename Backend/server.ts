import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'Backend', '.env') });

import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';




import authRoutes from './routes/auth.routes';
import applicationRoutes from './routes/application.routes';
import adminRoutes from './routes/admin.routes';
import adminRequestRoutes from './routes/adminRequest.routes';


const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);
app.use(express.json());

// DB
mongoose
  .connect(process.env.MONGO_URI as string)
  .then(() => console.log('✅ DB connected'))
  .catch((err: Error) => {
    console.error('❌ DB error:', err);
    process.exit(1);
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin-requests', adminRequestRoutes);

// Health check
app.get('/', (_req: Request, res: Response) => res.json({ status: 'API running 🚀' }));

// Global error handler
app.use((err: Error & { code?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message === 'Only PDF files are allowed') {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Max size is 5MB.' });
  }
  if (err.code === 'LIMIT_FIELD_KEY') {
    return res.status(400).json({ error: 'Field name missing in form data.' });
  }
  if (err.message === 'Field name missing') {
    return res.status(400).json({ error: 'Use cvs as the file field name in form-data.' });
  }
  console.error('❌ Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(process.env.PORT || 5000, () =>
  console.log(`🚀 Server on port ${process.env.PORT || 5000}`)
);
