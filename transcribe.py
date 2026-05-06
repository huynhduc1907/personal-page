import sys
import io
import json
import os
import subprocess
import tempfile

# Force UTF-8 stdout — prevents cp932/cp1252 encoding errors on Windows
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')


def get_ffmpeg():
    """Return path to ffmpeg binary (system PATH or imageio-ffmpeg fallback)."""
    import shutil
    if shutil.which('ffmpeg'):
        return 'ffmpeg'
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return None


def load_audio_any(audio_path):
    """
    Load any audio file (WAV, m4a, mp3, …) as 16kHz mono float32 numpy array.
    - For WAV: uses soundfile (no ffmpeg needed)
    - For other formats: converts via ffmpeg first, then reads WAV
    """
    import numpy as np
    import soundfile as sf

    ext = os.path.splitext(audio_path)[1].lower()

    if ext == '.wav':
        # Fast path — soundfile reads WAV natively
        data, sr = sf.read(audio_path)
    else:
        # Convert to temp WAV via ffmpeg
        ffmpeg = get_ffmpeg()
        if not ffmpeg:
            raise RuntimeError(
                "ffmpeg not found. Install via: pip install imageio-ffmpeg"
            )
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            tmp_wav = tmp.name
        try:
            subprocess.run(
                [ffmpeg, '-y', '-i', audio_path,
                 '-ar', '16000', '-ac', '1', tmp_wav],
                capture_output=True, check=True
            )
            data, sr = sf.read(tmp_wav)
        finally:
            try:
                os.unlink(tmp_wav)
            except Exception:
                pass

    # Convert to mono float32
    if len(data.shape) > 1:
        data = data.mean(axis=1)
    data = data.astype('float32')

    # Normalize
    peak = abs(data).max()
    if peak > 0:
        data /= peak

    return data, sr


def transcribe_audio(audio_path, language='vi', model_name='medium'):
    try:
        import whisper
    except ImportError:
        print(json.dumps({
            'error': 'Thiếu thư viện whisper. Chạy: pip install openai-whisper'
        }))
        sys.exit(1)

    if not os.path.exists(audio_path):
        print(json.dumps({'error': f'File không tồn tại: {audio_path}'}))
        sys.exit(1)

    try:
        audio_data, sample_rate = load_audio_any(audio_path)

        # Whisper expects 16kHz — resample if needed
        if sample_rate != 16000:
            import numpy as np
            ratio = 16000 / sample_rate
            new_len = int(len(audio_data) * ratio)
            audio_data = np.interp(
                np.linspace(0, len(audio_data), new_len),
                np.arange(len(audio_data)),
                audio_data
            ).astype('float32')

        model = whisper.load_model(model_name)

        result = model.transcribe(
            audio_data,
            language=language,
            task='transcribe',
            fp16=False,
            verbose=False,
            condition_on_previous_text=True,
        )

        segments = [
            {
                'start': round(s['start'], 2),
                'end':   round(s['end'],   2),
                'text':  s['text'].strip(),
            }
            for s in result.get('segments', [])
        ]

        print(json.dumps({
            'text':     result['text'].strip(),
            'segments': segments,
        }, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({'error': f'Lỗi transcribe: {str(e)}'}))
        sys.exit(1)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: python transcribe.py <file> [language] [model]'}))
        sys.exit(1)

    audio_path  = sys.argv[1]
    language    = sys.argv[2] if len(sys.argv) > 2 else 'vi'
    model_name  = sys.argv[3] if len(sys.argv) > 3 else 'medium'
    transcribe_audio(audio_path, language, model_name)
