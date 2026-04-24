import { Router, Request, Response } from 'express';
import { authenticate, adminOnly } from '../middleware/auth.middleware';
import Job from '../models/job.model';
import Application from '../models/application.model';

const router = Router();
const protect = [authenticate, adminOnly];

// ─── DASHBOARD ────────────────────────────────────────────────────

router.get('/dashboard', protect, async (req: Request, res: Response) => {
  try {
    const adminJobs = await Job.find({ createdBy: req.user!._id, isActive: true });
    const jobIds = adminJobs.map((j) => j._id);

    const totalCandidates = await Application.countDocuments({ jobId: { $in: jobIds } });
    const openPositions = adminJobs.length;
    const topRanked = await Application.countDocuments({
      jobId: { $in: jobIds },
      score: { $gte: 80 },
    });

    const scoreData = await Application.find(
      { jobId: { $in: jobIds }, score: { $ne: null } },
      'score'
    );
    const avgScore = scoreData.length
      ? Math.round(scoreData.reduce((sum, a) => sum + (a.score ?? 0), 0) / scoreData.length)
      : 0;

    res.json({ totalCandidates, openPositions, topRanked, avgScore });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});

// ─── TOP CANDIDATES ACROSS ALL JOBS ──────────────────────────────

router.get('/top-candidates', protect, async (req: Request, res: Response) => {
  try {
    const adminJobs = await Job.find({ createdBy: req.user!._id });
    const jobIds = adminJobs.map((j) => j._id);

    const { jobId } = req.query as { jobId?: string };

    if (jobId) {
      const ownedJob = await Job.findOne({ _id: jobId, createdBy: req.user!._id });
      if (!ownedJob) {
        res.status(403).json({ error: 'Job not found or not yours' });
        return;
      }
    }

    const filter: Record<string, unknown> = {
      jobId: jobId ? jobId : { $in: jobIds },
      screeningStatus: 'done',
    };

    const candidates = await Application.find(filter)
      .sort({ score: -1 })
      .select('-resumeText -files')
      .populate('jobId', 'title');

    const ranked = candidates.map((c, i) => ({ rank: i + 1, ...c.toObject() }));
    res.json({ total: ranked.length, candidates: ranked });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});

// ─── JOB MANAGEMENT ──────────────────────────────────────────────

router.post('/job', protect, async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;
    if (!title || !title.trim()) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    if (!description || !description.trim()) {
      res.status(400).json({ error: 'description is required' });
      return;
    }
    const job = await Job.create({ ...req.body, createdBy: req.user!._id });
    res.status(201).json(job);
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});

router.get('/jobs', protect, async (req: Request, res: Response) => {
  try {
    const jobs = await Job.find({ isActive: true, createdBy: req.user!._id }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});

router.put('/job/:id', protect, async (req: Request, res: Response) => {
  try {
    const { title, description, requiredSkills, experienceLevel, educationRequired,
            location, employmentType, shortlistLimit, isActive } = req.body;

    const allowedUpdates = {
      title, description, requiredSkills, experienceLevel,
      educationRequired, location, employmentType, shortlistLimit, isActive,
    };

    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user!._id },
      allowedUpdates,
      { new: true, runValidators: true }
    );

    if (!job) { res.status(404).json({ error: 'Job not found or not yours' }); return; }
    res.json(job);
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});

router.delete('/job/:id', protect, async (req: Request, res: Response) => {
  try {
    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user!._id },
      { isActive: false }
    );
    if (!job) { res.status(404).json({ error: 'Job not found or not yours' }); return; }
    res.json({ message: 'Job deactivated' });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});

// ─── APPLICATIONS ─────────────────────────────────────────────────

router.get('/applications/:jobId', protect, async (req: Request, res: Response) => {
  try {
    const job = await Job.findOne({ _id: req.params.jobId, createdBy: req.user!._id });
    if (!job) { res.status(404).json({ error: 'Job not found or not yours' }); return; }

    const apps = await Application.find({ jobId: req.params.jobId })
      .sort({ score: -1 })
      .select('-resumeText');
    res.json(apps);
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});

export default router;
