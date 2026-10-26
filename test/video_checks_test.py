import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('video_check', Path(__file__).resolve().parent.parent / 'scripts/inspect-video.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class VideoChecks(unittest.TestCase):
    def test_missing_or_invalid_metadata_cannot_pass(self):
        checks = dict(durationSeconds=12, width=1280, height=720, fps=24, videoCodec='h264', audioRequired=True)
        probe = dict(format=dict(duration='12.01'), streams=[dict(codec_type='video', width=1280, height=720, avg_frame_rate='24/1', codec_name='h264'), dict(codec_type='audio')])
        self.assertTrue(module.inspect(probe, checks)['passed'])
        for value in ['NaN', 'Infinity', None]:
            probe['format']['duration'] = value
            self.assertFalse(module.inspect(probe, checks)['passed'])
        self.assertFalse(module.inspect({}, checks)['passed'])

    def test_wrong_frame_rate_and_missing_audio_fail(self):
        checks = dict(durationSeconds=8, width=720, height=1280, fps=24, videoCodec='h264', audioRequired=True)
        probe = dict(format=dict(duration='8'), streams=[dict(codec_type='video', width=720, height=1280, avg_frame_rate='30/1', codec_name='h264')])
        report = module.inspect(probe, checks)
        self.assertFalse(report['checks']['fps'])
        self.assertFalse(report['checks']['audio'])
