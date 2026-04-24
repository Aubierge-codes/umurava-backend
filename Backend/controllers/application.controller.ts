import { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Application from '../models/application.model';
import Job from '../models/job.model';
import rankingQueue from '../queues/ranking.queue';
import { extractText } from '../utils/pdfParser';
import { scoreCandidate } from '../services/gemini.service';

function resolveLocalUploadPath(filePathOrUrl: string): string {
  if (fs.existsSync(filePathOrUrl)) return filePathOrUrl;

  const fallback = path.join(__dirname, '..', 'uploads', path.basename(filePathOrUrl));
  if (fs.existsSync(fallback)) return fallback;

  return filePathOrUrl;
}

function getFileHash(file: Express.Multer.File): string {
  const filePathOrUrl: string = (file as any).path;

  // Cloudinary URL — hash the URL + original name (no download needed)
  if (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://')) {
    return crypto.createHash('sha256').update(filePathOrUrl).digest('hex');
  }

  // Local disk — hash the actual file content
  const buffer = fs.readFileSync(resolveLocalUploadPath(filePathOrUrl));
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function scoreApplicationNow(applicationId: string): Promise<void> {
  const app = await Application.findById(applicationId);
  if (!app) {
    throw new Error('Application not found');
  }

  if (!app.files || app.files.length === 0) {
    throw new Error('Application has no uploaded file');
  }

  const filePathOrUrl = app.files[0];
  const filePath = filePathOrUrl.startsWith('http')
    ? filePathOrUrl
    : resolveLocalUploadPath(filePathOrUrl);

  const jobRecord = await Job.findById(app.jobId);
  if (!jobRecord) {
    throw new Error('Job not found for this application');
  }

  app.screeningStatus = 'processing';
  await app.save();

  const resumeText = await extractText(filePath);
  const aiResult = await scoreCandidate(resumeText, jobRecord);

  app.resumeText = resumeText;
  app.score = aiResult.score;
  app.strengths = aiResult.strengths;
  app.gaps = aiResult.gaps;
  app.recommendation = aiResult.recommendation;
  app.summary = aiResult.summary;
  app.shortlisted = aiResult.recommendation === 'Shortlist';
  app.screeningStatus = 'done';
  await app.save();
}

// POST /api/applications/apply — Admin only: upload CVs on behalf of candidates
export const applyJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobId, candidateName, candidateEmail } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!candidateName || !candidateName.trim()) {
      res.status(400).json({ error: 'candidateName is required' });
      return;
    }
    if (!candidateEmail || !candidateEmail.trim()) {
      res.status(400).json({ error: 'candidateEmail is required' });
      return;
    }
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'At least one CV file is required' });
      return;
    }

    const job = await Job.findById(jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const results: { file: string; status: string; id?: unknown }[] = [];

    for (const file of files) {
      const filePathOrUrl: string = (file as any).path;
      const fileHash = getFileHash(file);

      const exists = await Application.findOne({ jobId, fileHash });
      if (exists) {
        if (!filePathOrUrl.startsWith('http')) {
          const resolvedPath = resolveLocalUploadPath(filePathOrUrl);
          if (fs.existsSync(resolvedPath)) fs.unlink(resolvedPath, () => {});
        }
        results.push({ file: file.originalname, status: 'duplicate - skipped' });
        continue;
      }

      const application = await Application.create({
        userId: null,
        name: candidateName.trim(),
        email: candidateEmail.trim().toLowerCase(),
        jobId,
        files: [filePathOrUrl],
        fileHash,
        screeningStatus: 'pending',
      });

      try {
        await rankingQueue.add(
          'rank',
          { id: application._id.toString() },
          { attempts: 1 }
        );

        results.push({ file: file.originalname, status: 'queued', id: application._id });
      } catch (queueErr) {
        console.warn('Queue unavailable, scoring immediately:', (queueErr as Error).message);
        await scoreApplicationNow(application._id.toString());
        results.push({ file: file.originalname, status: 'scored immediately', id: application._id });
      }
    }

    res.status(201).json({ message: `${results.length} CV(s) processed`, results });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
};

// GET /api/applications/my — admin sees all applications for their jobs
export const getMyApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminJobs = await Job.find({ createdBy: req.user!._id }).select('_id');
    const jobIds = adminJobs.map((job) => job._id);

    const apps = await Application.find({ jobId: { $in: jobIds } })
      .populate('jobId', 'title location employmentType')
      .select('-resumeText -files')
      .sort({ createdAt: -1 });

    res.json({ total: apps.length, applications: apps });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
};

// GET /api/applications/top/:jobId — admin only
export const getTopCandidates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobId } = req.params;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const job = await Job.findOne({ _id: jobId, createdBy: req.user!._id });
    if (!job) {
      res.status(404).json({ error: 'Job not found or not yours' });
      return;
    }

    const candidates = await Application.find({ jobId, screeningStatus: 'done' })
      .sort({ score: -1 })
      .limit(limit)
      .select('-resumeText -files');

    const ranked = candidates.map((c, i) => ({ rank: i + 1, ...c.toObject() }));
    res.json({ total: ranked.length, candidates: ranked });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch top candidates' });
  }
};

// GET /api/applications/status/:id — admin polls any application status
export const getApplicationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const app = await Application.findById(req.params.id).select(
      'name screeningStatus score recommendation jobId'
    );

    if (!app) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    const job = await Job.findOne({ _id: app.jobId, createdBy: req.user!._id });
    if (!job) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({
      name: app.name,
      screeningStatus: app.screeningStatus,
      score: app.score,
      recommendation: app.recommendation,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch application status' });
  }
};
