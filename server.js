import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3001;

app.use(cors());

const BOT_DIR = path.resolve('D:/AI_training/gold_price_bot');
const HISTORY_FILE = path.join(BOT_DIR, 'output', 'history.json');

app.get('/api/gold/refresh', (req, res) => {
  console.log('Triggering gold price bot...');
  
  // Need to run using the correct python path or just "python"
  // Let's use python assuming it's available in the system PATH
  const botProcess = spawn('python', ['get_web_data.py'], {
    cwd: BOT_DIR
  });

  let outputData = '';
  let errorData = '';

  botProcess.stdout.on('data', (data) => {
    outputData += data.toString();
  });

  botProcess.stderr.on('data', (data) => {
    errorData += data.toString();
  });

  botProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Bot exited with code ${code}. Error: ${errorData}`);
      // Bot crashed — return cached history.json as stale data instead of hard error
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

    // Use the bot's own stdout — it already handles fallback logic for invalid/duplicate prices
    try {
      const botResult = JSON.parse(outputData.trim());
      // Mark stale if current data's post_date is not today
      const lastHistoryDate = botResult.current?.post_date;
      const now = new Date();
      const today = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
      const isStale = lastHistoryDate && lastHistoryDate !== today;
      return res.json({ ...botResult, stale: isStale });
    } catch (parseErr) {
      console.error('Failed to parse bot stdout:', parseErr, '\nRaw output:', outputData);
      // Fallback to reading file directly
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
    res.json({ history: history.slice(-30) }); // max 30
  } catch (e) {
    res.status(500).json({ error: 'Could not read history' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
