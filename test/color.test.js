import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, contrastProblem, readableTextColor } from '../src/color.js';
import { PRESETS } from '../src/presets.js';
import { DEFAULTS } from '../src/state.js';

describe('Contrast check', () => {
  it('black on white is 21:1', () => {
    assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
  });
  it('default colors pass', () => {
    assert.equal(contrastProblem(DEFAULTS), null);
  });
  it('warns about low contrast', () => {
    assert.match(contrastProblem({ ...DEFAULTS, fg: '#ffd43b' }), /low/);
  });
  it('warns about inverted (light on dark) codes', () => {
    assert.match(contrastProblem({ ...DEFAULTS, fg: '#ffffff', bg: '#000000' }), /lighter/);
  });
  it('checks gradient and corner colors too', () => {
    assert.ok(contrastProblem({ ...DEFAULTS, gradient: true, fg2: '#eeeeee' }));
    assert.ok(contrastProblem({ ...DEFAULTS, cornerCustom: true, cornerColor: '#eeeeee' }));
  });
  for (const preset of PRESETS) {
    it(`preset "${preset.name}" passes`, () => {
      assert.equal(contrastProblem({ ...DEFAULTS, ...preset }), null);
    });
  }
  it('picks readable label colors for the frame', () => {
    assert.equal(readableTextColor('#000000'), '#ffffff');
    assert.equal(readableTextColor('#ffffff'), '#111111');
  });
});
