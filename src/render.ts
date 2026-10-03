// Renders the profile's SVG slices and README.md from data/. Output depends
// only on data/, the fonts, and this code, so unchanged data produces
// byte-identical files.
//
// The console design, contribution city, and slice technique are ported from
// Giorgi Kobaidze's render.py (github.com/georgekobaidze/georgekobaidze, MIT;
// see NOTICE).
//
//   node src/render.ts [--theme neon|amber] [--root <dir>]
import {createHash} from 'node:crypto';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {siBluesky, siGithubsponsors, siMastodon, siX} from 'simple-icons';
import {
	FL, FR, HW, M, THEMES, type Theme, W, X,
	esc, f1, halfSlice, heading, num, prompt, segment, slice, stagger, up40, wrap,
} from './console.ts';
import {beyondMise, installs, trendingHead, trendingLegend, trendingRow, trends} from './charts.ts';
import {type Calendar, type Installs, type Post, type Project, type Snapshot, type Stars, slugify} from './data.ts';

const DEFAULT_THEME = 'neon';
const CARDS = 8;
const CREDIT_URL = 'https://github.com/georgekobaidze/georgekobaidze';
const CREDIT_POST = 'https://dev.to/georgekobaidze/i-turned-my-github-profile-into-a-cyberpunk-console-with-a-city-built-from-my-contributions-h4c';

function short(n: number): string {
	const [div, unit] = n >= 1e6 ? [1e6, 'M'] : n >= 1e3 ? [1e3, 'k'] : [1, ''];
	return `${Number((n / div).toPrecision(3))}${unit}`;
}

function monthDay(iso: string, long = false): string {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {month: long ? 'long' : 'short', day: 'numeric', timeZone: 'UTC'});
}

// ─────────────────────────────── header ───────────────────────────────
async function header(t: Theme, s: Snapshot): Promise<string> {
	const barLeft = 'SYS://ENTIRE.IO // NODE:JDX';
	const barRight = 'ONLINE · ALL SYSTEMS NOMINAL';
	const name = 'JEFF DICKEY';
	const tools = s.projects.slice(0, 7).map(p => p.name).join(' · ');
	const lines = ['open source maintainer · developer tools in Rust', tools, 'full-time on open source at '];
	const h = 360;
	const css = `@keyframes type{from{width:0}}
@keyframes flicker{0%{opacity:0}10%{opacity:1}14%{opacity:.2}22%{opacity:1}30%{opacity:.4}40%,100%{opacity:1}}
@keyframes gm{0%,92%,100%{transform:translate(0,0)}93%{transform:translate(5px,-1px)}95%{transform:translate(-3px,1px)}97%{transform:translate(2px,0)}}
@keyframes gc{0%,92%,100%{transform:translate(0,0)}93%{transform:translate(-5px,1px)}95%{transform:translate(4px,-1px)}97%{transform:translate(-2px,0)}}
.typing{animation:type .7s steps(8) .3s both}
.name{animation:flicker .9s linear 1.1s both}
.gm{animation:gm 6s linear 2s infinite}.gc{animation:gc 6s linear 2s infinite}`;
	const defs = `<pattern id="scan" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" fill-opacity=".2"/></pattern>
<filter id="tglow" x="-5%" y="-40%" width="110%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>
<filter id="sglow" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="3"/></filter>
<clipPath id="typeclip"><rect class="typing" x="${X}" y="80" width="140" height="30"/></clipPath>`;
	const dotx = FR - 20 - barRight.length * 8.2 - 16;
	const rows = [
		`<text class="fg" x="${X}" y="{y}"><tspan class="cy">&gt;&gt;</tspan> ${esc(lines[0])}</text>`,
		`<text class="fg" x="${X}" y="{y}"><tspan class="cy">&gt;&gt;</tspan> ${esc(lines[1])}</text>`,
		`<text class="fg" x="${X}" y="{y}"><tspan class="cy">&gt;&gt;</tspan> ${esc(lines[2])}<tspan class="cy" font-weight="700">ENTIRE.IO</tspan></text>`,
	];
	const [descLines] = stagger(rows, 218, 24, 1.75, 0.25);
	const big = (x: number, fill: string, extra = '') => `<text x="${x}" y="172" fill="${fill}"${extra} style="font-size:56px">${name}</text>`;
	const body = `<rect x="${FL}" y="${M}" width="${FR - FL}" height="34" fill="${t.accent}" fill-opacity=".08"/>
<line x1="${FL}" y1="${M + 34}" x2="${FR}" y2="${M + 34}" stroke="${t.accent}" stroke-opacity=".5"/>
<text x="${FL + 16}" y="${M + 22}" letter-spacing="1" class="cy" style="font-size:12px">${esc(barLeft)}</text>
<text x="${FR - 20}" y="${M + 22}" letter-spacing="1" class="dim" text-anchor="end" style="font-size:12px">${esc(barRight)}</text>
<circle class="dot" cx="${f1(dotx)}" cy="${M + 18}" r="4" fill="${t.ok}"/>
<circle class="dot" cx="${f1(dotx)}" cy="${M + 18}" r="4" fill="${t.ok}" filter="url(#sglow)"/>
<g clip-path="url(#typeclip)"><text x="${X}" y="102" class="dim"><tspan class="gr">$</tspan> whoami</text></g>
<g class="name" font-weight="800" letter-spacing="2" style="font-size:56px">
${big(X, t.accent, ' opacity=".55" filter="url(#tglow)"')}
<g class="gm">${big(X + 3, t.accent2, ' opacity=".75"')}</g>
<g class="gc">${big(X - 3, t.accent, ' opacity=".85"')}</g>
${big(X, t.bright)}
</g>
${descLines}
<g class="ln" style="animation-delay:2.8s">
<text x="${X}" y="304" class="gr">$</text>
<rect class="cursor" x="${X + 18}" y="291" width="10" height="17" fill="${t.accent}"/>
<rect class="cursor" x="${X + 18}" y="291" width="10" height="17" fill="${t.accent}" filter="url(#sglow)"/>
</g>
<rect x="${FL}" y="${M + 35}" width="${FR - FL}" height="${h - M - 35}" fill="url(#scan)"/>`;
	return slice(t, h, body, {
		title: 'Jeff Dickey', desc: headerAlt(s),
		text: barLeft + barRight + name + '$ whoami>>' + lines.join('') + 'ENTIRE.IO',
		top: true, css, defs, weights: [400, 700, 800],
	});
}

function headerAlt(s: Snapshot): string {
	return `Jeff Dickey (@jdx). Open source maintainer building developer tools in Rust, full-time at entire.io: ${s.projects.slice(0, 7).map(p => p.name).join(', ')}.`;
}

// ─────────────────────────────── footer ───────────────────────────────
async function footer(t: Theme): Promise<string> {
	const credit = '// console after @georgekobaidze';
	const body = `<text x="${X}" y="30" class="dim"><tspan class="gr">$</tspan> exit</text>
<text x="${X}" y="52" class="dim">connection to <tspan class="cy">jdx</tspan> closed. <tspan class="fainter">// EOF</tspan></text>
<text x="${FR - 36}" y="52" text-anchor="end" class="fainter" style="font-size:11px">${esc(credit)}</text>`;
	return slice(t, 80, body, {title: 'End of profile', desc: 'Connection closed.', text: `$ exit connection to jdx closed. // EOF${credit}`, bottom: true});
}

// ──────────────────────────────── links ───────────────────────────────
type Button = {label: string; handle: string; url: string; icon: (t: Theme, x: number, y: number) => string};

function pathIcon(d: string) {
	return (t: Theme, x: number, y: number) => `<path transform="translate(${x} ${y}) scale(${18 / 24})" d="${d}" fill="${t.accent}"/>`;
}

const LINKS: Button[] = [
	{
		label: 'jdx.dev', handle: 'blog, newsletter', url: 'https://jdx.dev',
		icon: (t, x, y) => `<rect x="${x}" y="${y}" width="18" height="18" rx="3" fill="${t.accent}"/><text x="${x + 9}" y="${y + 13}" text-anchor="middle" font-weight="700" fill="${t.bg}" style="font-size:10px">&gt;_</text>`,
	},
	{label: 'Sponsor', handle: 'jdx.dev/sponsors', url: 'https://jdx.dev/sponsors', icon: pathIcon(siGithubsponsors.path)},
	{label: 'X', handle: '@jdxcode', url: 'https://x.com/jdxcode', icon: pathIcon(siX.path)},
	{label: 'Bluesky', handle: '@jdx.dev', url: 'https://bsky.app/profile/jdx.dev', icon: pathIcon(siBluesky.path)},
	{label: 'Mastodon', handle: '@jdx · fosstodon', url: 'https://fosstodon.org/@jdx', icon: pathIcon(siMastodon.path)},
];

async function sectionHead(t: Theme, name: string, counter: string, cmd: string, comment = ''): Promise<string> {
	return slice(t, 120, heading(t, 44, name, counter) + '\n' + prompt(cmd, 0.15, comment), {
		title: name, desc: name, text: `~/${name}${counter}$ ${cmd} ${comment}`,
	});
}

// A row of n equal buttons spanning the text column (x = 52 … 828). Each
// button must sit inside its own image, so the last one starts exactly at its
// segment's left edge; for n = 5 this gives Giorgi's 124px buttons, 39px apart.
async function button(t: Theme, b: Button, k: number, n: number, delay0 = 0.25): Promise<string> {
	const seg = W / n;
	const bw = FR - 36 - (n - 1) * seg;
	const gap = ((n - 1) * seg - X) / (n - 1) - bw;
	const lx = X + k * (bw + gap) - seg * k;
	const h = 80;
	const by = 12;
	const bh = 56;
	const cut = 12;
	const box = `M${f1(lx)} ${by}H${f1(lx + bw - cut)}L${f1(lx + bw)} ${by + cut}V${by + bh}H${f1(lx)}Z`;
	const maxHandle = Math.floor((bw - 24) / 6);
	const handle = b.handle.length > maxHandle ? `${b.handle.slice(0, maxHandle - 1)}…` : b.handle;
	const body = `<g class="ln" style="animation-delay:${(delay0 + k * 0.08).toFixed(2)}s">
<path d="${box}" fill="${t.accent}" fill-opacity=".05"/>
<path d="${box}" fill="none" stroke="${t.accent}" stroke-opacity=".55"/>
<path d="M${f1(lx + bw - cut)} ${by}L${f1(lx + bw)} ${by + cut}" stroke="${t.accent}" stroke-width="2"/>
<g filter="url(#g)" opacity=".5">${b.icon(t, Math.round(lx + 12), by + 11)}</g>
${b.icon(t, Math.round(lx + 12), by + 11)}
<text x="${f1(lx + 38)}" y="${by + 25}" font-weight="700" class="cy" style="font-size:13px">${esc(b.label)}</text>
<text x="${f1(lx + 12)}" y="${by + 46}" class="dim" style="font-size:10px">${esc(handle)}</text>
</g>`;
	return segment(t, k, n, h, body, {title: b.label, desc: `${b.label}: ${b.url}`, text: b.label + handle + '>_'});
}

// ─────────────────────────────── stats ────────────────────────────────
function tile(t: Theme, x: number, y: number, w: number, h: number, label: string, value: string, sub: string, delay: number): string {
	return `<g class="ln" style="animation-delay:${delay.toFixed(2)}s">
<rect x="${f1(x)}" y="${y}" width="${f1(w)}" height="${h}" fill="${t.accent}" fill-opacity=".035" stroke="${t.accent}" stroke-opacity=".35"/>
<path d="M${f1(x)} ${y + 12}V${y}H${f1(x + 12)}" fill="none" stroke="${t.accent}" stroke-width="2"/>
<text x="${f1(x + 16)}" y="${y + 22}" letter-spacing="1.5" class="dim" style="font-size:10.5px">${esc(label)}</text>
<text x="${f1(x + 16)}" y="${y + 50}" font-weight="700" fill="${t.accent}" filter="url(#g)" opacity=".55" style="font-size:30px">${esc(value)}</text>
<text x="${f1(x + 16)}" y="${y + 50}" font-weight="700" fill="${t.accent}" style="font-size:30px">${esc(value)}</text>
<text x="${f1(x + 16)}" y="${y + h - 12}" fill="${t.faint}" style="font-size:12px">${esc(sub)}</text>
</g>`;
}

function milestone(history: Record<string, number>): string {
	const dates = Object.keys(history).sort();
	if (!dates.length) return '';
	const latest = history[dates.at(-1)!];
	const passed = Math.floor(latest / 1e6) * 1e6;
	if (passed > 0) {
		const crossed = dates.find(d => history[d] >= passed)!;
		if ((Date.parse(dates.at(-1)!) - Date.parse(crossed)) / 864e5 <= 7) return `passed ${short(passed)} on ${monthDay(crossed)}`;
	}
	return `${short(passed + 1e6 - latest)} to ${short(passed + 1e6)}`;
}

async function stats(t: Theme, s: Snapshot, history: Record<string, number>, updated: string, counter: string): Promise<string> {
	const g = s.github;
	const parts: string[] = [heading(t, 44, 'stats', counter), prompt('gh api graphql -F login=jdx -f query=@profile.graphql')];
	const [tw, gap, ty, th] = [182, 16, 118, 92];
	const since = g ? new Date(g.created_at) : null;
	const years = since ? Math.floor((Date.parse(`${updated}T00:00:00Z`) - since.getTime()) / (365 * 864e5)) : 0;
	const t1: [string, string, string][] = [
		['TOTAL STARS', num(s.stars), 'jdx + aubepkg repos'],
		[`CONTRIBUTIONS ${g?.year ?? ''}`, num(g?.contributions_year), `${num(g?.contributions_all)} all time`],
		['PULL REQUESTS', num(g?.prs), `${num(g?.prs_merged)} merged`],
		['CURRENT STREAK', g ? `${g.streak_current}d` : '—', `longest: ${g?.streak_longest ?? '—'} days`],
	];
	t1.forEach(([lab, val, sub], i) => parts.push(tile(t, X + i * (tw + gap), ty, tw, th, lab, val, sub, 0.25 + i * 0.08)));

	const ry = ty + th + 16;
	const kv: [string, string][] = [
		['followers', num(g?.followers)],
		['public repos', num(g?.public_repos)],
		['member since', since ? `${since.toLocaleDateString('en-US', {month: 'short', year: 'numeric', timeZone: 'UTC'})} (${years}y)` : '—'],
		['open issues', num(s.issues?.count)],
		['open PRs', num(s.prs?.count)],
	];
	const rh = 38 + kv.length * 28;
	const lw = 320;
	const rows = kv.map(([k, v], i) =>
		`<text x="${X + 16}" y="${ry + 38 + i * 28}" xml:space="preserve"><tspan class="cy">${esc(k)}</tspan><tspan class="dim">${'.'.repeat(16 - k.length)}</tspan> <tspan class="fg">${esc(v)}</tspan></text>`).join('\n');
	parts.push(`<g class="ln" style="animation-delay:.6s">
<rect x="${X}" y="${ry}" width="${lw}" height="${rh}" fill="${t.accent}" fill-opacity=".035" stroke="${t.accent}" stroke-opacity=".35"/>
<path d="M${X} ${ry + 12}V${ry}H${X + 12}" fill="none" stroke="${t.accent}" stroke-width="2"/>
${rows}
</g>`);

	const lx = X + lw + gap;
	const lwid = FR - 36 - lx;
	const langs = Object.entries(g?.languages ?? {});
	const total = langs.reduce((a, [, v]) => a + v, 0) || 1;
	const top = langs.slice(0, 5);
	const other = total - top.reduce((a, [, v]) => a + v, 0);
	const items: [string, number][] = [...top.map(([k, v]) => [k, v / total] as [string, number]), ...(other > 0 ? [['Other', other / total] as [string, number]] : [])];
	const [bx, by, bw] = [lx + 16, ry + 42, lwid - 32];
	const segs: string[] = [];
	let cx = bx;
	items.forEach(([, p], i) => {
		const w = bw * p;
		const c = t.langs[i];
		segs.push(`<rect x="${f1(cx)}" y="${by}" width="${f1(Math.max(w - 2, 1))}" height="8" fill="${c}"/>`);
		segs.push(`<rect x="${f1(cx)}" y="${by}" width="${f1(Math.max(w - 2, 1))}" height="8" fill="${c}" filter="url(#g)" opacity=".6"/>`);
		cx += w;
	});
	const legend = items.map(([k, p], i) => {
		const lxx = bx + (i % 2) * (bw / 2);
		const lyy = by + 36 + Math.floor(i / 2) * 26;
		return `<rect x="${f1(lxx)}" y="${lyy - 9}" width="9" height="9" fill="${t.langs[i]}"/><text x="${f1(lxx + 18)}" y="${lyy}" class="fg" style="font-size:13px">${esc(k)}</text><text x="${f1(lxx + bw / 2 - 24)}" y="${lyy}" text-anchor="end" class="dim" style="font-size:13px">${(p * 100).toFixed(1)}%</text>`;
	}).join('');
	parts.push(`<g class="ln" style="animation-delay:.7s">
<rect x="${lx}" y="${ry}" width="${lwid}" height="${rh}" fill="${t.accent}" fill-opacity=".035" stroke="${t.accent}" stroke-opacity=".35"/>
<path d="M${lx} ${ry + 12}V${ry}H${lx + 12}" fill="none" stroke="${t.accent}" stroke-width="2"/>
<text x="${lx + 16}" y="${ry + 24}" letter-spacing="1.5" class="dim" style="font-size:10.5px">TOP LANGUAGES</text>
<rect x="${bx}" y="${by}" width="${bw}" height="8" fill="${t.well}"/>
${segs.join('')}
${legend}
</g>`);

	let fy = ry + rh + 30;
	if (s.mau) {
		const dy = ry + rh + 34;
		parts.push(`<g class="ln" style="animation-delay:.8s"><text x="${X}" y="${dy}" class="dim"><tspan class="gr">$</tspan> curl -s mise-versions.jdx.dev/api/stats/dau-mau</text></g>`);
		const t3: [string, string, string][] = [
			['MISE MONTHLY USERS', num(s.mau.value), milestone(history)],
			['MISE DAILY USERS', num(s.mau.dau), `on ${monthDay(s.mau.date)}`],
		];
		const dw = (FR - 36 - X - (t3.length - 1) * 12) / t3.length;
		t3.forEach(([lab, val, sub], i) => parts.push(tile(t, X + i * (dw + 12), dy + 16, dw, 92, lab, val, sub, 0.9 + i * 0.06)));
		fy = dy + 16 + 92 + 30;
	}
	parts.push(`<text x="${FR - 36}" y="${fy}" text-anchor="end" class="fainter" style="font-size:11px">// last sync ${updated}</text>`);
	const desc = `GitHub stats: ${num(s.stars)} total stars; ${num(g?.contributions_year)} contributions in ${g?.year}, ${num(g?.contributions_all)} all time; ` +
		`${num(g?.prs)} pull requests (${num(g?.prs_merged)} merged); current streak ${g?.streak_current} days, longest ${g?.streak_longest}; ` +
		`${num(g?.followers)} followers; ${num(s.issues?.count)} open issues and ${num(s.prs?.count)} open pull requests. ` +
		`Top languages: ${items.map(([k, p]) => `${k} ${(p * 100).toFixed(1)}%`).join(', ')}.` +
		(s.mau ? ` mise: ${num(s.mau.value)} monthly users, ${num(s.mau.dau)} daily users.` : '');
	return slice(t, up40(fy + 16), parts.join("\n"), {title: "Stats", desc, text: "—%.()d"});
}

// ─────────────────────────── contribution city ────────────────────────
// Isometric skyline, one building per day: height = 8 + 110·sqrt(count/peak),
// drawn back to front, with windows from a seeded RNG so the same data always
// draws the same city.
const CITY_TW = 25;
const CITY_TH = 12.5;
const CITY_OX = 152.5;
const CITY_OY = 262;
const CITY_HMAX = 118;

const p2 = (x: number, y: number) => `${f1(x)},${f1(y)}`;

function* rng(seed: string): Generator<number> {
	let state = BigInt(`0x${createHash('sha256').update(seed).digest('hex').slice(0, 16)}`);
	const mask = (1n << 64n) - 1n;
	while (true) {
		state = (state * 6364136223846793005n + 1442695040888963407n) & mask;
		yield Number(state >> 11n) / 2 ** 53;
	}
}

function levels(counts: number[]): number[] {
	const nz = counts.filter(c => c > 0).sort((a, b) => a - b);
	if (!nz.length) return [1, 1, 1];
	const q = (f: number) => nz[Math.min(nz.length - 1, Math.floor(nz.length * f))];
	return [q(0.25), q(0.5), q(0.75)];
}

async function city(t: Theme, calendar: Calendar, updated: string, counter: string): Promise<string> {
	const C = t.city;
	const counts = calendar.map(([, n]) => n);
	const total = counts.reduce((a, b) => a + b, 0);
	const peak = Math.max(0, ...counts);
	const lv = levels(counts);
	const r = rng(`${updated}-${total}`);
	const next = () => r.next().value as number;
	const start = Date.parse(`${calendar[0][0]}T00:00:00Z`);

	const cells = calendar.map(([d, n]) => {
		const date = new Date(`${d}T00:00:00Z`);
		const idx = Math.round((date.getTime() - start) / 864e5);
		return {w: Math.floor(idx / 7), dow: date.getUTCDay(), n};
	}).sort((a, b) => (a.w + a.dow) - (b.w + b.dow) || a.w - b.w);

	const shapes: string[] = [];
	let flick = 0;
	for (const {w, dow, n} of cells) {
		const cx = CITY_OX + (w - dow) * CITY_TW / 2;
		const cy = CITY_OY + (w + dow) * CITY_TH / 2;
		const L: [number, number] = [cx - CITY_TW / 2, cy];
		const R: [number, number] = [cx + CITY_TW / 2, cy];
		const T: [number, number] = [cx, cy - CITY_TH / 2];
		const B: [number, number] = [cx, cy + CITY_TH / 2];
		if (n === 0) {
			shapes.push(`<path d="M${p2(...T)}L${p2(...R)}L${p2(...B)}L${p2(...L)}Z" fill="${C.empty}" stroke="${C.emptyStroke}" stroke-width=".6"/>`);
			continue;
		}
		const h = 8 + (CITY_HMAX - 8) * Math.sqrt(n / peak);
		const level = lv.filter(th => n > th).length;
		const [Tu, Ru, Bu, Lu] = [T, R, B, L].map(([x, y]) => [x, y - h] as [number, number]);
		shapes.push(`<path d="M${p2(...L)}L${p2(...B)}L${p2(...Bu)}L${p2(...Lu)}Z" fill="${C.left}"/>` +
			`<path d="M${p2(...B)}L${p2(...R)}L${p2(...Ru)}L${p2(...Bu)}Z" fill="${C.right}"/>` +
			`<path d="M${p2(...Tu)}L${p2(...Ru)}L${p2(...Bu)}L${p2(...Lu)}Z" fill="${C.roofs[level]}"/>`);
		const on: string[] = [];
		const side: string[] = [];
		const off: string[] = [];
		const fl: [string, string][] = [];
		for (const [face, a, b] of [['l', L, B], ['r', B, R]] as const) {
			for (let row = 0; row < Math.floor((h - 6) / 7); row++) {
				const v0 = 5 + row * 7;
				for (const u0 of [0.18, 0.58]) {
					const lit = next() < 0.55;
					if (!lit && next() < 0.5) continue;
					const pts = ([[u0, v0], [u0 + 0.26, v0], [u0 + 0.26, v0 + 3.2], [u0, v0 + 3.2]] as const)
						.map(([u, v]) => p2(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - v));
					const seg = `M${pts.join('L')}Z`;
					if (!lit) off.push(seg);
					else if (next() < 0.03) fl.push([seg, face]);
					else (face === 'l' ? on : side).push(seg);
				}
			}
		}
		if (off.length) shapes.push(`<path d="${off.join('')}" fill="${C.winOff}"/>`);
		if (on.length) shapes.push(`<path d="${on.join('')}" fill="${C.winOn}"/>`);
		if (side.length) shapes.push(`<path d="${side.join('')}" fill="${C.winSide}"/>`);
		for (const [seg, face] of fl) {
			flick++;
			shapes.push(`<path class="f${flick % 3}" d="${seg}" fill="${face === 'l' ? C.winOn : C.winSide}"/>`);
		}
	}

	// Night sky in the empty top-right corner: stars, moon, a plane crossing.
	const stars: string[] = [];
	for (let i = 0; i < 46; i++) {
		const x = 470 + next() * 350;
		const y = 118 + next() * 150;
		if (x > 700 && y < 215) continue;
		const cls = i % 3 === 0 ? ` class="s${i % 3}"` : '';
		stars.push(`<circle${cls} cx="${f1(x)}" cy="${f1(y)}" r="${[0.6, 0.8, 1.1][i % 3]}" fill="${C.sky}" opacity="${(0.35 + next() * 0.5).toFixed(2)}"/>`);
	}
	const busiest = calendar.reduce((best, cur) => (cur[1] > best[1] ? cur : best), calendar[0]);
	const info = [
		`<tspan class="cy" font-weight="700">${num(total)}</tspan> contributions · last 365 days`,
		busiest[1] ? `busiest day <tspan class="fg">${monthDay(busiest[0])}</tspan> · ${busiest[1]}` : '',
		`${counts.filter(n => n).length} active days`,
	].filter(Boolean).map((s, i) => `<text x="${FR - 36}" y="${300 + i * 20}" text-anchor="end" class="dim" style="font-size:12px">${s}</text>`).join('');
	const legend = [C.empty, ...C.roofs].map((c, i) => `<rect x="${X + 52 + i * 16}" y="642" width="11" height="11" fill="${c}"/>`).join('');
	const body = `${heading(t, 44, 'contribution-city', counter)}
${prompt('render-city --last 365d', 0.15, '# one building per day')}
<g>${stars.join('')}</g>
<circle cx="${FR - 80}" cy="160" r="40" fill="url(#moonglow)"/>
<circle cx="${FR - 80}" cy="160" r="14" fill="${t.moon}"/>
<circle cx="${FR - 74}" cy="155" r="12.5" fill="${t.bg}"/>
<g class="plane"><g transform="translate(0 132)"><rect x="0" y="0" width="14" height="2" rx="1" fill="${t.fainter}"/><circle class="bl" cx="0" cy="1" r="1.6" fill="#ff7b72"/><circle class="bl" cx="14" cy="1" r="1.6" fill="#f0f6fc" style="animation-delay:.7s"/></g></g>
${info}
${shapes.join('')}
<text x="${X}" y="652" class="dim" style="font-size:11px">quiet</text>${legend}<text x="${X + 52 + 5 * 16 + 6}" y="652" class="dim" style="font-size:11px">skyscraper</text>`;
	const css = `@keyframes tw{0%,100%{opacity:.9}50%{opacity:.15}}
@keyframes fl{0%,40%,100%{opacity:1}45%,60%{opacity:.1}}
@keyframes blink{0%,90%,100%{opacity:0}93%{opacity:1}}
@keyframes fly{from{transform:translate(${FL - 40}px,0)}to{transform:translate(${FR + 40}px,-30px)}}
.s0{animation:tw 3s infinite}
.f0{animation:fl 5s infinite}.f1{animation:fl 7s infinite 2s}.f2{animation:fl 9s infinite 4s}
.plane{animation:fly 26s linear infinite}.bl{animation:blink 1.4s infinite}`;
	const defs = `<radialGradient id="moonglow"><stop offset="0" stop-color="${t.moon}" stop-opacity=".22"/><stop offset="1" stop-color="${t.moon}" stop-opacity="0"/></radialGradient>`;
	return slice(t, 680, body, {
		title: 'Contribution city', desc: cityAlt(calendar), css, defs,
		text: `~/contribution-city${counter}$ render-city --last 365d # one building per dayquietskyscraper`,
	});
}

function cityAlt(calendar: Calendar): string {
	const total = calendar.reduce((a, [, n]) => a + n, 0);
	const busiest = calendar.reduce((best, cur) => (cur[1] > best[1] ? cur : best), calendar[0]);
	return `Contribution city: an isometric night skyline with one building per day of the last year, taller and brighter for busier days. ${num(total)} contributions` +
		(busiest[1] ? `, busiest day ${monthDay(busiest[0], true)} with ${busiest[1]}.` : '.');
}

// ────────────────────────────── projects ──────────────────────────────
const CARD_H = 200;

async function logoHref(p: Project): Promise<string | null> {
	const slug = slugify(p.name);
	const svgLogo = await readFile(`data/logos/${slug}.svg`, 'utf8').catch(() => null);
	if (svgLogo) {
		// The console is always dark, so pin color-scheme-aware logos to their dark rules.
		const dark = svgLogo
			.replace(/@media\s*\(prefers-color-scheme:\s*dark\)/g, '@media all')
			.replace(/@media\s*\(prefers-color-scheme:\s*light\)/g, '@media not all');
		return `data:image/svg+xml;base64,${Buffer.from(dark).toString('base64')}`;
	}
	const png = await readFile(`data/logos/${slug}.png`).catch(() => null);
	return png ? `data:image/png;base64,${png.toString('base64')}` : null;
}

async function card(t: Theme, p: Project, side: 'L' | 'R', delay: number): Promise<string> {
	const x0 = side === 'L' ? 52 : 10; // 378-wide box, 20px gutter between the two cards
	const [cw, y0, ch, pad, cut] = [378, 12, 176, 18, 16];
	const tx = x0 + pad;
	const box = `M${x0} ${y0}H${x0 + cw - cut}L${x0 + cw} ${y0 + cut}V${y0 + ch}H${x0 + cut}L${x0} ${y0 + ch - cut}Z`;
	const lines = wrap(p.description, 43).slice(0, 3);
	const tag = p.kind.toUpperCase();
	const tagc = /CLI$/.test(tag) ? t.ok : t.accent2;
	const tagW = tag.length * 7.6 + 16;
	const logo = await logoHref(p);
	const nx = logo ? tx + 28 : tx;
	const titleW = p.name.length * 10.2;
	const sx = x0 + cw - pad;
	const desc = lines.map((l, i) => `<text x="${tx}" y="${100 + i * 20}" class="fg" style="font-size:13px">${esc(l)}</text>`).join('\n');
	const star = `<path transform="translate(${f1(sx - p.stars.length * 7.2 - 20)} 158) scale(.55)" d="M10 0l2.9 6.6 7.1.6-5.4 4.7 1.6 7L10 15.2 3.8 18.9l1.6-7L0 7.2l7.1-.6z" fill="${t.star}"/>`;
	const body = `<g class="ln" style="animation-delay:${delay.toFixed(2)}s">
<path d="${box}" fill="${t.accent}" fill-opacity=".035"/>
<path d="${box}" fill="none" stroke="${t.accent}" stroke-opacity=".4"/>
<path d="M${x0 + cw - cut} ${y0}L${x0 + cw} ${y0 + cut}" stroke="${t.accent}" stroke-width="2"/>
${logo ? `<image href="${logo}" x="${tx}" y="${y0 + 18}" width="20" height="20"/>` : ''}
<text x="${nx}" y="${y0 + 34}" font-weight="700" fill="${t.accent}" filter="url(#g)" opacity=".6" style="font-size:17px">${esc(p.name)}</text>
<text x="${nx}" y="${y0 + 34}" font-weight="700" class="cy" style="font-size:17px">${esc(p.name)}</text>
<path d="M${f1(nx + titleW + 11)} ${y0 + 31}l8-8M${f1(nx + titleW + 13)} ${y0 + 23}h6v6" fill="none" stroke="${t.accent}" stroke-width="1.6"/>
<rect x="${tx}" y="${y0 + 46}" width="${f1(tagW)}" height="18" fill="none" stroke="${tagc}" stroke-opacity=".8"/>
<text x="${tx + 8}" y="${y0 + 59}" letter-spacing="1" fill="${tagc}" style="font-size:11px">${esc(tag)}</text>
${desc}
<text x="${tx}" y="${y0 + 158}" class="dim" style="font-size:12px"><tspan class="gr">$</tspan> ${esc(p.install)}</text>
${star}
<text x="${sx}" y="${y0 + 158}" text-anchor="end" class="dim" style="font-size:12px">${esc(p.stars)}</text>
</g>`;
	return halfSlice(t, CARD_H, side, body, {
		title: p.name,
		desc: `${p.name}: ${p.description} Install: ${p.install}. ${p.stars} stars.`,
		text: p.name + tag + p.description + `$ ${p.install}` + p.stars,
	});
}

// ─────────────────────────────── writing ──────────────────────────────
async function articleRow(t: Theme, a: Post, i: number): Promise<string> {
	const maxc = 58;
	const shown = a.title.length <= maxc ? a.title : `${a.title.slice(0, maxc - 1).replace(/[ .,:;]+$/, '')}…`;
	const rx = FR - 36;
	const ax = rx - 10;
	const read = `${a.reading_time} min`;
	const body = `<g class="ln" style="animation-delay:${(0.2 + i * 0.08).toFixed(2)}s">
<rect x="${X - 10}" y="4" width="${rx - X + 20}" height="32" fill="${t.accent}" fill-opacity="${i % 2 === 0 ? '.04' : '0'}"/>
<text x="${X}" y="25" class="dim" style="font-size:13px">${a.date}</text>
<text x="${X + 94}" y="25" class="cy" style="font-size:13px">›</text>
<text x="${X + 112}" y="25" class="fg" style="font-size:14px">${esc(shown)}</text>
<text x="${ax - 18}" y="25" text-anchor="end" class="dim" style="font-size:13px">${esc(read)}</text>
<path d="M${ax - 6} 25l8-8M${ax - 4} 17h6v6" fill="none" stroke="${t.accent}" stroke-width="1.5"/>
</g>`;
	return slice(t, 40, body, {title: a.title, desc: `${a.title}. Published ${a.date}. ${read} read.`, text: a.date + '›' + shown + read});
}

async function writingMore(t: Theme): Promise<string> {
	const label = ' read all posts on jdx.dev';
	const ax = X + (2 + label.length) * 7.8 + 12;
	const body = `<g class="ln" style="animation-delay:.7s">
<text x="${X}" y="26" style="font-size:13px"><tspan class="gr">&gt;&gt;</tspan><tspan class="cy">${esc(label)}</tspan></text>
<path d="M${f1(ax)} 26l8-8M${f1(ax + 2)} 18h6v6" fill="none" stroke="${t.accent}" stroke-width="1.5"/>
</g>`;
	return slice(t, 40, body, {title: 'All posts', desc: 'Read all posts on jdx.dev', text: `>>${label}`});
}

// ─────────────────────────────── README ───────────────────────────────
// The page is built as rows of images; each add() call writes one SVG and
// appends its <img> to the current row. Images in a row sit side by side
// with no whitespace between them so their widths sum to exactly 100%.
class Page {
	files = new Map<string, string>();
	rows: string[][] = [];

	add(file: string, svg: string, width: string, alt: string, href?: string, sameRow = false): void {
		this.files.set(file, svg);
		const tag = `<img src="./assets/${file}" width="${width}" align="top" alt="${esc(alt)}">`;
		const html = href ? `<a href="${esc(href)}">${tag}</a>` : tag;
		if (sameRow && this.rows.length) this.rows.at(-1)!.push(html);
		else this.rows.push([html]);
	}

	readme(): string {
		return `<!-- Generated by \`mise run readme\` from src/. Edit that, not this. -->
<p align="center">
${this.rows.map(r => r.join('')).join('\n')}
</p>

<p align="center"><sub>Regenerated daily by <code>mise run readme</code> (<a href="https://github.com/jdx/jdx">source</a>). Console design and contribution city by <a href="${CREDIT_URL}">Giorgi Kobaidze</a> (<a href="${CREDIT_POST}">how he built it</a>), used under MIT.</sub></p>
`;
	}
}

async function main() {
	const {values} = parseArgs({options: {theme: {type: 'string', default: DEFAULT_THEME}, root: {type: 'string', default: '.'}}});
	const t = THEMES[values.theme!];
	if (!t) throw new Error(`unknown theme ${values.theme}`);
	const root = values.root!;

	const s: Snapshot = JSON.parse(await readFile('data/snapshot.json', 'utf8'));
	const history: Record<string, number> = JSON.parse(await readFile('data/mau.json', 'utf8').catch(() => '{}'));
	const calendar: Calendar | null = JSON.parse(await readFile('data/calendar.json', 'utf8').catch(() => 'null'));
	const starData: Stars | null = JSON.parse(await readFile('data/stars.json', 'utf8').catch(() => 'null'));
	const installData: Installs | null = JSON.parse(await readFile('data/installs.json', 'utf8').catch(() => 'null'));
	const updated = calendar?.at(-1)?.[0] ?? s.mau?.date ?? '';
	const carded = s.projects.slice(0, CARDS);
	const rest = s.projects.slice(CARDS);
	let n = 0;
	const counter = () => `// ${String(++n).padStart(2, '0')}`;

	const page = new Page();
	page.add('header.svg', await header(t, s), '100%', headerAlt(s));
	page.add('links.svg', await sectionHead(t, 'links', counter(), 'ping jdx --all-channels'), '100%', 'Links');
	for (const [k, b] of LINKS.entries()) page.add(`links/${k + 1}.svg`, await button(t, b, k, LINKS.length), '20%', b.label, b.url, k > 0);

	if (starData) {
		const {rows, days} = trends(t, starData, s.projects);
		if (rows.length >= 3) {
			page.add('trending.svg', await trendingHead(t, starData, days, counter()), '100%', `Trending: stars gained by jdx's tools in the ${days} days to ${starData.end}`);
			for (const [i, r] of rows.entries()) {
				page.add(`trending/${i + 1}.svg`, await trendingRow(t, r, i, rows[0].gain), '100%',
					`${r.p.name}: +${r.gain} stars in ${days} days${r.isNew ? ' (new)' : ''}, ${r.total} total`, r.p.href);
			}
			page.add('trending/legend.svg', await trendingLegend(t), '100%', 'Legend');
		}
	}
	page.add('stats.svg', await stats(t, s, history, updated, counter()), '100%', 'Stats');
	if (calendar) page.add('contribution-city.svg', await city(t, calendar, updated, counter()), '100%', cityAlt(calendar));
	if (starData) page.add('beyond-mise.svg', await beyondMise(t, starData, s.projects, counter()), '100%', 'Beyond mise: cumulative stars of every other tool');
	if (installData) {
		const svg = await installs(t, installData, starData, s.projects, `// ${String(n + 1).padStart(2, '0')}`);
		if (svg) {
			n++;
			page.add('installs.svg', svg, '100%', 'Installs of jdx tools through mise');
		}
	}

	page.add('projects.svg', await sectionHead(t, 'projects', counter(), 'ls -l ~/projects'), '100%', 'Projects');
	for (const [i, p] of carded.entries()) {
		page.add(`projects/${slugify(p.name)}.svg`, await card(t, p, i % 2 === 0 ? 'L' : 'R', 0.3 + i * 0.12), '50%',
			`${p.name}: ${p.description} Install: ${p.install}`, p.href, i % 2 === 1);
	}
	for (const [k, p] of rest.entries()) {
		const logo = await logoHref(p);
		const icon = (_t: Theme, x: number, y: number) => (logo ? `<image href="${logo}" x="${x}" y="${y}" width="18" height="18"/>` : '');
		page.add(`projects/also-${slugify(p.name)}.svg`, await button(t, {label: p.name, handle: p.tagline || p.kind, url: p.href, icon}, k, rest.length, 0.3),
			`${100 / rest.length}%`, `${p.name}: ${p.description}`, p.href, k > 0);
	}
	if (s.posts.length) {
		page.add('writing.svg', await sectionHead(t, 'writing', counter(), 'tail -n 5 ~/jdx.dev/posts.log', '# auto-updated'), '100%', 'Writing: latest posts on jdx.dev');
		for (const [i, p] of s.posts.entries()) page.add(`writing/post-${i + 1}.svg`, await articleRow(t, p, i), '100%', `${p.title}, published ${p.date}, ${p.reading_time} min read`, p.url);
		page.add('writing/all-posts.svg', await writingMore(t), '100%', 'Read all posts on jdx.dev', 'https://jdx.dev/posts/');
	}
	page.add('footer.svg', await footer(t), '100%', 'Connection closed.');

	await rm(`${root}/assets`, {recursive: true, force: true});
	for (const [name, content] of page.files) {
		const path = `${root}/assets/${name}`;
		await mkdir(path.slice(0, path.lastIndexOf('/')), {recursive: true});
		await writeFile(path, content);
	}
	await writeFile(`${root}/README.md`, page.readme());
	console.log(`rendered ${page.files.size} SVGs (${t.name}) and README.md into ${root}`);
}

await main();
