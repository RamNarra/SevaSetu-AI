import { GoogleGenAI } from '@google/genai';

const useVertexAI = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';

export const genai = new GoogleGenAI(
  useVertexAI
    ? {
        vertexai: true,
        project: process.env.GOOGLE_CLOUD_PROJECT!,
        location: process.env.GOOGLE_CLOUD_LOCATION!,
      }
    : {
        apiKey: process.env.GEMINI_API_KEY!,
      }
);

export const MODEL = 'gemini-3.0-flash';
