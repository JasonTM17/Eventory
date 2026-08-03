import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const globalStyles = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
const mobileStyles = globalStyles.slice(globalStyles.indexOf('@media (max-width: 800px)'));

describe('narrow-screen layout', () => {
  it('uses shrinkable single-column grid tracks', () => {
    assert.match(
      mobileStyles,
      /\.event-grid,[\s\S]*?\.metric-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    );
  });

  it('stacks inline forms and constrained checkout content', () => {
    assert.match(mobileStyles, /\.inline-form\s*\{\s*flex-direction:\s*column;/);
    assert.match(mobileStyles, /\.seat-grid\s*\{\s*min-width:\s*0;/);
    assert.match(
      mobileStyles,
      /\.checkout-summary\s*\{\s*align-items:\s*stretch;\s*flex-direction:\s*column;/,
    );
  });
});
