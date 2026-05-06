import sys
import json
import os

def transcribe_audio(audio_path, language="vi"):
    try:
        import whisper
        import soundfile as sf
        import numpy as np
    except ImportError as e:
        print(json.dumps({
            "error": f"Thiếu thư viện: {e}. Chạy: pip install openai-whisper soundfile"
        }))
        sys.exit(1)

    if not os.path.exists(audio_path):
        print(json.dumps({"error": f"File không tồn tại: {audio_path}"}))
        sys.exit(1)

    try:
        # Read WAV file directly (no ffmpeg needed for WAV format)
        audio_data, sample_rate = sf.read(audio_path)

        # Convert to mono float32
        if len(audio_data.shape) > 1:
            audio_data = audio_data.mean(axis=1)
        audio_data = audio_data.astype(np.float32)

        # Normalize
        max_val = np.max(np.abs(audio_data))
        if max_val > 0:
            audio_data = audio_data / max_val

        # Load whisper model — "base" balances speed and accuracy (~140MB download on first run)
        model = whisper.load_model("base")

        result = model.transcribe(
            audio_data,
            language=language,
            task="transcribe",
            fp16=False,
            verbose=False
        )

        segments = [
            {
                "start": round(s["start"], 2),
                "end": round(s["end"], 2),
                "text": s["text"].strip()
            }
            for s in result.get("segments", [])
        ]

        print(json.dumps({
            "text": result["text"].strip(),
            "segments": segments
        }, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"error": f"Lỗi transcribe: {str(e)}"}))
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python transcribe.py <audio_file> [language]"}))
        sys.exit(1)

    audio_path = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else "vi"
    transcribe_audio(audio_path, language)
