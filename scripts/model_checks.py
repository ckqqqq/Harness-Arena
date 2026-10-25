"""Numerical checks for float32-exported geometry, independent of any model case."""
import math

def interval_check(value,bounds):
    lo,hi=bounds
    if not all(math.isfinite(v) for v in [lo,hi]) or lo>hi:raise ValueError('Invalid interval')
    tolerance=max(1e-7,max(abs(lo),abs(hi))*1e-6)
    return {'actual':value,'expected':bounds,'tolerance':tolerance,'passed':math.isfinite(value) and lo-tolerance<=value<=hi+tolerance}
