"""Create reproducible, synthetic public-domain-style inputs; no downloaded assets."""
import argparse
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
for name, source in [('shot-a', 'testsrc2=size=1280x720:rate=24'),
                     ('shot-b', 'smptebars=size=1280x720:rate=24'),
                     ('shot-c', 'color=c=0xabc86a:size=1280x720:rate=24')]:
    subprocess.run(['ffmpeg', '-nostdin', '-n', '-f', 'lavfi', '-i', source,
                    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
                    '-t', '12', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', '-shortest', str(args.output / (name + '.mp4'))], check=True)
subprocess.run(['ffmpeg', '-nostdin', '-n', '-f', 'lavfi', '-i',
                "aevalsrc=if(lt(mod(t\\,1)\\,0.05)\\,0.4*sin(2*PI*880*t)\\,0):s=48000:d=12",
                str(args.output / 'beat.wav')], check=True)
(args.output / 'INPUTS.json').write_text(json.dumps({
    'synthetic': True,
    'description': 'FFmpeg test patterns and synthesized audio, not harness outputs.',
    'files': ['shot-a.mp4', 'shot-b.mp4', 'shot-c.mp4', 'beat.wav'],
    'beatSeconds': list(range(12))
}, indent=2) + '\n', encoding='utf-8')
