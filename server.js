import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ── Gold price bot ─────────────────────────────────────────────────────────
const BOT_DIR = path.resolve('D:/AI_training/gold_price_bot');
const HISTORY_FILE = path.join(BOT_DIR, 'output', 'history.json');

app.get('/api/gold/refresh', (req, res) => {
  console.log('Triggering gold price bot...');
  const botProcess = spawn('python', ['get_web_data.py'], { cwd: BOT_DIR });

  let outputData = '';
  let errorData = '';

  botProcess.stdout.on('data', (data) => { outputData += data.toString(); });
  botProcess.stderr.on('data', (data) => { errorData += data.toString(); });

  botProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Bot exited with code ${code}. Error: ${errorData}`);
      if (fs.existsSync(HISTORY_FILE)) {
        try {
          const fileData = fs.readFileSync(HISTORY_FILE, 'utf-8');
          const historyItems = JSON.parse(fileData);
          return res.json({
            success: true,
            stale: true,
            stale_reason: 'Bot process failed — showing cached data',
            current: historyItems[historyItems.length - 1],
            history: historyItems.slice(-30)
          });
        } catch (e) { /* fall through */ }
      }
      return res.status(500).json({ error: 'Bot failed to process', details: errorData });
    }

    try {
      const botResult = JSON.parse(outputData.trim());
      const lastHistoryDate = botResult.current?.post_date;
      const now = new Date();
      const today = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
      const isStale = lastHistoryDate && lastHistoryDate !== today;
      return res.json({ ...botResult, stale: isStale });
    } catch (parseErr) {
      console.error('Failed to parse bot stdout:', parseErr, '\nRaw output:', outputData);
      try {
        if (fs.existsSync(HISTORY_FILE)) {
          const fileData = fs.readFileSync(HISTORY_FILE, 'utf-8');
          const historyItems = JSON.parse(fileData);
          return res.json({
            success: true,
            stale: true,
            stale_reason: 'Could not parse bot output — showing cached data',
            current: historyItems[historyItems.length - 1],
            history: historyItems.slice(-30)
          });
        }
      } catch (e) { /* fall through */ }
      return res.status(500).json({ error: 'Invalid bot output and no cache available' });
    }
  });
});

app.get('/api/gold/history', (req, res) => {
  if (!fs.existsSync(HISTORY_FILE)) {
    return res.json({ history: [] });
  }
  try {
    const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const history = JSON.parse(data);
    res.json({ history: history.slice(-30) });
  } catch (e) {
    res.status(500).json({ error: 'Could not read history' });
  }
});

// ── Transcription ───────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.originalname.endsWith('.wav')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file audio (WAV)'));
    }
  }
});

app.get('/api/transcribe/check', (req, res) => {
  const check = spawn('python', ['-c',
    'import whisper, soundfile, numpy; print("ok")'
  ]);
  let out = '', err = '';
  check.stdout.on('data', d => { out += d.toString(); });
  check.stderr.on('data', d => { err += d.toString(); });
  check.on('close', code => {
    if (code === 0) {
      res.json({ ok: true });
    } else {
      const missing = ['whisper', 'soundfile', 'numpy'].filter(m =>
        err.includes(`No module named '${m}'`) || out.includes(`No module named '${m}'`)
      );
      res.json({
        ok: false,
        error: missing.length
          ? `Thiếu thư viện: ${missing.join(', ')}`
          : 'Python error: ' + (err || out).slice(0, 200),
        fix: 'pip install openai-whisper soundfile'
      });
    }
  });
});

app.post('/api/transcribe', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Không có file audio được gửi lên' });
  }

  const audioPath = req.file.path;
  const scriptPath = path.join(__dirname, 'transcribe.py');

  console.log(`Transcribing: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(1)}MB)`);

  const pythonProcess = spawn('python', [scriptPath, audioPath, 'vi'], {
    cwd: __dirname
  });

  let outputData = '';
  let errorData = '';

  pythonProcess.stdout.on('data', (data) => { outputData += data.toString(); });
  pythonProcess.stderr.on('data', (data) => {
    errorData += data.toString();
    // Whisper logs model loading to stderr — not a real error
  });

  pythonProcess.on('close', (code) => {
    fs.unlink(audioPath, () => {});

    if (code !== 0) {
      // Python may have printed a JSON error to stdout (e.g. missing deps)
      let pythonError = null;
      try {
        const parsed = JSON.parse(outputData.trim());
        if (parsed.error) pythonError = parsed.error;
      } catch {}

      const message = pythonError || 'Transcription thất bại';
      console.error('Transcription failed:', message, errorData);
      return res.status(500).json({ error: message, details: errorData });
    }

    try {
      const result = JSON.parse(outputData.trim());
      if (result.error) {
        return res.status(500).json(result);
      }
      return res.json(result);
    } catch (e) {
      console.error('Parse error. Raw output:', outputData);
      return res.status(500).json({ error: 'Không parse được kết quả transcription' });
    }
  });

  // Timeout: 20 minutes for long recordings
  req.setTimeout(20 * 60 * 1000);
  res.setTimeout(20 * 60 * 1000);
});

app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
