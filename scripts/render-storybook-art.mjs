// Rebuild original vector artwork as portable PNGs using a local Chromium browser.
// No image-generation service, font service, or runtime native package is needed.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('../.cache/art-tools/node_modules/playwright')); }
const build = resolve(root, '.cache/storybook-art-build');
const output = resolve(root, 'client/assets/storybook');
await mkdir(output, { recursive: true });
const sources = (await readdir(resolve(root, 'client/artwork-source'))).filter(name => /\.tsx?$/.test(name)).map(name => `artwork-source/${name}`);
sources.push('src/storybook/palettes.ts');
for (const name of sources) {
  const input = await readFile(resolve(root, 'client', name), 'utf8');
  const result = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } });
  const destination = resolve(build, name.replace(/\.tsx?$/, '.js'));
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, result.outputText);
}
const { CharacterArt } = require(resolve(build, 'artwork-source/character-art.js'));
const { PalaceArt } = require(resolve(build, 'artwork-source/palace-art.js'));
const { DoorArt } = require(resolve(build, 'artwork-source/door-art.js'));
const { CharacterWalkArt } = require(resolve(build, 'artwork-source/character-walk-art.js'));
const { RoyalFigureArt, RiverLightArt, WaterfallLightArt } = require(resolve(build, 'artwork-source/scenery-art.js'));
const { PaperSilhouetteArt, OldPaperTextureArt, StationeryBorderArt, PalaceCrestArt, WoodGrainArt, WritingChamberArt, HearthArt, FireArt } = require(resolve(build, 'artwork-source/antique-letter-art.js'));
const { EmberRealmArt, FireGuardianArt, RealmAltarArt, EmberGlowArt, LivingFlameArt, RitualEngravingArt, CharredEdgeArt, AshPileArt } = require(resolve(build, 'artwork-source/ember-realm-art.js'));
const { FriendshipCourtArt } = require(resolve(build, 'artwork-source/friendship-art.js'));
const { LanternMark, Flourish, StoryIcon } = require(resolve(build, 'artwork-source/ornaments.js'));
const { palettes } = require(resolve(build, 'src/storybook/palettes.js'));
const browser = await chromium.launch({ headless: true, channel: process.env.STORYBOOK_BROWSER_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 1.5 });
  const jobs = Object.keys(palettes).flatMap(key => [
    { name: `character-${key}`, component: CharacterArt, props: { characterKey: key, size: 320 } },
    { name: `palace-${key}`, component: PalaceArt, props: { characterKey: key } },
  ]);
  jobs.push(...['left', 'right'].map(side => ({ name: `door-${side}`, component: DoorArt, props: { side } })));
  jobs.push(...Object.keys(palettes).flatMap(key => ['body', 'left-foot', 'right-foot'].map(part => ({ name: `walk-${key}-${part}`, component: CharacterWalkArt, props: { characterKey: key, part } }))));
  jobs.push(...['queen', 'angel'].map(kind => ({ name: `scenery-${kind}`, component: RoyalFigureArt, props: { kind } })));
  jobs.push({ name: 'river-light', component: RiverLightArt, props: {} }, { name: 'waterfall-light', component: WaterfallLightArt, props: {} });
  jobs.push({ name: 'paper-silhouette', component: PaperSilhouetteArt, props: {} }, { name: 'palace-crest', component: PalaceCrestArt, props: {} }, { name: 'desk-wood', component: WoodGrainArt, props: {} }, { name: 'writing-chamber', component: WritingChamberArt, props: {} }, { name: 'burning-hearth', component: HearthArt, props: {} });
  jobs.push(...['parchment', 'linen', 'vellum'].map(texture => ({ name: `paper-texture-${texture}`, component: OldPaperTextureArt, props: { texture } })));
  jobs.push(...['floral', 'stars', 'royal', 'postmark'].map(motif => ({ name: `paper-border-${motif}`, component: StationeryBorderArt, props: { motif } })));
  jobs.push({ name: 'hearth-fire-a', component: FireArt, props: {} }, { name: 'hearth-fire-b', component: FireArt, props: { alternate: true } });
  jobs.push({ name: 'ember-realm', component: EmberRealmArt, props: {} }, { name: 'fire-guardian', component: FireGuardianArt, props: {} }, { name: 'realm-altar', component: RealmAltarArt, props: {} }, { name: 'ember-glow', component: EmberGlowArt, props: {} });
  jobs.push({ name: 'living-fire-a', component: LivingFlameArt, props: {} }, { name: 'living-fire-b', component: LivingFlameArt, props: { alternate: true } }, { name: 'ritual-engraving', component: RitualEngravingArt, props: {} }, { name: 'charred-paper-edge', component: CharredEdgeArt, props: {} }, { name: 'ritual-ashes', component: AshPileArt, props: {} });
  jobs.push({ name: 'lantern', component: LanternMark, props: { size: 100 } }, { name: 'flourish', component: Flourish, props: { width: 360 } });
  jobs.push({ name: 'friendship-court', component: FriendshipCourtArt, props: {} });
  jobs.push(...['star', 'key', 'letter', 'gate', 'moon', 'arrow', 'close'].map(kind => ({ name: `icon-${kind}`, component: StoryIcon, props: { kind, size: 64 } })));
  for (const job of jobs) {
    const svg = renderToStaticMarkup(React.createElement(job.component, job.props));
    await writeFile(resolve(output, `${job.name}.svg`), svg);
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await page.locator('svg').screenshot({ path: resolve(output, `${job.name}.png`), omitBackground: true });
  }
  console.log(`Rendered ${jobs.length} original artworks to client/assets/storybook.`);
} finally { await browser.close(); }
