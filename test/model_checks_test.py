import unittest,sys,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from model_checks import interval_check

class GeometryIntervals(unittest.TestCase):
    def test_float32_boundaries_are_admitted(self):
        self.assertTrue(interval_check(2.5000000968575478,[2.3,2.5])['passed'])
        self.assertTrue(interval_check(.099999994,[.1,.1])['passed'])
    def test_substantive_errors_remain_failures(self):
        self.assertFalse(interval_check(.38415851444005966,[.45,.75])['passed'])
        self.assertFalse(interval_check(2.5001,[2.3,2.5])['passed'])
    def test_scale_and_invalid_values(self):
        self.assertTrue(interval_check(.00100001,[.001,.001])['passed'])
        self.assertFalse(interval_check(math.nan,[0,1])['passed'])
        with self.assertRaises(ValueError):interval_check(0,[1,0])

if __name__=='__main__':unittest.main()
