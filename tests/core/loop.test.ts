import { describe, expect, it } from 'vitest';
import { clampDt, MAX_DT } from '../../src/core/loop';

describe('clampDt', () => {
  it('clamps huge frame gaps (tab hidden) to MAX_DT', () => {
    expect(MAX_DT).toBe(0.1);
    expect(clampDt(5)).toBe(0.1);
  });
  it('passes normal frame times through', () => {
    expect(clampDt(0.016)).toBe(0.016);
  });
  it('never returns negative dt', () => {
    expect(clampDt(-1)).toBe(0);
  });
});
