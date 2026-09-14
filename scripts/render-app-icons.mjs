w// Resize the user's supplied artwork locally. No image API, upload or new package.
// The source stays separate from render-storybook-art so regeneration cannot replace it.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('../.cache/art-tools/node_modules/playwright')); }
const { PNG } = require('pngjs');
const output = resolve(root, 'client/assets/app-icon');
const source = await readFile(resolve(root, 'client/artwork-source/launcher-original.png'));
const monochrome = await readFile(resolve(root, 'client/artwork-source/launcher-monochrome.svg'));
await mkdir(output, { recursive: true });
await mkdir(resolve(root, '.cache/app-icon-review'), { recursive: true });

const browser = await chromium.launch({ headless: true, channel: process.env.STORYBOOK_BROWSER_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage();
  const results = await page.evaluate(async ({ original, glyph }) => {
    const load = async url => { const image = new Image(); image.src = url; await image.decode(); return image; };
    const image = await load(original);
    if (image.width !== 1254 || image.height !== 1254) throw new Error('The crop is designed for the supplied 1254 by 1254 artwork.');
    const canvas = (size = 1024) => { const c = document.createElement('canvas'); c.width = c.height = size; return c; };
    const png = c => c.toDataURL('image/png').split(',')[1];

    // Ignore the translucent outer mockup shadow. Keep every painted subject intact.
    const painting = canvas(1254); const paint = painting.getContext('2d');
    paint.drawImage(image, 0, 0);
    const pixels = paint.getImageData(0, 0, 1254, 1254);
    for (let i = 3; i < pixels.data.length; i += 4) {
      pixels.data[i] = pixels.data[i] < 248 ? 0 : 255;
    }
    paint.putImageData(pixels, 0, 0);
    const icon = canvas(); const ctx = icon.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, 1024);
    sky.addColorStop(0, '#121529'); sky.addColorStop(.62, '#29253B'); sky.addColorStop(1, '#171525');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 1024, 1024);
    ctx.drawImage(painting, 94, 86, 1070, 1070, 0, 0, 1024, 1024);

    // Adaptive icons use a 108-dp canvas, with the essential subject inside 66 dp.
    // Keep the original scene sharp in the centre and extend its colours into the bleed.
    const background = canvas(); const bg = background.getContext('2d');
    bg.fillStyle = '#171829'; bg.fillRect(0, 0, 1024, 1024);
    bg.filter = 'blur(28px)'; bg.drawImage(icon, -48, -48, 1120, 1120); bg.filter = 'none';
    const foreground = canvas(); const fg = foreground.getContext('2d');
    const scale = .66, edge = (1 - scale) * 512, size = scale * 1024;
    const x = edge - 20, y = edge - 10;
    fg.drawImage(icon, x, y, size, size);
    // Feather only the photo's outer 24 px; lantern, letter and wax remain untouched.
    const rgba = fg.getImageData(0, 0, 1024, 1024);
    for (let py = 0; py < 1024; py++) for (let px = 0; px < 1024; px++) {
      const distance = Math.min(px - x, py - y, x + size - px, y + size - py);
      const t = Math.max(0, Math.min(1, distance / 24));
      rgba.data[(py * 1024 + px) * 4 + 3] *= t * t * (3 - 2 * t);
    }
    fg.putImageData(rgba, 0, 0);
    const mono = canvas(); mono.getContext('2d').drawImage(await load(glyph), 0, 0);
    const notification = canvas(96);
    const mask = mono.getContext('2d').getImageData(0, 0, 1024, 1024).data;
    let left = 1024, top = 1024, right = 0, bottom = 0;
    for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) {
      if (!mask[(y * 1024 + x) * 4 + 3]) continue;
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
    const w = right - left + 1, h = bottom - top + 1, fit = 78 / Math.max(w, h);
    notification.getContext('2d').drawImage(mono, left, top, w, h, (96 - w * fit) / 2, (96 - h * fit) / 2, w * fit, h * fit);
    const favicon = canvas(64); favicon.getContext('2d').drawImage(icon, 0, 0, 64, 64);
    const composite = canvas(); composite.getContext('2d').drawImage(background, 0, 0); composite.getContext('2d').drawImage(foreground, 0, 0);
    return { 'icon.png': png(icon), 'adaptive-background.png': png(background), 'adaptive-foreground.png': png(foreground), 'monochrome.png': png(mono), 'notification.png': png(notification), 'favicon.png': png(favicon), preview: png(composite) };
  }, { original: `data:image/png;base64,${source.toString('base64')}`, glyph: `data:image/svg+xml;base64,${monochrome.toString('base64')}` });

  for (const [name, base64] of Object.entries(results)) {
    if (name === 'preview') continue;
    let bytes = Buffer.from(base64, 'base64');
    // iOS/legacy launcher and adaptive background must be fully opaque RGB PNGs.
    if (['icon.png', 'adaptive-background.png', 'favicon.png'].includes(name)) {
      bytes = PNG.sync.write(PNG.sync.read(bytes), { colorType: 2, inputColorType: 6, inputHasAlpha: true });
    }
    await writeFile(resolve(output, name), bytes);
  }
  const picture = name => `data:image/png;base64,${results[name]}`;
  await page.setViewportSize({ width: 1120, height: 610 });
  await page.setContent(`<!doctype html><html><style>
    *{box-sizing:border-box}body{margin:0;background:#F8F2E2;color:#483B32;padding:40px;font-family:Georgia,serif}h1{font-size:30px;margin:0 0 12px}p{font:15px Arial;color:#726354;margin:0 0 32px}.row{display:flex;gap:30px}.item{text-align:center;width:184px}.frame{width:172px;height:172px;background:#171829;overflow:hidden;margin:0 auto 18px}.frame img{width:100%;height:100%}.circle{border-radius:50%}.square{border-radius:26%}.adaptive img{width:150%;height:150%;margin:-25%}.themed{background:#E9DDBD}.themed img{filter:brightness(0) saturate(100%) invert(25%)}.small{display:flex;align-items:center;justify-content:center;height:172px;gap:16px}.small img{width:48px;height:48px;border-radius:24%}.small .tiny{width:32px;height:32px}.name{font-size:16px}.note{margin-top:38px;font:14px/1.6 Arial;color:#726354}footer{font:12px Arial;color:#85745B;margin-top:24px}
    </style><h1>Lantern Post · phone icons</h1><p>Your lantern, sealed letter and moonlit palace.</p><div class="row">
    <div class="item"><div class="frame square"><img src="${picture('icon.png')}"></div><div class="name">Full-colour icon</div></div>
    <div class="item"><div class="frame circle adaptive"><img src="${picture('preview')}"></div><div class="name">Android · circle</div></div>
    <div class="item"><div class="frame square adaptive"><img src="${picture('preview')}"></div><div class="name">Android · rounded</div></div>
    <div class="item"><div class="frame circle adaptive themed"><img src="${picture('monochrome.png')}"></div><div class="name">Android · themed</div></div>
    <div class="item"><div class="small"><img src="${picture('icon.png')}"><img class="tiny" src="${picture('icon.png')}"></div><div class="name">48 px / 32 px</div></div>
    </div><div class="note">Artwork stays centred inside the launcher mask. A simplified lantern and wax-sealed letter<br>keep Android themed icons and notification symbols legible at small sizes.</div><footer>Shape previews approximate Android launcher masks; wallpaper colours are controlled by the phone.</footer></html>`);
  await page.evaluate(async () => { await Promise.all([...document.images].map(image => image.decode())); });
  await page.screenshot({ path: resolve(root, '.cache/app-icon-review/preview.png') });
  console.log('Generated six bundled launcher/notification assets and .cache/app-icon-review/preview.png.');
} finally { await browser.close(); }
