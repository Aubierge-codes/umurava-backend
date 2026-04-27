import dotenv from 'dotenv';
import path from 'path';
dotenv.config();


import { Worker, Job } from 'bullmq';
import mongoose from 'mongoose';
import fs from 'fs';
import Redis from 'ioredis';
import Application from './models/application.model';
import JobModel from './models/job.model';
import { extractText } from './utils/pdfParser';
import { scoreCandidate } from './services/gemini.service';

const redisConnection = new Redis('rediss://default:gQAAAAAAATrxAAIgcDI1ZjAzNmM2OGRiZWE0ZTRhOTIyNzBjZTZiOTI1ZDFjYQ@smashing-scorpion-80625.upstash.io:6379', {
  maxRetriesPerRequest: null,
});

function resolveLocalUploadPath(filePathOrUrl: string): string {
  if (fs.existsSync(filePathOrUrl)) return filePathOrUrl;
  const fallback = path.join(__dirname, '..', 'uploads', path.basename(filePathOrUrl));
  if (fs.existsSync(fallback)) return fallback;
  return filePathOrUrl;
}

async function startWorker(): Promise<void> {
  await mongoose.connect(process.env.MONGO_URI as string);
  console.log('✅ Worker connected to MongoDB');

  const isRetryableGeminiError = (err: unknown): boolean => {
    const error = err as { message?: string; status?: number };
    const message = (error.message || '').toLowerCase();
    return (
      error.status === 429 ||
      message.includes('quota') ||
      message.includes('too many requests') ||
      message.includes('error fetching') ||
      message.includes('network') ||
      message.includes('fetch')
    );
  };

  const worker = new Worker(
    'rank',
    async (job: Job) => {
      console.log(`🚀 Processing job: ${job.id}`);

      const app = await Application.findById(job.data.id);
      if (!app) throw new Error('Application not found');

      app.screeningStatus = 'processing';
      await app.save();

      if (!app.files || app.files.length === 0) {
        throw new Error('Application has no uploaded file');
      }

      const filePathOrUrl = app.files[0];

      let resumeText: string;
      if (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://')) {
        console.log('📥 Downloading CV from Cloudinary...');
        resumeText = await extractText(filePathOrUrl);
      } else {
        const filePath = resolveLocalUploadPath(filePathOrUrl);
        if (!fs.existsSync(filePath)) {
          app.screeningStatus = 'failed';
          await app.save();
          throw new Error('File not found: ' + filePath);
        }
        resumeText = await extractText(filePath);
      }

      app.resumeText = resumeText;

      const jobRecord = await JobModel.findById(app.jobId);
      if (!jobRecord) throw new Error('Job not found for this application');

      let aiResult;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          aiResult = await scoreCandidate(resumeText, jobRecord);
          break;
        } catch (err) {
          if (isRetryableGeminiError(err) && attempt < 5) {
            const waitSeconds = attempt * 30;
            const message = (err as Error).message || 'Gemini request failed';
            console.log(`⏳ Gemini retryable error (${message}) — waiting ${waitSeconds}s before retry ${attempt + 1}/5...`);
            await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
          } else {
            throw err;
          }
        }
      }

      if (!aiResult) throw new Error('AI scoring failed after retries');

      app.score           = aiResult.score;
      app.strengths       = aiResult.strengths;
      app.gaps            = aiResult.gaps;
      app.recommendation  = aiResult.recommendation;
      app.summary         = aiResult.summary;
      app.shortlisted     = aiResult.recommendation === 'Shortlist';
      app.screeningStatus = 'done';

      await app.save();
      console.log(`✅ ${app.name} scored ${aiResult.score} → ${aiResult.recommendation}`);

      await new Promise((resolve) => setTimeout(resolve, 2000));
    },
    {
      connection: redisConnection,
    }
  );

  worker.on('failed', async (job: Job | undefined, err: Error) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message.slice(0, 200));
    if (job?.data?.id) {
      await Application.findByIdAndUpdate(job.data.id, { screeningStatus: 'failed' });
    }
  });

  console.log('👀 Worker listening for jobs...');
}

startWorker();