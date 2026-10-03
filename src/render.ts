// Renders assets/*.svg and README.md from data/. Output depends only on
// data/, the embedded font, and this file, so unchanged data produces
// byte-identical files and the daily job commits nothing.
//
// The SVG-in-<img> technique (CSS animation and embedded fonts inside images,
// which GitHub's README sanitizer leaves alone) comes from Giorgi Kobaidze's
// profile: https://github.com/georgekobaidze/georgekobaidze (MIT).
import {mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import subsetFont from 'subset-font';
import {type Project, type Snapshot, slugify} from './data.ts';

// jdx.dev's palette.
const C = {
	bg: '#0c0c0b',
	raised: '#141413',
	term: '#1a1a18',
	border: '#2a2a25',
	text: '#e8e6e0',
	muted: '#9a9890',
	amber: '#e8b84b',
};
// The first CARDS projects get a card; the rest go in a one-line list.
const CARDS = 7;
// Desktop images are drawn at the 860px Giorgi uses (the README column is
// 846px). Below NARROW_QUERY, <picture> swaps in phone layouts drawn at
// roughly the size they are shown, so their text stays legible.
const WIDE = 860;
const NARROW = 430;
const NARROW_HALF = 184;
const NARROW_QUERY = '(max-width: 600px)';
// Transparent space below every card and between the two cards of a row.
const GAP = 8;
// JetBrains Mono advances every glyph by 0.6em.
const ADVANCE = 0.6;
const RAW = 'https://github.com/jdx/jdx/raw/main/assets';
const CREDIT_URL = 'https://github.com/georgekobaidze/georgekobaidze';
const CREDIT_POST = 'https://dev.to/georgekobaidze/i-turned-my-github-profile-into-a-cyberpunk-console-with-a-city-built-from-my-contributions-h4c';
const STAR_PATH = 'M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7L12 17.5 5.8 21l1.6-7L2 9.3l7.1-.7z';

const FONT_DIR = 'node_modules/@fontsource/jetbrains-mono/files';
const fonts = {
	400: await readFile(`${FONT_DIR}/jetbrains-mono-latin-400-normal.woff2`),
	700: await readFile(`${FONT_DIR}/jetbrains-mono-latin-700-normal.woff2`),
};

function esc(s: string): string {
	return s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
}

function len(s: string): number {
	return [...s].length;
}

const f1 = (n: number) => Number(n.toFixed(1));

// 3 significant figures: 952702 → 953k, 43812 → 43.8k.
function short(n: number): string {
	const [div, unit] = n >= 1e6 ? [1e6, 'M'] : n >= 1e3 ? [1e3, 'k'] : [1, ''];
	return `${Number((n / div).toPrecision(3))}${unit}`;
}

// Greedy word wrap into at most `lines` lines of `max` characters.
function wrap(s: string, max: number, lines: number): string[] {
	const out: string[] = [];
	let line = '';
	for (const word of s.split(' ')) {
		if (line && len(line) + 1 + len(word) > max) {
			out.push(line);
			line = word;
		} else {
			line = line ? `${line} ${word}` : word;
		}
	}
	out.push(line);
	if (out.length > lines) {
		out.length = lines;
		out[lines - 1] = `${out[lines - 1].slice(0, max - 1)}…`;
	}
	return out;
}

type Text = {400?: string; 700?: string};

// Wraps a body in an <svg> that embeds only the glyphs it uses.
async function svg(w: number, h: number, label: string, text: Text, css: string, body: string): Promise<string> {
	const faces: string[] = [];
	for (const weight of [400, 700] as const) {
		const chars = [...new Set(text[weight] ?? '')].sort().join('');
		if (!chars.trim()) continue;
		const subset = await subsetFont(fonts[weight], chars, {targetFormat: 'woff2'});
		faces.push(`@font-face{font-family:JBM;font-weight:${weight};src:url(data:font/woff2;base64,${subset.toString('base64')}) format("woff2")}`);
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
<!-- SVG-in-img approach after @georgekobaidze: ${CREDIT_URL} -->
<style>
${faces.join('\n')}
text{font-family:JBM,ui-monospace,SFMono-Regular,Menlo,monospace}
${css}
</style>
${body}
</svg>
`;
}

async function header(w: number, size: number, tagSize: number): Promise<string> {
	const h = Math.round(size * 2.5);
	const pad = Math.round(size * 0.9);
	const tagline = 'open source at entire.io';
	const css = `
.cur{animation:blink 1.1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){.cur{animation:none}}`;
	const body = `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="10" fill="${C.bg}" stroke="${C.border}"/>
<text x="${pad}" y="${f1(h / 2 + size * 0.36)}" font-size="${size}" font-weight="700" fill="${C.text}"><tspan fill="${C.amber}">&gt;</tspan> @jdx <tspan class="cur" fill="${C.amber}">_</tspan></text>
<text x="${w - pad}" y="${f1(h / 2 + tagSize * 0.36)}" font-size="${tagSize}" fill="${C.muted}" text-anchor="end">${esc(tagline)}</text>`;
	return svg(w, h, '> @jdx _', {400: tagline, 700: '> @jdx _'}, css, body);
}

// Cards are always dark, so logos that follow the page's color scheme are
// pinned to their dark-scheme rules.
async function logoHref(p: Project): Promise<string | null> {
	const slug = slugify(p.name);
	const svgLogo = await readFile(`data/logos/${slug}.svg`, 'utf8').catch(() => null);
	if (svgLogo) {
		const dark = svgLogo
			.replace(/@media\s*\(prefers-color-scheme:\s*dark\)/g, '@media all')
			.replace(/@media\s*\(prefers-color-scheme:\s*light\)/g, '@media not all');
		return `data:image/svg+xml;base64,${Buffer.from(dark).toString('base64')}`;
	}
	const png = await readFile(`data/logos/${slug}.png`).catch(() => null);
	return png ? `data:image/png;base64,${png.toString('base64')}` : null;
}

type Typing = {x: number; y: number; size: number; strip: {x: number; y: number; w: number; h: number}; delay: number};

// A terminal strip whose command types itself out once, `delay` seconds
// after load. Without animation (reduced motion, or a renderer that ignores
// CSS) the base styles show the finished command and no caret.
function typed(cmd: string, t: Typing): {css: string; body: string} {
	const n = len(cmd);
	const charW = t.size * ADVANCE;
	const startX = t.x + 2 * charW;
	const dist = n * charW;
	const duration = Math.max(0.4, n * 0.045);
	const css = `
.cover{transform:translateX(${f1(dist)}px);animation:type ${duration.toFixed(2)}s steps(${n},jump-end) ${t.delay.toFixed(2)}s backwards}
.caret{opacity:0;animation:caret ${(duration + 0.8).toFixed(2)}s steps(1) ${t.delay.toFixed(2)}s backwards}
@keyframes type{from{transform:translateX(0)}}
@keyframes caret{0%,100%{opacity:1}}
@media (prefers-reduced-motion:reduce){.cover,.caret{animation:none}}`;
	const s = t.strip;
	const caretH = f1(t.size * 1.15);
	const body = `<defs><clipPath id="strip"><rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="6"/></clipPath></defs>
<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="6" fill="${C.term}"/>
<text x="${t.x}" y="${t.y}" font-size="${t.size}" fill="${C.text}"><tspan fill="${C.amber}">$</tspan> ${esc(cmd)}</text>
<g clip-path="url(#strip)"><g class="cover">
<rect x="${f1(startX)}" y="${s.y}" width="${f1(dist + charW * 2)}" height="${s.h}" fill="${C.term}"/>
<rect class="caret" x="${f1(startX)}" y="${f1(t.y - t.size * 0.88)}" width="${f1(charW)}" height="${caretH}" fill="${C.amber}"/>
</g></g>`;
	return {css, body};
}

function star(x: number, y: number, size: number): string {
	return `<path d="${STAR_PATH}" transform="translate(${f1(x)} ${f1(y)}) scale(${f1(size / 24 * 100) / 100})" fill="${C.muted}"/>`;
}

type Side = 'full' | 'left' | 'right';

function insets(side: Side): [number, number] {
	return side === 'left' ? [0, GAP / 2] : side === 'right' ? [GAP / 2, 0] : [0, 0];
}

// The desktop card (and the phone card for mise): logo, name, kind and stars
// on one row, then a one-line blurb, then the install command.
async function card(p: Project, w: number, side: Side, blurb: string, delay: number): Promise<string> {
	const [l, r] = insets(side);
	const cw = w - l - r;
	const x = l + 20;
	const h = 124;
	const kind = p.kind.toUpperCase();
	const logo = await logoHref(p);
	const t = typed(p.install, {x: l + 32, y: 102, size: 13, strip: {x, y: 84, w: cw - 40, h: 26}, delay});
	const body = `<rect x="${l + 0.5}" y=".5" width="${cw - 1}" height="${h - 1}" rx="10" fill="${C.raised}" stroke="${C.border}"/>
${logo ? `<image href="${logo}" x="${x}" y="18" width="28" height="28"/>` : ''}
<text x="${l + 58}" y="39" font-size="20" font-weight="700" fill="${C.text}">${esc(p.name)}</text>
<text x="${f1(l + 58 + len(p.name) * 12 + 12)}" y="38" font-size="10" fill="${C.amber}" letter-spacing="1.2">${esc(kind)}</text>
${star(l + cw - 20 - len(p.stars) * 7.8 - 16, 27, 12)}
<text x="${l + cw - 20}" y="38" font-size="13" fill="${C.muted}" text-anchor="end">${esc(p.stars)}</text>
<text x="${x}" y="70" font-size="14" fill="${C.muted}">${esc(blurb)}</text>
${t.body}`;
	const label = `${p.name}: ${blurb}. Install: ${p.install}`;
	return svg(w, h + GAP, label, {400: `${kind}${p.stars}${blurb}$ ${p.install}`, 700: p.name}, t.css, body);
}

// The phone half-card: stars and kind get their own row and the blurb may
// wrap, so everything fits in ~180px at a readable size.
async function compactCard(p: Project, side: Side, delay: number): Promise<string> {
	const w = NARROW_HALF;
	const [l, r] = insets(side);
	const cw = w - l - r;
	const x = l + 12;
	const h = 122;
	const kind = p.kind.toUpperCase();
	const blurb = p.tagline || p.description;
	const lines = wrap(blurb, Math.floor((cw - 24) / (11 * ADVANCE)), 2);
	const logo = await logoHref(p);
	const t = typed(p.install, {x: l + 19, y: 107, size: 10, strip: {x, y: 92, w: cw - 24, h: 22}, delay});
	const body = `<rect x="${l + 0.5}" y=".5" width="${cw - 1}" height="${h - 1}" rx="9" fill="${C.raised}" stroke="${C.border}"/>
${logo ? `<image href="${logo}" x="${x}" y="12" width="20" height="20"/>` : ''}
<text x="${x + 27}" y="28" font-size="16" font-weight="700" fill="${C.text}">${esc(p.name)}</text>
${star(x, 39.5, 10)}
<text x="${x + 13}" y="48" font-size="11" fill="${C.muted}">${esc(p.stars)}</text>
<text x="${l + cw - 12}" y="48" font-size="9" fill="${C.amber}" letter-spacing="1" text-anchor="end">${esc(kind)}</text>
${lines.map((line, i) => `<text x="${x}" y="${68 + i * 14}" font-size="11" fill="${C.muted}">${esc(line)}</text>`).join('\n')}
${t.body}`;
	const label = `${p.name}: ${blurb}. Install: ${p.install}`;
	return svg(w, h + GAP, label, {400: `${kind}${p.stars}${lines.join('')}$ ${p.install}`, 700: p.name}, t.css, body);
}

function milestone(history: Record<string, number>): string | null {
	const dates = Object.keys(history).sort();
	if (!dates.length) return null;
	const latest = history[dates.at(-1)!];
	const passed = Math.floor(latest / 1e6) * 1e6;
	if (passed > 0) {
		const crossed = dates.find(d => history[d] >= passed)!;
		const days = (Date.parse(dates.at(-1)!) - Date.parse(crossed)) / 864e5;
		if (days <= 7) {
			return `mise passed **${passed.toLocaleString('en-US')}** monthly users on ${longDate(crossed)}. Thank you.`;
		}
	}
	const next = passed + 1e6;
	if (latest >= next * 0.95) return `mise is ${short(next - latest)} short of ${short(next)} monthly users.`;
	return null;
}

function longDate(iso: string): string {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {month: 'long', day: 'numeric', timeZone: 'UTC'});
}

function shortDate(iso: string): string {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'});
}

function searchUrl(query: string): string {
	return `https://github.com/search?${new URLSearchParams({q: query, type: 'issues'})}`;
}

function clip(s: string, max: number): string {
	if (s.length <= max) return s;
	return `${s.slice(0, s.lastIndexOf(' ', max - 1)).replace(/[,.;:]$/, '')}…`;
}

// An image that swaps to its phone layout below NARROW_QUERY. srcset is
// absolute because GitHub only rewrites relative <img src>.
function picture(file: string, width: string, alt: string): string {
	const narrow = file.replace(/\.svg$/, '-narrow.svg');
	return `<picture><source media="${NARROW_QUERY}" srcset="${RAW}/${narrow}"><img src="./assets/${file}" width="${width}" align="top" alt="${esc(alt)}"></picture>`;
}

function readme(s: Snapshot, history: Record<string, number>, carded: Project[], rest: Project[]): string {
	const out: string[] = [];
	out.push('<!-- Generated by `mise run readme` from src/render.ts. Edit that, not this. -->');
	out.push(`<a href="https://jdx.dev">${picture('header.svg', '100%', '> @jdx _')}</a>`, '');

	const intro = s.intro.replace('entire.io', '[entire.io](https://entire.io)');
	out.push(`${intro} Most people know me for mise. Here's everything I make.`, '');
	const note = s.mau ? milestone(history) : null;
	if (note) out.push(note, '');

	const stats: string[] = [];
	if (s.mau) stats.push(`**${short(s.mau.value)}** [mise monthly users](https://mise-versions.jdx.dev/stats)`);
	if (s.stars) stats.push(`**${short(s.stars)}** [stars](https://github.com/jdx?tab=repositories&sort=stargazers)`);
	if (s.issues) stats.push(`**${s.issues.count}** [open issues](${searchUrl(s.issues.query)})`);
	if (s.prs) stats.push(`**${s.prs.count}** [open PRs](${searchUrl(s.prs.query)})`);
	if (stats.length) out.push(stats.join(' · '), '');

	// One paragraph, no whitespace inside a row: two 50% images fill it
	// exactly, and the gutters are drawn into the SVGs.
	const cardLink = (p: Project, width: string) =>
		`<a href="${esc(p.href)}">${picture(`card-${slugify(p.name)}.svg`, width, `${p.name}: ${p.tagline || p.description}. Install: ${p.install}`)}</a>`;
	const [first, ...pairs] = carded;
	const rows = [cardLink(first, '100%')];
	for (let i = 0; i < pairs.length; i += 2) rows.push(pairs.slice(i, i + 2).map(p => cardLink(p, '50%')).join(''));
	out.push(`<p>\n${rows.join('\n')}\n</p>`, '');

	const globals = carded.slice(1).map(p => p.install.match(/^mise use -g (\S+)$/)?.[1]).filter(Boolean);
	if (globals.length > 1) {
		out.push('Try them all:', '', '```sh', `mise use -g ${globals.join(' ')}`, '```', '');
	}
	if (rest.length) {
		out.push(`**Also:** ${rest.map(p => `[${p.name}](${p.href}) ${p.tagline || p.description}`).join(' · ')}`, '');
	}

	if (s.posts.length) {
		out.push('### Latest writing', '');
		for (const p of s.posts.slice(0, 3)) out.push(`- ${shortDate(p.date)} · [${p.title}](${p.url}): ${clip(p.description, 120)}`);
		out.push('', '[All posts](https://jdx.dev/posts/) · [RSS](https://jdx.dev/posts/index.xml)', '');
	}

	out.push('<sub><a href="https://jdx.dev/sponsors">Sponsor</a> · <a href="https://jdx.dev/members">Members</a> · <a href="https://jdx.dev">jdx.dev</a></sub><br>');
	out.push(`<sub>Regenerated daily by <code>mise run readme</code> (<a href="https://github.com/jdx/jdx">source</a>). SVG cards inspired by <a href="${CREDIT_URL}">Giorgi Kobaidze</a>'s profile (<a href="${CREDIT_POST}">how he built it</a>).</sub>`);
	return `${out.join('\n')}\n`;
}

async function main() {
	const s: Snapshot = JSON.parse(await readFile('data/snapshot.json', 'utf8'));
	const history: Record<string, number> = JSON.parse(await readFile('data/mau.json', 'utf8').catch(() => '{}'));
	const carded = s.projects.slice(0, CARDS);
	const rest = s.projects.slice(CARDS);

	const files = new Map<string, string>();
	files.set('header.svg', await header(WIDE, 30, 14));
	files.set('header-narrow.svg', await header(NARROW, 26, 12));
	for (const [i, p] of carded.entries()) {
		const name = `card-${slugify(p.name)}`;
		const delay = 0.4 + i * 0.35;
		if (i === 0) {
			files.set(`${name}.svg`, await card(p, WIDE, 'full', p.description, delay));
			files.set(`${name}-narrow.svg`, await card(p, NARROW, 'full', p.tagline || p.description, delay));
		} else {
			const side = i % 2 === 1 ? 'left' : 'right';
			files.set(`${name}.svg`, await card(p, WIDE / 2, side, p.tagline || p.description, delay));
			files.set(`${name}-narrow.svg`, await compactCard(p, side, delay));
		}
	}

	await mkdir('assets', {recursive: true});
	for (const f of await readdir('assets')) if (f.endsWith('.svg') && !files.has(f)) await rm(`assets/${f}`);
	for (const [name, content] of files) await writeFile(`assets/${name}`, content);
	await writeFile('README.md', readme(s, history, carded, rest));
	console.log(`rendered ${files.size} SVGs and README.md`);
}

await main();
