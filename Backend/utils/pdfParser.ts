import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';  // ← add this import

function isCloudinaryUrl(url: string): boolean {
  return url.includes('res.cloudinary.com');
}

function getPublicIdFromUrl(url: string): string {
  const match = url.match(/\/raw\/upload\/(?:v\d+\/)?(.+)$/);
  if (!match) return '';
  // ✅ Keep the .pdf extension for raw resources
  return match[1];
}

async function downloadCloudinaryFile(url: string): Promise<Buffer> {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const publicId = getPublicIdFromUrl(url);
  console.log('🔑 Public ID:', publicId);

  // Generate signed URL using cloudinary.url() — most reliable method
  const signedUrl = cloudinary.url(publicId, {
    resource_type: 'raw',
    sign_url: true,
    secure: true,
    type: 'upload',
    expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  });

  console.log('🔑 Signed URL:', signedUrl);

  const response = await axios.get<ArrayBuffer>(signedUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });
  return Buffer.from(response.data);
}

// ← everything else stays exactly the same below
function resolveLocalPdfPath(inputPath: string): string {
  if (fs.existsSync(inputPath)) return inputPath;
  const fallback = path.join(__dirname, '..', 'uploads', path.basename(inputPath));
  if (fs.existsSync(fallback)) return fallback;
  return inputPath;
}

export async function extractText(input: string | Buffer): Promise<string> {
  try {
    let buffer: Buffer;

    if (Buffer.isBuffer(input)) {
      buffer = input;
    } else if (typeof input === 'string') {
      if (input.startsWith('http://') || input.startsWith('https://')) {
        console.log('📥 Downloading PDF from:', input);
        if (isCloudinaryUrl(input)) {
          buffer = await downloadCloudinaryFile(input);
        } else {
          const response = await axios.get<ArrayBuffer>(input, {
            responseType: 'arraybuffer',
            timeout: 30000,
          });
          buffer = Buffer.from(response.data);
        }
      } else {
        buffer = fs.readFileSync(resolveLocalPdfPath(input));
      }
    } else {
      throw new Error('Input must be a file path, URL, or Buffer');
    }

    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (err) {
    const error = err as Error;
    console.error('❌ PDF parse error:', error.message);
    throw err;
  }
}