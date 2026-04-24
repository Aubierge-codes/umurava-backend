import { Router, Request, Response } from 'express';
import upload from '../middleware/upload.middleware';
import { authenticate, adminOnly } from '../middleware/auth.middleware';
import {
  applyJob,
  getTopCandidates,
  getApplicationStatus,
  getMyApplications,
} from '../controllers/application.controller';
import Job from '../models/job.model';

const router = Router();

// ─── PUBLIC ROUTES ────────────────────────────────────────────────

router.get('/jobs', async (_req: Request, res: Response) => {
  try {
    const jobs = await Job.find({ isActive: true })
      .sort({ createdAt: -1 })
      .select('title description location employmentType experienceLevel requiredSkills');
    res.json({ total: jobs.length, jobs });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});

router.get('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, isActive: true });
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
    res.json(job);
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});

// ─── ADMIN ONLY — CV SUBMISSION ───────────────────────────────────

router.post('/apply', authenticate, adminOnly, upload.array('cvs', 20), applyJob);

// ─── ADMIN ROUTES ─────────────────────────────────────────────────

router.get('/top/:jobId', authenticate, adminOnly, getTopCandidates);
router.get('/my', authenticate, adminOnly, getMyApplications);
router.get('/status/:id', authenticate, adminOnly, getApplicationStatus);

export default router;
