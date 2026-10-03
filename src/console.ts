// The console frame every slice is drawn in, ported from Giorgi Kobaidze's
// render.py (github.com/georgekobaidze/georgekobaidze, MIT; see NOTICE).
//
// Every slice is W wide and a multiple of 40px tall so the background grid
// lines up across slices. All slices draw the same side rails; only the first
// draws the top edge and only the last closes the frame, so the stacked
// <img>s read as one console.
import {readFile} from 'node:fs/promises';
import subsetFont from 'subset-font';

export type Theme = {
	name: string;
	accent: string;
	accent2: string;
	ok: string;
	bg: string;
	fg: string;
	dim: string;
	faint: string;
	fainter: string;
	bright: string;
	star: string;
	langs: string[];
	// Per-tool chart colors; the last is for everything else.
	series: string[];
	well: string;
	moon: string;
	city: {
		roofs: [string, string, string, string];
		left: string;
		right: string;
		empty: string;
		emptyStroke: string;
		winOn: string;
		winSide: string;
		winOff: string;
		sky: string;
	};
};

// Giorgi's neon palette.
export const NEON: Theme = {
	name: 'neon',
	accent: '#00d9ff',
	accent2: '#ff2bd6',
	ok: '#3fb950',
	bg: '#03040a',
	fg: '#c9d1d9',
	dim: '#8b949e',
	faint: '#6e7681',
	fainter: '#484f58',
	bright: '#f0fbff',
	star: '#e3b341',
	langs: ['#00d9ff', '#ff2bd6', '#3fb950', '#e3b341', '#bc8cff', '#6e7681'],
	series: ['#bc8cff', '#ff2bd6', '#00d9ff', '#a3e635', '#ff7ab6', '#e3b341', '#ff9e3d', '#6e7681'],
	well: '#11161d',
	moon: '#e6edf3',
	city: {
		roofs: ['#0c2d6b', '#1554c0', '#2f81f7', '#1fd5ff'],
		left: '#1a2440',
		right: '#111831',
		empty: '#161b22',
		emptyStroke: '#0d1117',
		winOn: '#7df9ff',
		winSide: '#4cc9f0',
		winOff: '#111827',
		sky: '#c9d1d9',
	},
};

// jdx.dev's palette pushed into the same neon treatment.
export const AMBER: Theme = {
	name: 'amber',
	accent: '#e8b84b',
	accent2: '#ff5f3a',
	ok: '#6ee79a',
	bg: '#0c0c0b',
	fg: '#e8e6e0',
	dim: '#9a9890',
	faint: '#75736c',
	fainter: '#4d4b45',
	bright: '#fff8e7',
	star: '#f0ca6e',
	langs: ['#e8b84b', '#ff5f3a', '#6ee79a', '#7dcfff', '#c792ea', '#75736c'],
	series: ['#c792ea', '#ff5f3a', '#7dcfff', '#a3e635', '#ff7ab6', '#e8b84b', '#ff9e3d', '#75736c'],
	well: '#1a1916',
	moon: '#f3efe2',
	city: {
		roofs: ['#4a3410', '#8a5f14', '#d0951f', '#ffd36e'],
		left: '#2a2216',
		right: '#1d170e',
		empty: '#17150f',
		emptyStroke: '#0c0c0b',
		winOn: '#ffe7a3',
		winSide: '#e8b84b',
		winOff: '#1f1b13',
		sky: '#e8e6e0',
	},
};

export const THEMES: Record<string, Theme> = {neon: NEON, amber: AMBER};

export const W = 880;
export const M = 16; // transparent side margin, room for the glow
export const FL = M;
export const FR = W - M;
export const X = 52; // text left edge
export const HW = W / 2; // half-slice width, a multiple of 40

export function esc(s: string | number): string {
	return String(s)
		// Control characters are not allowed in XML at all.
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
		.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;'})[c]!);
}

function unescape(s: string): string {
	return s
		.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
		.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
		.replace(/&(lt|gt|quot|amp);/g, (_, n) => ({lt: '<', gt: '>', quot: '"', amp: '&'})[n as 'lt']);
}

// The characters a piece of SVG markup displays, so the font subset never misses one.
export function visible(markup: string): string {
	return unescape(markup.replace(/<[^>]+>/g, ''));
}

export const num = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-US'));
export const f1 = (n: number) => n.toFixed(1);
export const up40 = (v: number) => Math.ceil(v / 40) * 40;

const FONT_DIR = 'node_modules/@fontsource/jetbrains-mono/files';
const fontCache = new Map<number, Buffer>();

async function faces(text: string, weights: number[]): Promise<string> {
	const chars = [...new Set(`${text}0123456789`)].sort().join('');
	const out: string[] = [];
	for (const w of weights) {
		if (!fontCache.has(w)) fontCache.set(w, await readFile(`${FONT_DIR}/jetbrains-mono-latin-${w}-normal.woff2`));
		const subset = await subsetFont(fontCache.get(w)!, chars, {targetFormat: 'woff2'});
		out.push(`@font-face{font-family:'JBM';font-weight:${w};src:url(data:font/woff2;base64,${subset.toString('base64')}) format('woff2')}`);
	}
	return out.join('');
}

export function baseCss(t: Theme): string {
	return `text{font-family:'JBM',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:15px}
.dim{fill:${t.dim}}.cy{fill:${t.accent}}.fg{fill:${t.fg}}.gr{fill:${t.ok}}.wh{fill:${t.bright}}.fainter{fill:${t.fainter}}
@keyframes fadein{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
.ln{animation:fadein .35s ease-out both}
.cursor{animation:blink 1.05s step-end infinite}
.dot{animation:pulse 2s ease-in-out infinite}`;
}

export function baseDefs(t: Theme, gridX = 0): string {
	// #glow and #gl cover the whole image: a filter region relative to the
	// bounding box is empty for a perfectly straight line (a lone rail, an
	// underline), so those glows would not render at all.
	return `<pattern id="grid" x="${gridX}" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="${t.accent}" stroke-opacity=".06"/></pattern>
<filter id="glow" filterUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="g" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="gl" filterUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%"><feGaussianBlur stdDeviation="4"/></filter>`;
}

type Doc = {
	w: number;
	h: number;
	title: string;
	desc: string;
	text: string;
	body: string;
	css?: string;
	defs?: string;
	weights?: number[];
};

// Shared document wrapper; `frame` draws the background, rails and glow.
export async function document(t: Theme, d: Doc, frame: {under: string; over: string}): Promise<string> {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${d.w}" height="${d.h}" viewBox="0 0 ${d.w} ${d.h}" role="img" aria-labelledby="t d">
<title id="t">${esc(d.title)}</title>
<desc id="d">${esc(d.desc)}</desc>
<style>
${await faces(d.text + visible(d.body), d.weights ?? [400, 700])}
${baseCss(t)}
${d.css ?? ''}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
<defs>
${d.defs ?? baseDefs(t)}
</defs>
${frame.under}
${d.body}
${frame.over}
</svg>
`;
}

// Where a slice draws: desktop slices are 880px wide; phone slices are
// 440px and swap in through <picture> below 600px. R is the right edge of the
// text column.
export type Geo = {narrow: boolean; W: number; M: number; FL: number; FR: number; X: number; R: number; HW: number};
export const DESKTOP: Geo = {narrow: false, W: 880, M: 16, FL: 16, FR: 864, X: 52, R: 828, HW: 440};
export const PHONE: Geo = {narrow: true, W: 440, M: 10, FL: 10, FR: 430, X: 28, R: 412, HW: 220};

type SliceOpts = Omit<Doc, 'w' | 'h' | 'body'> & {top?: boolean; bottom?: boolean};

export async function sliceG(t: Theme, g: Geo, h: number, body: string, o: SliceOpts): Promise<string> {
	if (h % 40) throw new Error(`slice height ${h} is not a multiple of 40`);
	const {FL, FR, M} = g;
	const y0 = o.top ? M : 0;
	const y1 = o.bottom ? h - M : h;
	let rails = `M${FL} ${y0}V${y1}M${FR} ${y0}V${y1}`;
	if (o.top) rails += `M${FL} ${y0}H${FR}`;
	if (o.bottom) rails += `M${FL} ${y1}H${FR}`;
	const gy0 = o.top ? y0 : -40;
	const gy1 = o.bottom ? y1 : h + 40;
	const glow = `M${FL} ${gy0}V${gy1}M${FR} ${gy0}V${gy1}` + (o.top ? `M${FL} ${y0}H${FR}` : '') + (o.bottom ? `M${FL} ${y1}H${FR}` : '');
	let corners = '';
	if (o.top) corners += `<path d="M${FL - 7} ${y0 + 18}V${y0 - 7}H${FL + 18}"/><path d="M${FR - 18} ${y0 - 7}H${FR + 7}V${y0 + 18}"/>`;
	if (o.bottom) corners += `<path d="M${FL - 7} ${y1 - 18}V${y1 + 7}H${FL + 18}"/><path d="M${FR - 18} ${y1 + 7}H${FR + 7}V${y1 - 18}"/>`;
	const defs = baseDefs(t) + (o.defs ? `\n${o.defs}` : '');
	return document(t, {...o, w: g.W, h, body, defs}, {
		under: `<path d="${glow}" fill="none" stroke="${t.accent}" stroke-width="3" opacity=".55" filter="url(#glow)"/>
<rect x="${FL}" y="${y0}" width="${FR - FL}" height="${y1 - y0}" fill="${t.bg}"/>
<rect x="${FL}" y="${y0}" width="${FR - FL}" height="${y1 - y0}" fill="url(#grid)"/>`,
		over: `<path d="${rails}" fill="none" stroke="${t.accent}" stroke-width="1.2"/>
<g fill="none" stroke="${t.accent}" stroke-width="2">${corners}</g>`,
	});
}

// Left or right half of a full-width row; only its outer side has a rail.
export async function halfSliceG(t: Theme, g: Geo, h: number, side: 'L' | 'R', body: string, o: Omit<SliceOpts, 'top' | 'bottom'>): Promise<string> {
	if (h % 40) throw new Error(`slice height ${h} is not a multiple of 40`);
	const rx = side === 'L' ? g.FL : g.HW - g.M;
	const [bx0, bx1] = side === 'L' ? [g.FL, g.HW] : [0, g.HW - g.M];
	return document(t, {...o, w: g.HW, h, body}, {
		under: `<path d="M${rx} -40V${h + 40}" fill="none" stroke="${t.accent}" stroke-width="3" opacity=".55" filter="url(#glow)"/>
<rect x="${bx0}" y="0" width="${bx1 - bx0}" height="${h}" fill="${t.bg}"/>
<rect x="${bx0}" y="0" width="${bx1 - bx0}" height="${h}" fill="url(#grid)"/>`,
		over: `<path d="M${rx} 0V${h}" fill="none" stroke="${t.accent}" stroke-width="1.2"/>`,
	});
}

// One of `n` equal segments of a full-width row (link buttons and the like).
export async function segmentG(t: Theme, g: Geo, k: number, n: number, h: number, body: string, o: Omit<SliceOpts, 'top' | 'bottom' | 'defs'>): Promise<string> {
	const {FL, FR} = g;
	const seg = g.W / n;
	const x0 = seg * k;
	const first = k === 0;
	const last = k === n - 1;
	const bg0 = first ? FL - x0 : 0;
	const bg1 = last ? FR - x0 : seg;
	const rails = (first ? `M${FL - x0} 0V${h}` : '') + (last ? `M${FR - x0} 0V${h}` : '');
	const glow = (first ? `M${FL - x0} -40V${h + 40}` : '') + (last ? `M${FR - x0} -40V${h + 40}` : '');
	return document(t, {...o, w: seg, h, body, defs: baseDefs(t, ((-x0 % 40) + 40) % 40)}, {
		under: `${glow ? `<path d="${glow}" fill="none" stroke="${t.accent}" stroke-width="3" opacity=".55" filter="url(#glow)"/>` : ''}
<rect x="${bg0}" y="0" width="${bg1 - bg0}" height="${h}" fill="${t.bg}"/>
<rect x="${bg0}" y="0" width="${bg1 - bg0}" height="${h}" fill="url(#grid)"/>`,
		over: rails ? `<path d="${rails}" fill="none" stroke="${t.accent}" stroke-width="1.2"/>` : '',
	});
}

export function headingG(t: Theme, g: Geo, y: number, name: string, counter: string): string {
	const {X, R} = g;
	return `<text x="${X}" y="${y}" font-weight="700" fill="${t.accent}" filter="url(#g)" opacity=".8" style="font-size:20px">~/</text>
<text x="${X}" y="${y}" font-weight="700" style="font-size:20px"><tspan class="cy">~/</tspan><tspan class="wh">${esc(name)}</tspan></text>
<text x="${R}" y="${y}" text-anchor="end" letter-spacing="2" fill="${t.faint}" style="font-size:12px">${esc(counter)}</text>
<line x1="${X}" y1="${y + 14}" x2="${R}" y2="${y + 14}" stroke="${t.accent}" stroke-opacity=".4"/>
<line x1="${X}" y1="${y + 14}" x2="${X + 120}" y2="${y + 14}" stroke="${t.accent}" stroke-width="2"/>
<line x1="${X}" y1="${y + 14}" x2="${X + 120}" y2="${y + 14}" stroke="${t.accent}" stroke-width="3" filter="url(#gl)"/>`;
}

// A `$ cmd # comment` line. `size` overrides the 15px default (phones).
export function promptG(g: Geo, cmd: string, delay = 0.15, comment = '', y = 96, size?: number): string {
	const c = comment ? ` <tspan class="fainter">${esc(comment)}</tspan>` : '';
	const st = size ? ` style="font-size:${size}px"` : '';
	return `<g class="ln" style="animation-delay:${delay.toFixed(2)}s"><text x="${g.X}" y="${y}" class="dim"${st}><tspan class="gr">$</tspan> ${esc(cmd)}${c}</text></g>`;
}

// Desktop shorthands (the original 880px API).
export const slice = (t: Theme, h: number, body: string, o: SliceOpts) => sliceG(t, DESKTOP, h, body, o);
export const halfSlice = (t: Theme, h: number, side: 'L' | 'R', body: string, o: Omit<SliceOpts, 'top' | 'bottom'>) => halfSliceG(t, DESKTOP, h, side, body, o);
export const segment = (t: Theme, k: number, n: number, h: number, body: string, o: Omit<SliceOpts, 'top' | 'bottom' | 'defs'>) => segmentG(t, DESKTOP, k, n, h, body, o);
export const heading = (t: Theme, y: number, name: string, counter: string) => headingG(t, DESKTOP, y, name, counter);
export const prompt = (cmd: string, delay = 0.15, comment = '') => promptG(DESKTOP, cmd, delay, comment);

// Stand-in for a phone layout that hasn't been designed yet.
export async function placeholder(t: Theme, w: number, h: number, label: string): Promise<string> {
	const body = `<rect x="0" y="0" width="${w}" height="${h}" fill="${t.bg}"/><text x="${w / 2}" y="${h / 2 + 4}" text-anchor="middle" class="dim" style="font-size:11px">${esc(label)} (phone layout pending)</text>`;
	return document(t, {w, h, body, title: label, desc: label, text: label + ' (phone layout pending)'}, {under: '', over: ''});
}

// rows: markup with {y}, or null for a small spacer.
export function stagger(rows: (string | null)[], y0: number, lh: number, delay0 = 0.15, step = 0.12): [string, number] {
	const out: string[] = [];
	let y = y0;
	let i = 0;
	for (const r of rows) {
		if (r === null) {
			y += 14;
			continue;
		}
		i++;
		out.push(`<g class="ln" style="animation-delay:${(delay0 + i * step).toFixed(2)}s">${r.replaceAll('{y}', String(y))}</g>`);
		y += lh;
	}
	return [out.join('\n'), y];
}

// Text wrap at a fixed column count (JetBrains Mono is monospace).
export function wrap(s: string, width: number): string[] {
	const lines: string[] = [];
	let line = '';
	for (const word of s.split(/\s+/)) {
		if (line && line.length + 1 + word.length > width) {
			lines.push(line);
			line = word;
		} else {
			line = line ? `${line} ${word}` : word;
		}
	}
	if (line) lines.push(line);
	return lines;
}
