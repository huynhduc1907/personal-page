import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  FiUploadCloud, FiMic, FiDownload, FiPlus, FiTrash2,
  FiCopy, FiCheck, FiRefreshCw, FiClock, FiCheckCircle,
  FiAlertCircle, FiLoader, FiArrowRight
} from 'react-icons/fi';
import './Transcribe.css';

// ── Constants ────────────────────────────────────────────────────────────────
const CHUNK_DURATION = 180; // 3 minutes per chunk (seconds)

// ── WAV encoding ─────────────────────────────────────────────────────────────
function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function audioBufferToWavBlob(audioBuffer) {
  const numSamples = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const buf = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buf);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);
  const ch = audioBuffer.getChannelData(0);
  let off = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, ch[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    off += 2;
  }
  return new Blob([buf], { type: 'audio/wav' });
}

// ── Audio decoding + chunking ─────────────────────────────────────────────────
async function decodeAndChunk(file) {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  // Resample to 16kHz mono
  const targetRate = 16000;
  const offCtx = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * targetRate),
    targetRate
  );
  const src = offCtx.createBufferSource();
  src.buffer = decoded;
  src.connect(offCtx.destination);
  src.start(0);
  const resampled = await offCtx.startRendering();
  await audioCtx.close();

  const totalSamples = resampled.length;
  const samplesPerChunk = Math.floor(targetRate * CHUNK_DURATION);
  const channelData = resampled.getChannelData(0);
  const chunks = [];

  let offset = 0;
  while (offset < totalSamples) {
    const end = Math.min(offset + samplesPerChunk, totalSamples);
    const slice = channelData.slice(offset, end);

    const chunkBuf = new AudioBuffer({
      length: end - offset,
      sampleRate: targetRate,
      numberOfChannels: 1,
    });
    chunkBuf.copyToChannel(slice, 0);

    chunks.push({
      index: chunks.length,
      startTime: offset / targetRate,
      endTime: end / targetRate,
      wavBlob: audioBufferToWavBlob(chunkBuf),
      status: 'waiting', // waiting | processing | done | error
      text: '',
      error: '',
    });
    offset = end;
  }
  return chunks;
}

// ── Template export ───────────────────────────────────────────────────────────
function generateTxtExport(form) {
  const sep = '━'.repeat(60);
  const thin = '─'.repeat(60);

  const attendeeRows = form.attendees
    .map((a, i) =>
      `  ${String(i + 1).padStart(2, ' ')}. ${a.name}${a.title ? ' — ' + a.title : ''}${a.note ? ' (' + a.note + ')' : ''}`
    ).join('\n');

  const reportRows = form.reportRows
    .map(r =>
      `  • [${r.department}${r.section ? ' / ' + r.section : ''}] ${r.content}${r.proposal ? '\n    Kiến nghị: ' + r.proposal : ''}`
    ).join('\n\n');

  return `${sep}
                      BIÊN BẢN HỌP
${sep}

I. THÔNG TIN CUỘC HỌP
${thin}
Nội dung  : ${form.subject}
Số VB     : ${form.docNumber}
Thời gian : ${form.meetingTime}
Địa điểm  : ${form.location}

THÀNH PHẦN THAM DỰ:
${attendeeRows || '  (chưa điền)'}

II. DIỄN BIẾN CUỘC HỌP
${thin}

1. Phần triển khai:
${form.deploySection || '  (chưa điền)'}

2. Phần báo cáo:
${reportRows || '  (chưa điền)'}

3. Ý kiến của Ban Điều hành:
${form.mgmtOpinions || '  (chưa điền)'}

III. KẾT LUẬN CỦA CHỦ TRÌ CUỘC HỌP
${thin}
${form.conclusions || '  (chưa điền)'}

Cuộc họp kết thúc lúc: ${form.endTime}

${sep}

          THƯ KÝ                              CHỦ TRÌ

      ${form.secretary || '...............'}                 ${form.chair || '...............'}

${sep}
`;
}

const defaultForm = {
  subject: '', docNumber: '', meetingTime: '', location: '',
  attendees: [{ name: '', title: '', note: '' }],
  deploySection: '',
  reportRows: [{ department: '', section: '', content: '', proposal: '' }],
  mgmtOpinions: '', conclusions: '', endTime: '', secretary: '', chair: '',
};

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Transcribe() {
  const [phase, setPhase] = useState('upload'); // upload | preparing | processing | review | template
  const [dragOver, setDragOver] = useState(false);
  const [prepProgress, setPrepProgress] = useState('');
  const [chunks, setChunks] = useState([]);     // array of chunk objects
  const [form, setForm] = useState(defaultForm);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);
  const abortRef = useRef(false);

  // ── Update single chunk field
  const patchChunk = (idx, patch) =>
    setChunks(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));

  // ── Main processing flow
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    abortRef.current = false;

    const allowed = /\.(m4a|mp3|wav|ogg|mp4)$/i;
    if (!file.name.match(allowed) && !file.type.startsWith('audio/')) {
      alert('Chỉ hỗ trợ file audio: .m4a, .mp3, .wav, .ogg');
      return;
    }

    try {
      setPhase('preparing');
      setPrepProgress('Đang decode audio...');
      const prepared = await decodeAndChunk(file);
      setPrepProgress(`Đã chia thành ${prepared.length} đoạn (~${CHUNK_DURATION / 60} phút/đoạn)`);

      setChunks(prepared);
      setPhase('processing');

      // Process chunks sequentially
      for (let i = 0; i < prepared.length; i++) {
        if (abortRef.current) break;

        patchChunk(i, { status: 'processing' });

        try {
          const fd = new FormData();
          fd.append('audio', prepared[i].wavBlob, `chunk_${i}.wav`);

          const res = await axios.post('http://localhost:3001/api/transcribe', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 8 * 60 * 1000, // 8 min per 3-min chunk is generous
          });

          if (res.data.error) throw new Error(res.data.error);

          patchChunk(i, { status: 'done', text: res.data.text || '' });
        } catch (err) {
          patchChunk(i, {
            status: 'error',
            error: err.response?.data?.error || err.message || 'Lỗi không xác định',
          });
          // Continue to next chunk instead of stopping
        }
      }

      setPhase('review');
    } catch (err) {
      alert('Lỗi khi decode audio: ' + err.message);
      setPhase('upload');
    }
  }, []);

  // ── Retry a failed chunk
  const retryChunk = async (idx) => {
    patchChunk(idx, { status: 'processing', error: '' });
    try {
      const fd = new FormData();
      fd.append('audio', chunks[idx].wavBlob, `chunk_${idx}.wav`);
      const res = await axios.post('http://localhost:3001/api/transcribe', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 8 * 60 * 1000,
      });
      if (res.data.error) throw new Error(res.data.error);
      patchChunk(idx, { status: 'done', text: res.data.text || '' });
    } catch (err) {
      patchChunk(idx, {
        status: 'error',
        error: err.response?.data?.error || err.message,
      });
    }
  };

  // ── Proceed to template after review
  const goToTemplate = () => {
    const combined = chunks.map(c => c.text).filter(Boolean).join('\n\n');
    setForm(f => ({ ...f, deploySection: combined }));
    setPhase('template');
  };

  // ── Export
  const exportTxt = () => {
    const content = generateTxtExport(form);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toLocaleDateString('vi-VN').replace(/\//g, '');
    a.download = `BienBanHop_${date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    abortRef.current = true;
    setPhase('upload');
    setChunks([]);
    setForm(defaultForm);
    setPrepProgress('');
  };

  const copyAll = () => {
    const text = chunks.map(c => c.text).filter(Boolean).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Progress stats
  const doneCount = chunks.filter(c => c.status === 'done').length;
  const errorCount = chunks.filter(c => c.status === 'error').length;
  const total = chunks.length;
  const pct = total > 0 ? Math.round(((doneCount + errorCount) / total) * 100) : 0;

  // ── Form helpers
  const updateAttendee = (idx, field, val) =>
    setForm(f => { const a = [...f.attendees]; a[idx] = { ...a[idx], [field]: val }; return { ...f, attendees: a }; });
  const addAttendee = () => setForm(f => ({ ...f, attendees: [...f.attendees, { name: '', title: '', note: '' }] }));
  const removeAttendee = (idx) => setForm(f => ({ ...f, attendees: f.attendees.filter((_, i) => i !== idx) }));
  const updateRow = (idx, field, val) =>
    setForm(f => { const r = [...f.reportRows]; r[idx] = { ...r[idx], [field]: val }; return { ...f, reportRows: r }; });
  const addRow = () => setForm(f => ({ ...f, reportRows: [...f.reportRows, { department: '', section: '', content: '', proposal: '' }] }));
  const removeRow = (idx) => setForm(f => ({ ...f, reportRows: f.reportRows.filter((_, i) => i !== idx) }));

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="page-container animate-fade-in transcribe-page">

      {/* ── Header ── */}
      <header className="transcribe-header">
        <div>
          <h1 className="page-title">Transcribe & Biên Bản Họp</h1>
          <p>Import file audio → Transcribe theo từng đoạn → Xuất biên bản họp</p>
        </div>
        {(phase === 'review' || phase === 'template') && (
          <div className="header-actions">
            <button className="btn-secondary" onClick={resetAll}><FiMic /> File mới</button>
            {phase === 'review' && (
              <button className="btn-primary" onClick={goToTemplate}>
                Vào biên bản <FiArrowRight />
              </button>
            )}
            {phase === 'template' && (
              <button className="btn-primary" onClick={exportTxt}><FiDownload /> Xuất .txt</button>
            )}
          </div>
        )}
      </header>

      {/* ── PHASE: upload ── */}
      {phase === 'upload' && (
        <div className="upload-section">
          <div
            className={`drop-zone glass-panel ${dragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".m4a,.mp3,.wav,.ogg,.mp4,audio/*"
              style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
            <div className="drop-icon"><FiUploadCloud /></div>
            <h3>Kéo thả file audio vào đây</h3>
            <p>hoặc click để chọn file</p>
            <div className="supported-formats">
              <span>.m4a</span><span>.mp3</span><span>.wav</span><span>.ogg</span>
            </div>
          </div>

          <div className="setup-info glass-panel">
            <h4>Yêu cầu (lần đầu)</h4>
            <pre>pip install openai-whisper soundfile</pre>
            <p>Audio được chia thành đoạn {CHUNK_DURATION / 60} phút để tránh timeout. Không cần ffmpeg.</p>
          </div>
        </div>
      )}

      {/* ── PHASE: preparing ── */}
      {phase === 'preparing' && (
        <div className="upload-section">
          <div className="drop-zone glass-panel processing">
            <div className="spinner" />
            <p className="processing-label">{prepProgress || 'Đang chuẩn bị...'}</p>
          </div>
        </div>
      )}

      {/* ── PHASE: processing + review ── */}
      {(phase === 'processing' || phase === 'review') && (
        <div className="chunks-view">
          {/* Progress bar */}
          <div className="progress-card glass-panel">
            <div className="progress-top">
              <span className="progress-label">
                {phase === 'processing'
                  ? `Đang xử lý đoạn ${Math.min(doneCount + errorCount + 1, total)} / ${total}...`
                  : `Hoàn thành ${doneCount}/${total} đoạn${errorCount > 0 ? ` (${errorCount} lỗi)` : ''}`
                }
              </span>
              <span className="progress-pct">{pct}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            {phase === 'review' && (
              <div className="progress-actions">
                <button className="btn-icon-text" onClick={copyAll}>
                  {copied ? <FiCheck /> : <FiCopy />} Copy toàn bộ
                </button>
                <button className="btn-primary" onClick={goToTemplate}>
                  Vào biên bản <FiArrowRight />
                </button>
              </div>
            )}
          </div>

          {/* Chunk list */}
          <div className="chunk-list">
            {chunks.map((chunk, i) => (
              <div key={i} className={`chunk-card glass-panel chunk-${chunk.status}`}>
                <div className="chunk-header">
                  <div className="chunk-label">
                    <StatusIcon status={chunk.status} />
                    <span className="chunk-title">Đoạn {i + 1}</span>
                    <span className="chunk-time">
                      <FiClock size={12} /> {formatTime(chunk.startTime)} – {formatTime(chunk.endTime)}
                    </span>
                  </div>
                  {chunk.status === 'error' && (
                    <button className="btn-retry" onClick={() => retryChunk(i)}>
                      <FiRefreshCw size={13} /> Thử lại
                    </button>
                  )}
                </div>

                {chunk.status === 'waiting' && (
                  <p className="chunk-placeholder">Chờ xử lý...</p>
                )}

                {chunk.status === 'processing' && (
                  <div className="chunk-loading">
                    <div className="spinner-sm" />
                    <span>Đang transcribe...</span>
                  </div>
                )}

                {chunk.status === 'error' && (
                  <div className="chunk-error">
                    <FiAlertCircle /> {chunk.error}
                  </div>
                )}

                {chunk.status === 'done' && (
                  <textarea
                    className="chunk-textarea"
                    value={chunk.text}
                    onChange={e => patchChunk(i, { text: e.target.value })}
                    rows={Math.max(3, Math.ceil(chunk.text.length / 80))}
                    placeholder="(trống)"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PHASE: template ── */}
      {phase === 'template' && (
        <div className="template-layout">
          {/* Left: combined transcript */}
          <div className="transcription-panel glass-panel">
            <div className="panel-header">
              <h3>Nội dung ghi âm</h3>
              <button className="btn-icon" onClick={copyAll} title="Copy">
                {copied ? <FiCheck /> : <FiCopy />}
              </button>
            </div>
            <div className="chunks-readonly">
              {chunks.filter(c => c.status === 'done').map((c, i) => (
                <div key={i} className="chunk-readonly-item">
                  <span className="chunk-time-label">
                    {formatTime(c.startTime)} – {formatTime(c.endTime)}
                  </span>
                  <p>{c.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: meeting minutes form */}
          <div className="form-panel">
            <section className="form-section glass-panel">
              <h3 className="section-title">I. Thông tin cuộc họp</h3>
              <div className="form-row">
                <label>Nội dung</label>
                <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Họp Kinh doanh & Giao ban..." />
              </div>
              <div className="form-row">
                <label>Số văn bản</label>
                <input value={form.docNumber} onChange={e => setForm(f => ({ ...f, docNumber: e.target.value }))}
                  placeholder="95/MYH26/HHD/BBH-TCHC" />
              </div>
              <div className="form-row two-col">
                <div>
                  <label>Thời gian</label>
                  <input value={form.meetingTime} onChange={e => setForm(f => ({ ...f, meetingTime: e.target.value }))}
                    placeholder="13h30 ngày 20/04/2026 (Thứ Hai)" />
                </div>
                <div>
                  <label>Địa điểm</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="Online qua Microsoft Teams" />
                </div>
              </div>
              <div className="form-row">
                <label>Thành phần tham dự</label>
                <div className="attendee-list">
                  {form.attendees.map((a, i) => (
                    <div key={i} className="attendee-row">
                      <input value={a.name} onChange={e => updateAttendee(i, 'name', e.target.value)} placeholder="Họ tên" className="col-name" />
                      <input value={a.title} onChange={e => updateAttendee(i, 'title', e.target.value)} placeholder="Chức vụ" className="col-title" />
                      <input value={a.note} onChange={e => updateAttendee(i, 'note', e.target.value)} placeholder="Ghi chú" className="col-note" />
                      <button className="btn-icon danger" onClick={() => removeAttendee(i)}><FiTrash2 /></button>
                    </div>
                  ))}
                  <button className="btn-add" onClick={addAttendee}><FiPlus /> Thêm người</button>
                </div>
              </div>
            </section>

            <section className="form-section glass-panel">
              <h3 className="section-title">II. Diễn biến cuộc họp</h3>
              <div className="form-row">
                <label>1. Phần triển khai <span className="label-hint">(từ bản ghi âm)</span></label>
                <textarea rows={6} value={form.deploySection}
                  onChange={e => setForm(f => ({ ...f, deploySection: e.target.value }))}
                  placeholder="Nội dung triển khai..." />
              </div>
              <div className="form-row">
                <label>2. Phần báo cáo</label>
                <div className="report-table">
                  <div className="report-header">
                    <span>Ban</span><span>Mảng</span>
                    <span>Nội dung báo cáo</span><span>Kiến nghị / Đề xuất</span>
                    <span />
                  </div>
                  {form.reportRows.map((r, i) => (
                    <div key={i} className="report-row">
                      <input value={r.department} onChange={e => updateRow(i, 'department', e.target.value)} placeholder="Ban..." />
                      <input value={r.section} onChange={e => updateRow(i, 'section', e.target.value)} placeholder="Mảng..." />
                      <textarea rows={2} value={r.content} onChange={e => updateRow(i, 'content', e.target.value)} placeholder="Nội dung..." />
                      <textarea rows={2} value={r.proposal} onChange={e => updateRow(i, 'proposal', e.target.value)} placeholder="Kiến nghị..." />
                      <button className="btn-icon danger" onClick={() => removeRow(i)}><FiTrash2 /></button>
                    </div>
                  ))}
                  <button className="btn-add" onClick={addRow}><FiPlus /> Thêm hàng</button>
                </div>
              </div>
              <div className="form-row">
                <label>3. Ý kiến của Ban Điều hành</label>
                <textarea rows={6} value={form.mgmtOpinions}
                  onChange={e => setForm(f => ({ ...f, mgmtOpinions: e.target.value }))}
                  placeholder="Ý kiến từng thành viên Ban Điều hành..." />
              </div>
            </section>

            <section className="form-section glass-panel">
              <h3 className="section-title">III. Kết luận & Ký tên</h3>
              <div className="form-row">
                <label>Kết luận của Chủ trì</label>
                <textarea rows={5} value={form.conclusions}
                  onChange={e => setForm(f => ({ ...f, conclusions: e.target.value }))}
                  placeholder="Kết luận và phân công nhiệm vụ..." />
              </div>
              <div className="form-row">
                <label>Thời gian kết thúc</label>
                <input value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                  placeholder="15h52 cùng ngày" />
              </div>
              <div className="form-row two-col">
                <div>
                  <label>Thư ký</label>
                  <input value={form.secretary} onChange={e => setForm(f => ({ ...f, secretary: e.target.value }))}
                    placeholder="Họ tên thư ký" />
                </div>
                <div>
                  <label>Chủ trì</label>
                  <input value={form.chair} onChange={e => setForm(f => ({ ...f, chair: e.target.value }))}
                    placeholder="Họ tên chủ trì" />
                </div>
              </div>
            </section>

            <div className="export-bar">
              <button className="btn-secondary" onClick={resetAll}><FiMic /> File mới</button>
              <button className="btn-primary large" onClick={exportTxt}><FiDownload /> Xuất Biên Bản Họp (.txt)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }) {
  if (status === 'waiting')    return <FiClock className="status-icon waiting" />;
  if (status === 'processing') return <FiLoader className="status-icon processing spin" />;
  if (status === 'done')       return <FiCheckCircle className="status-icon done" />;
  if (status === 'error')      return <FiAlertCircle className="status-icon error" />;
  return null;
}
