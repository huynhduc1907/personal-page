import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { FiUploadCloud, FiMic, FiDownload, FiPlus, FiTrash2, FiCopy, FiCheck } from 'react-icons/fi';
import './Transcribe.css';

// ── WAV encoding helpers ────────────────────────────────────────────────────
function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function audioBufferToWavBlob(audioBuffer) {
  const numSamples = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const wavBuffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(wavBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);       // PCM
  view.setUint16(20, 1, true);        // format: PCM
  view.setUint16(22, 1, true);        // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);        // block align
  view.setUint16(34, 16, true);       // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const channelData = audioBuffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

async function convertToWav(file) {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  // Resample to 16kHz mono (Whisper's expected format)
  const targetSampleRate = 16000;
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * targetSampleRate),
    targetSampleRate
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);
  const resampled = await offlineCtx.startRendering();
  await audioCtx.close();

  return audioBufferToWavBlob(resampled);
}

// ── Template export ─────────────────────────────────────────────────────────
function generateTxtExport(form) {
  const sep = '━'.repeat(60);
  const thin = '─'.repeat(60);

  const attendeeRows = form.attendees.map((a, i) =>
    `  ${String(i + 1).padStart(2, ' ')}. ${a.name}${a.title ? ' — ' + a.title : ''}${a.note ? ' (' + a.note + ')' : ''}`
  ).join('\n');

  const reportRows = form.reportRows.map(r =>
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

// ── Default form state ──────────────────────────────────────────────────────
const defaultForm = {
  subject: '',
  docNumber: '',
  meetingTime: '',
  location: '',
  attendees: [{ name: '', title: '', note: '' }],
  deploySection: '',
  reportRows: [{ department: '', section: '', content: '', proposal: '' }],
  mgmtOpinions: '',
  conclusions: '',
  endTime: '',
  secretary: '',
  chair: '',
};

// ── Component ───────────────────────────────────────────────────────────────
export default function Transcribe() {
  const [step, setStep] = useState('upload'); // upload | converting | transcribing | template
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [transcription, setTranscription] = useState('');
  const [segments, setSegments] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError('');

    const allowed = ['audio/mp4', 'audio/x-m4a', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'video/mp4'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(m4a|mp3|wav|ogg|mp4)$/i)) {
      setError('Chỉ hỗ trợ file audio: .m4a, .mp3, .wav, .ogg');
      return;
    }

    try {
      setStep('converting');
      setProgress('Đang chuyển đổi audio sang WAV 16kHz...');

      const wavBlob = await convertToWav(file);

      setStep('transcribing');
      setProgress('Đang transcribe... (có thể mất vài phút tùy độ dài file)');

      const formData = new FormData();
      formData.append('audio', wavBlob, 'audio.wav');

      const response = await axios.post('http://localhost:3001/api/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 20 * 60 * 1000,
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setTranscription(response.data.text || '');
      setSegments(response.data.segments || []);

      // Pre-fill template sections from transcription
      setForm(f => ({
        ...f,
        deploySection: response.data.text || '',
        mgmtOpinions: '',
        conclusions: '',
      }));

      setStep('template');
      setProgress('');
    } catch (err) {
      setStep('upload');
      setError(err.response?.data?.error || err.message || 'Lỗi không xác định');
      setProgress('');
    }
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  };

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

  const copyTranscription = () => {
    navigator.clipboard.writeText(transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Attendee helpers
  const updateAttendee = (idx, field, value) => {
    setForm(f => {
      const attendees = [...f.attendees];
      attendees[idx] = { ...attendees[idx], [field]: value };
      return { ...f, attendees };
    });
  };
  const addAttendee = () => setForm(f => ({ ...f, attendees: [...f.attendees, { name: '', title: '', note: '' }] }));
  const removeAttendee = (idx) => setForm(f => ({ ...f, attendees: f.attendees.filter((_, i) => i !== idx) }));

  // ── Report row helpers
  const updateReportRow = (idx, field, value) => {
    setForm(f => {
      const reportRows = [...f.reportRows];
      reportRows[idx] = { ...reportRows[idx], [field]: value };
      return { ...f, reportRows };
    });
  };
  const addReportRow = () => setForm(f => ({ ...f, reportRows: [...f.reportRows, { department: '', section: '', content: '', proposal: '' }] }));
  const removeReportRow = (idx) => setForm(f => ({ ...f, reportRows: f.reportRows.filter((_, i) => i !== idx) }));

  const resetAll = () => {
    setStep('upload');
    setTranscription('');
    setSegments([]);
    setForm(defaultForm);
    setError('');
    setProgress('');
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="page-container animate-fade-in transcribe-page">
      <header className="transcribe-header">
        <div>
          <h1 className="page-title">Transcribe & Biên Bản Họp</h1>
          <p>Import file audio → Transcribe → Xuất biên bản họp</p>
        </div>
        {step === 'template' && (
          <div className="header-actions">
            <button className="btn-secondary" onClick={resetAll}>
              <FiMic /> File mới
            </button>
            <button className="btn-primary" onClick={exportTxt}>
              <FiDownload /> Xuất .txt
            </button>
          </div>
        )}
      </header>

      {/* ── Upload step ── */}
      {(step === 'upload' || step === 'converting' || step === 'transcribing') && (
        <div className="upload-section">
          <div
            className={`drop-zone glass-panel ${dragOver ? 'drag-over' : ''} ${step !== 'upload' ? 'processing' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => step === 'upload' && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".m4a,.mp3,.wav,.ogg,.mp4,audio/*"
              style={{ display: 'none' }}
              onChange={onFileChange}
            />

            {step === 'upload' && (
              <>
                <div className="drop-icon"><FiUploadCloud /></div>
                <h3>Kéo thả file audio vào đây</h3>
                <p>hoặc click để chọn file</p>
                <div className="supported-formats">
                  Hỗ trợ: <span>.m4a</span> <span>.mp3</span> <span>.wav</span> <span>.ogg</span>
                </div>
              </>
            )}

            {(step === 'converting' || step === 'transcribing') && (
              <div className="processing-state">
                <div className="spinner" />
                <p className="processing-label">{progress}</p>
                <p className="processing-hint">
                  {step === 'transcribing' && 'Lần đầu chạy sẽ tải model ~140MB. Vui lòng chờ.'}
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="error-box glass-panel">
              <strong>Lỗi:</strong> {error}
              {error.includes('pip install') && (
                <pre className="install-hint">pip install openai-whisper soundfile</pre>
              )}
            </div>
          )}

          <div className="setup-info glass-panel">
            <h4>Yêu cầu cài đặt (lần đầu)</h4>
            <pre>pip install openai-whisper soundfile</pre>
            <p>Không cần ffmpeg — browser tự chuyển đổi audio sang WAV trước khi gửi.</p>
          </div>
        </div>
      )}

      {/* ── Template step ── */}
      {step === 'template' && (
        <div className="template-layout">
          {/* Left: Transcription */}
          <div className="transcription-panel glass-panel">
            <div className="panel-header">
              <h3>Nội dung ghi âm</h3>
              <button className="btn-icon" onClick={copyTranscription} title="Copy">
                {copied ? <FiCheck /> : <FiCopy />}
              </button>
            </div>

            {segments.length > 0 ? (
              <div className="segments-list">
                {segments.map((seg, i) => (
                  <div key={i} className="segment-item">
                    <span className="segment-time">
                      {formatTime(seg.start)} – {formatTime(seg.end)}
                    </span>
                    <span className="segment-text">{seg.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="raw-text">{transcription}</div>
            )}
          </div>

          {/* Right: Meeting minutes form */}
          <div className="form-panel">
            <section className="form-section glass-panel">
              <h3 className="section-title">I. Thông tin cuộc họp</h3>

              <div className="form-row">
                <label>Nội dung</label>
                <input
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Họp Kinh doanh & Giao ban..."
                />
              </div>
              <div className="form-row">
                <label>Số văn bản</label>
                <input
                  value={form.docNumber}
                  onChange={e => setForm(f => ({ ...f, docNumber: e.target.value }))}
                  placeholder="95/MYH26/HHD/BBH-TCHC"
                />
              </div>
              <div className="form-row two-col">
                <div>
                  <label>Thời gian</label>
                  <input
                    value={form.meetingTime}
                    onChange={e => setForm(f => ({ ...f, meetingTime: e.target.value }))}
                    placeholder="13h30 ngày 20/04/2026 (Thứ Hai)"
                  />
                </div>
                <div>
                  <label>Địa điểm</label>
                  <input
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="Online qua Microsoft Teams"
                  />
                </div>
              </div>

              <div className="form-row">
                <label>Thành phần tham dự</label>
                <div className="attendee-list">
                  {form.attendees.map((a, i) => (
                    <div key={i} className="attendee-row">
                      <input
                        value={a.name}
                        onChange={e => updateAttendee(i, 'name', e.target.value)}
                        placeholder="Họ tên"
                        className="col-name"
                      />
                      <input
                        value={a.title}
                        onChange={e => updateAttendee(i, 'title', e.target.value)}
                        placeholder="Chức vụ"
                        className="col-title"
                      />
                      <input
                        value={a.note}
                        onChange={e => updateAttendee(i, 'note', e.target.value)}
                        placeholder="Ghi chú"
                        className="col-note"
                      />
                      <button className="btn-icon danger" onClick={() => removeAttendee(i)}>
                        <FiTrash2 />
                      </button>
                    </div>
                  ))}
                  <button className="btn-add" onClick={addAttendee}>
                    <FiPlus /> Thêm người
                  </button>
                </div>
              </div>
            </section>

            <section className="form-section glass-panel">
              <h3 className="section-title">II. Diễn biến cuộc họp</h3>

              <div className="form-row">
                <label>1. Phần triển khai</label>
                <textarea
                  rows={5}
                  value={form.deploySection}
                  onChange={e => setForm(f => ({ ...f, deploySection: e.target.value }))}
                  placeholder="Nội dung triển khai..."
                />
              </div>

              <div className="form-row">
                <label>2. Phần báo cáo</label>
                <div className="report-table">
                  <div className="report-header">
                    <span>Ban</span><span>Mảng</span>
                    <span>Nội dung báo cáo</span><span>Kiến nghị / Đề xuất</span>
                    <span></span>
                  </div>
                  {form.reportRows.map((r, i) => (
                    <div key={i} className="report-row">
                      <input value={r.department} onChange={e => updateReportRow(i, 'department', e.target.value)} placeholder="Ban..." />
                      <input value={r.section} onChange={e => updateReportRow(i, 'section', e.target.value)} placeholder="Mảng..." />
                      <textarea rows={2} value={r.content} onChange={e => updateReportRow(i, 'content', e.target.value)} placeholder="Nội dung..." />
                      <textarea rows={2} value={r.proposal} onChange={e => updateReportRow(i, 'proposal', e.target.value)} placeholder="Kiến nghị..." />
                      <button className="btn-icon danger" onClick={() => removeReportRow(i)}><FiTrash2 /></button>
                    </div>
                  ))}
                  <button className="btn-add" onClick={addReportRow}>
                    <FiPlus /> Thêm hàng
                  </button>
                </div>
              </div>

              <div className="form-row">
                <label>3. Ý kiến của Ban Điều hành</label>
                <textarea
                  rows={6}
                  value={form.mgmtOpinions}
                  onChange={e => setForm(f => ({ ...f, mgmtOpinions: e.target.value }))}
                  placeholder="Ý kiến từng thành viên Ban Điều hành..."
                />
              </div>
            </section>

            <section className="form-section glass-panel">
              <h3 className="section-title">III. Kết luận & Ký tên</h3>

              <div className="form-row">
                <label>Kết luận của Chủ trì</label>
                <textarea
                  rows={5}
                  value={form.conclusions}
                  onChange={e => setForm(f => ({ ...f, conclusions: e.target.value }))}
                  placeholder="Kết luận và phân công nhiệm vụ..."
                />
              </div>

              <div className="form-row">
                <label>Thời gian kết thúc</label>
                <input
                  value={form.endTime}
                  onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                  placeholder="15h52 cùng ngày"
                />
              </div>

              <div className="form-row two-col">
                <div>
                  <label>Thư ký</label>
                  <input
                    value={form.secretary}
                    onChange={e => setForm(f => ({ ...f, secretary: e.target.value }))}
                    placeholder="Họ tên thư ký"
                  />
                </div>
                <div>
                  <label>Chủ trì</label>
                  <input
                    value={form.chair}
                    onChange={e => setForm(f => ({ ...f, chair: e.target.value }))}
                    placeholder="Họ tên chủ trì"
                  />
                </div>
              </div>
            </section>

            <div className="export-bar">
              <button className="btn-secondary" onClick={resetAll}>
                <FiMic /> File mới
              </button>
              <button className="btn-primary large" onClick={exportTxt}>
                <FiDownload /> Xuất Biên Bản Họp (.txt)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
