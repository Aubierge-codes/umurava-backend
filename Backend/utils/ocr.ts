import Tesseract from 'tesseract.js';

export async function extractTextFromImage(filePath: string): Promise<string> {
  const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
  return text;
}
