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

  it('keeps the ticket wallet centered and shrinkable', () => {
    assert.match(
      globalStyles,
      /\.wallet-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*520px\),\s*1fr\)\);/,
    );
    assert.match(globalStyles, /\.wallet-ticket\s*\{[\s\S]*?min-width:\s*0;/);
    assert.match(
      mobileStyles,
      /\.wallet-grid,[\s\S]*?\.metric-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    );
  });

  it('contains poster artwork and ticket media inside their frames', () => {
    assert.match(globalStyles, /img,\s*video\s*\{[\s\S]*?max-width:\s*100%;/);
    assert.match(
      globalStyles,
      /\.event-card__visual::after\s*\{[\s\S]*?inset:\s*14px 14px 14px auto;[\s\S]*?width:\s*40%;/,
    );
    assert.match(
      globalStyles,
      /\.event-card__visual-title\s*\{[\s\S]*?max-width:\s*58%;[\s\S]*?-webkit-line-clamp:\s*3;/,
    );
    assert.match(
      globalStyles,
      /\.ticket-qr__loading\s*\{[\s\S]*?width:\s*min\(240px,\s*100%\);[\s\S]*?aspect-ratio:\s*1;/,
    );
  });
});
