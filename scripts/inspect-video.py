"""Inspect a video against one declared case. Does not judge editing aesthetics."""
import argparse
import json
import math
import subprocess
from pathlib import Path


def inspect(probe, checks):
    video = next((s for s in probe.get('streams', []) if s.get('codec_type') == 'video'), {})
    audio = any(s.get('codec_type') == 'audio' for s in probe.get('streams', []))
    def number(value):
        try:
            parts = str(value).split('/')
            n = float(parts[0]) / float(parts[1]) if len(parts) == 2 else float(value)
            return n if math.isfinite(n) else None
        except (ValueError, TypeError, ZeroDivisionError):
            return None
    duration = number(probe.get('format', {}).get('duration'))
    fps = number(video.get('avg_frame_rate'))
    results = {
        'duration': duration is not None and abs(duration - checks['durationSeconds']) <= 0.15,
        'width': video.get('width') == checks['width'],
        'height': video.get('height') == checks['height'],
        'fps': fps is not None and abs(fps - checks['fps']) <= 0.01,
        'codec': video.get('codec_name') == checks['videoCodec'],
        'audio': audio or not checks['audioRequired'],
    }
    return {'passed': all(results.values()), 'checks': results,
            'observed': {'duration': duration, 'fps': fps, 'width': video.get('width'),
                         'height': video.get('height'), 'codec': video.get('codec_name'), 'audio': audio},
            'limitations': 'Metadata only: does not verify cuts, framing, subtitles, music alignment or visual quality.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cases', type=Path, default=Path(__file__).resolve().parent.parent / 'examples/video-cases.json')
    parser.add_argument('--case', required=True)
    parser.add_argument('video', type=Path)
    args = parser.parse_args()
    catalog = json.loads(args.cases.read_text(encoding='utf-8'))
    case = next(c for c in catalog['cases'] if c['id'] == args.case)
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format',
                            '-of', 'json', str(args.video.resolve())], check=True, capture_output=True, text=True)
    report = inspect(json.loads(probe.stdout), case['checks'])
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report['passed'] else 1)
