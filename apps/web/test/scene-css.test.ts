import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readCss, rule } from './css';

const scene = readCss(new URL('../src/scene/scene.css', import.meta.url));
const table = readCss(new URL('../src/tabletop/tabletop.css', import.meta.url));

describe('the video stage (spec 2026-09-26-video-stage)', () => {
  it('draws no table of its own: the felt, the rail and the ground are the video', () => {
    for (const css of [scene, table]) expect(css).not.toMatch(/\.table-felt|\.table-rail|\.table-edge|\.table-body|\.scene-ground|--felt-radius|rotateX/);
    expect(scene).not.toMatch(/perspective/);
  });

  it('is one 1920×1080 box, scaled from its top left corner, on a dark letterbox', () => {
    const stage = rule(scene, '.stage');
    expect(stage).toMatch(/width:\s*1920px/);
    expect(stage).toMatch(/height:\s*1080px/);
    expect(stage).toMatch(/transform-origin:\s*0 0/);
    // clip, unlike hidden, cannot be scrolled by focus(): focusing a card never shifts the table.
    expect(stage).toMatch(/overflow:\s*clip/);
    expect(stage).toMatch(/url\('\/bg_poster\.jpg'\)/);
    expect(rule(table, '.tabletop')).toMatch(/background:\s*#0b1320/);
  });

  it('plays the video under everything, covering the stage and letting clicks through', () => {
    const video = rule(scene, '.stage-video');
    expect(video).toMatch(/object-fit:\s*cover/);
    expect(video).toMatch(/pointer-events:\s*none/);
  });

  it('lays a vignette over the table, never catching a click', () => {
    const vignette = rule(scene, '.stage-vignette');
    expect(vignette).toMatch(/radial-gradient\(ellipse at center, transparent 55%, rgb\(0 0 0 \/ 0\.35\)\)/);
    expect(vignette).toMatch(/pointer-events:\s*none/);
  });

  it('places the stage’s own things in stage px, never in viewport units', () => {
    const raw = readFileSync(new URL('../src/tabletop/tabletop.css', import.meta.url), 'utf8');
    for (const selector of ['.hand-fan.is-scrolling', '.end-turn', '.narrator', '.pending-stage', '.tray']) expect(rule(table, selector), selector).not.toMatch(/\d(vw|vh)\b/);
    expect(raw).not.toMatch(/data-layout|data-compact/);
  });

  it('lets clicks through the UI layer to the stage, except on its own controls', () => {
    expect(rule(table, '.stage-ui')).toMatch(/pointer-events:\s*none/);
    expect(rule(table, '.stage-ui :is(.tray, .popover, .hud, .log-drawer, .gameover-backdrop)')).toMatch(/pointer-events:\s*auto/);
  });
});

describe('cards lying on the video table', () => {
  it('cast a contact shadow, the deck too', () => {
    expect(rule(table, '.table-card')).toMatch(/box-shadow:\s*0 8px 18px rgb\(0 0 0 \/ 0\.45\), 0 2px 4px rgb\(0 0 0 \/ 0\.3\)/);
    expect(rule(table, '.deck > .card-svg')).toMatch(/0 8px 18px rgb\(0 0 0 \/ 0\.45\)/);
  });

  it('keep empty slots quiet: dashed at 60 % white, the slot at 45 % opacity', () => {
    for (const selector of ['.tableau-empty', '.bank-empty,\n.pile-empty']) {
      expect(rule(table, selector), selector).toMatch(/opacity:\s*0\.45/);
      expect(rule(table, selector), selector).toMatch(/dashed rgb\(255 255 255 \/ 0\.6\)/);
    }
  });

  it('shadow the money and deck badges so they read on the video', () => {
    expect(rule(table, '.bank-total')).toMatch(/box-shadow:/);
    expect(rule(table, '.count-badge')).toMatch(/box-shadow:/);
  });

  it('seat each player on a dark plate, so the name reads over the floor', () => {
    expect(rule(table, '.seat')).toMatch(/background:\s*rgb\(11 19 32 \/ 0\.55\)/);
  });
});

describe('the table pieces', () => {
  it('stacks and spaces tableau cards by the fit, not by fixed numbers', () => {
    expect(rule(table, '.group-stack > .table-card + .table-card')).toMatch(/var\(--cascade/);
    expect(rule(table, '.bank-pile > .table-card + .table-card')).toMatch(/var\(--bank-step/);
    expect(table).toMatch(/margin-left:\s*calc\(var\(--card-w\) \* var\(--gap/);
    expect(table).not.toMatch(/--hand-w:\s*(clamp|\d)/);
  });

  it('lifts a hovered hand card 12 px and scales it to 1.05, and a selected one fully on screen at 1.08', () => {
    const hover = rule(table, '.hand-fan > li:hover,\n.hand-fan > li:focus-within');
    expect(hover).toMatch(/translateY\(calc\(var\(--drop, 0px\) - 12px\)\)/);
    expect(hover).toMatch(/scale\(1\.05\)/);
    // It keeps its turn, so it never swings out from under the pointer.
    expect(hover).toMatch(/rotate\(var\(--rot, 0deg\)\)/);
    expect(rule(table, '.hand-fan > li')).toMatch(/transition:\s*transform 0\.15s ease-out/);
    const pressed = rule(table, '.hand-fan > li:has(> .is-pressed)');
    expect(pressed).toMatch(/var\(--hand-rest\)/);
    expect(pressed).toMatch(/scale\(1\.08\)/);
    expect(rule(table, '.hand-fan > li')).toMatch(/margin-left:\s*calc\(var\(--step/);
    // handFan counts the outer cards' swing about this pivot (FAN_PIVOT = 1.6 card heights).
    expect(rule(table, '.hand-fan > li')).toMatch(/transform-origin:\s*50% 160%/);
    expect(table).toMatch(/\.hand-fan \.table-card\.tone-playable/);
  });

  it('sizes the seat UI from the layout: the avatar, and the card backs beside it', () => {
    expect(rule(table, '.seat')).not.toMatch(/--avatar:/);
    expect(rule(table, '.avatar-frame')).toMatch(/var\(--avatar/);
    expect(rule(table, '.back-card')).toMatch(/var\(--avatar/);
    expect(rule(table, '.pending-cards .card-svg')).toMatch(/var\(--card-w/);
  });

  it('lays "No properties yet" in a card-sized slot, so a tableau never spills out of its zone', () => {
    const empty = rule(table, '.tableau-empty');
    expect(empty).toMatch(/width:\s*var\(--card-w\)/);
    expect(empty).toMatch(/aspect-ratio:\s*5 \/ 7/);
  });
});

describe('the chat', () => {
  it('wraps a long word or link instead of widening the sheet or the bubble', () => {
    const chat = readCss(new URL('../src/chat/chat.css', import.meta.url));
    expect(rule(chat, '.chat-lines li')).toMatch(/overflow-wrap:\s*anywhere/);
    expect(rule(chat, '.chat-bubble')).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it('keeps a long line short at the seat, where the stage top and the corner buttons would clip it', () => {
    const chat = readCss(new URL('../src/chat/chat.css', import.meta.url));
    expect(rule(chat, '.chat-bubble')).toMatch(/-webkit-line-clamp:\s*3/);
  });
});
