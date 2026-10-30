import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load environment variables safely from project root .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// 2. Configure Multer for in-memory file uploads (Images & Audio up to 15MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15 MB maximum file size (allows audio lectures)
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      // Images
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      // Audio
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/wave',
      'audio/m4a',
      'audio/x-m4a',
      'audio/mp4',
      'audio/aac',
      'audio/ogg',
      'audio/webm'
    ];

    const hasAllowedExt = Boolean(file.originalname.match(/\.(png|jpe?g|webp|mp3|wav|m4a|aac|ogg|webm)$/i));

    if (allowedMimeTypes.includes(file.mimetype) || hasAllowedExt) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Supported files: PNG, JPG, WEBP, MP3, WAV, M4A, AAC, and OGG.'));
    }
  }
});

// 3. Middleware to parse JSON bodies and serve static frontend files from ../frontend
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// 4. Check if Gemini API Key is provided (Never display or log the key)
const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
const isMockMode = !apiKey;

let ai = null;
if (!isMockMode) {
  ai = new GoogleGenAI({ apiKey });
  console.log('✅ Connected to Google Gemini API.');
} else {
  console.log('ℹ️ Running in Mock Mode (No GEMINI_API_KEY found in .env).');
  console.log('   Simulated responses will be returned for UI testing.');
}

// 5. API endpoint to report server status to the frontend
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    mode: isMockMode ? 'mock' : 'live',
    message: isMockMode
      ? 'Mock Mode Active (No API key needed for testing)'
      : 'Gemini AI Connected'
  });
});

// 6. Unified Multimodal Chat Endpoint (Text, Image Analysis, Audio Transcription & Summary)
app.post(
  '/api/chat',
  (req, res, next) => {
    // Handle multipart uploads accepting 'image', 'audio', or 'file'
    upload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'audio', maxCount: 1 },
      { name: 'file', maxCount: 1 }
    ])(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File exceeds the 15MB size limit. Please upload a smaller file.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const message = req.body?.message ? req.body.message.trim() : '';
      const mode = req.body?.mode || 'summarize'; // 'transcribe' or 'summarize'
      const file = req.files?.audio?.[0] || req.files?.image?.[0] || req.files?.file?.[0];

      // Validate that the user sent at least text OR a file
      if (!message && !file) {
        return res.status(400).json({ error: 'Please enter a question or upload a file (image or audio).' });
      }

      const isAudio = Boolean(
        file && (file.mimetype.startsWith('audio/') || file.originalname.match(/\.(mp3|wav|m4a|aac|ogg|webm)$/i))
      );
      const isImage = Boolean(file && !isAudio);

      // ==========================================
      // A. MOCK MODE (When no API key is set)
      // ==========================================
      if (isMockMode) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const fileSizeKb = file ? (file.size / 1024).toFixed(1) : '0';

        if (isAudio) {
          if (mode === 'transcribe') {
            return res.json({
              reply: `🎙️ [Study Buddy Mock Mode - Audio Transcription]\n\n` +
                     `Uploaded File: "${file.originalname}" (${fileSizeKb} KB)\n` +
                     `Mode: Verbatim Transcription\n\n` +
                     `📝 Simulated Transcript:\n` +
                     `"Welcome everyone to today's study session. Today we are reviewing binary search trees, asymptotic notation, and graph traversals. Remember that binary search operates in O(log n) logarithmic time on sorted datasets..."\n\n` +
                     `ℹ️ To transcribe real audio recordings with Google Gemini speech models, add your GEMINI_API_KEY to .env!`
            });
          } else {
            return res.json({
              reply: `🎙️ [Study Buddy Mock Mode - Audio Summary & Study Notes]\n\n` +
                     `Uploaded File: "${file.originalname}" (${fileSizeKb} KB)\n` +
                     `Mode: Summary & Study Guide\n\n` +
                     `📝 Executive Summary:\n` +
                     `The lecture introduces fundamental computer science search algorithms, emphasizing the efficiency difference between linear search and binary search.\n\n` +
                     `🎯 Key Concepts & Definitions:\n` +
                     `• Binary Search: A divide-and-conquer algorithm with O(log n) time complexity.\n` +
                     `• Requirement: The input collection MUST be sorted beforehand.\n\n` +
                     `❓ Review / Study Questions:\n` +
                     `1. Why does binary search require a sorted array?\n` +
                     `2. What is the worst-case space complexity of recursive binary search?\n\n` +
                     `ℹ️ Add your GEMINI_API_KEY to .env to transcribe and summarize your real lecture audio!`
            });
          }
        }

        if (isImage) {
          return res.json({
            reply: `🖼️ [Study Buddy Mock Mode - Visual Analysis]\n\n` +
                   `Received Image: "${file.originalname}" (${fileSizeKb} KB)\n` +
                   `Question: "${message || 'Describe and explain this image for a student.'}"\n\n` +
                   `Simulated Analysis: The server validated your image. In Live Mode, Gemini Vision will explain diagrams and formulas. Add your GEMINI_API_KEY to .env!`
          });
        }

        return res.json({
          reply: `📚 [Study Buddy Mock Mode]\n\n` +
                 `You asked: "${message}"\n\n` +
                 `Your message reached the local server! Add your GEMINI_API_KEY to .env for real AI responses.`
        });
      }

      // ==========================================
      // B. LIVE GEMINI MODE
      // ==========================================
      let contents;

      if (isAudio) {
        // Format audio for Gemini native audio comprehension
        const base64Audio = file.buffer.toString('base64');

        // Normalize MIME type for Gemini
        let mimeType = file.mimetype;
        if (file.originalname.endsWith('.m4a') || mimeType.includes('m4a')) {
          mimeType = 'audio/mp4';
        } else if (file.originalname.endsWith('.mp3')) {
          mimeType = 'audio/mp3';
        } else if (file.originalname.endsWith('.wav')) {
          mimeType = 'audio/wav';
        }

        let audioPrompt;
        if (mode === 'transcribe') {
          audioPrompt = message
            ? `Please transcribe this audio recording accurately verbatim, and also answer the student's question: "${message}".`
            : `Please provide a clean, accurate, verbatim transcription of this audio recording. Format with paragraphs or speaker markers where appropriate.`;
        } else {
          audioPrompt = message
            ? `Please listen to this audio recording, answer this specific question: "${message}", and then generate structured study notes from the speech.`
            : `Please listen to this audio lecture or recording and generate a comprehensive student study guide with:
1. 📝 Clean Transcription / Summary of spoken points
2. 💡 Executive Summary of core topics
3. 🎯 Key Terms, Definitions & Concepts
4. ❓ 3 Review / Study Questions to test comprehension`;
        }

        contents = [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Audio
                }
              },
              {
                text: audioPrompt
              }
            ]
          }
        ];

      } else if (isImage) {
        // Format image for Gemini Vision
        const base64Image = file.buffer.toString('base64');
        const imagePrompt = message || 'Describe and explain this image clearly for a student.';

        contents = [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: file.mimetype,
                  data: base64Image
                }
              },
              {
                text: imagePrompt
              }
            ]
          }
        ];

      } else {
        // Text-only query
        contents = message;
      }

      // Try current models with automatic fallback (gemini-3.5-flash-lite is fastest with highest free quota)
      const modelsToTry = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
      let response = null;
      let lastError = null;

      for (const modelName of modelsToTry) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction:
                'You are "Study Buddy", a patient, friendly, and helpful college tutor. ' +
                'When analyzing text, images, or audio recordings (lectures, voice notes), ' +
                'explain clearly, accurately, and concisely with structured formatting and simple examples.'
            }
          });
          if (response && response.text) break;
        } catch (err) {
          lastError = err;
          console.warn(`[Study Buddy] Notice: Model "${modelName}" failed, trying next candidate...`);
        }
      }

      if (!response || !response.text) {
        throw lastError || new Error('No response could be generated from the AI service.');
      }

      const replyText = response.text;
      res.json({ reply: replyText });

    } catch (error) {
      console.error('Server error handling request:', error.message || error);

      let userMessage = 'An unexpected server error occurred. Please try again.';
      const msg = error.message || '';
      if (msg.includes('API key') || msg.includes('401') || msg.includes('403')) {
        userMessage = 'Authentication Error: Invalid or expired Gemini API key. Please check your .env file.';
      } else if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        userMessage = 'API Quota Exceeded (429): Your free tier rate limit or quota was reached. Please wait a moment and try again.';
      } else if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
        userMessage = 'Google Gemini is temporarily experiencing high demand (503). Please wait a few seconds and try again.';
      } else if (msg) {
        userMessage = `AI Service Error: ${msg}`;
      }

      res.status(500).json({ error: userMessage });
    }
  }
);

// 7. Start the server
app.listen(PORT, () => {
  console.log(`\n🚀 Study Buddy Chat server is running!`);
  console.log(`👉 Open your browser at: http://localhost:${PORT}\n`);
});

