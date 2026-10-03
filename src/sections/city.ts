// ~/contribution-city, ported from Giorgi Kobaidze's render.py (MIT; see NOTICE).
import {createHash} from 'node:crypto';
import {DESKTOP, FL, FR, HW, M, PHONE, type Geo, type Theme, W, X, esc, f1, halfSlice, halfSliceG, heading, headingG, num, placeholder, prompt, promptG, segment, segmentG, slice, sliceG, stagger, up40, wrap} from '../console.ts';
import {CREDIT_POST, CREDIT_URL, DAY, NEW_DAYS, age, iso, monthDay, parse, shift, short, sum, toolColor} from '../shared.ts';
import {type Calendar, type Installs, type Post, type Project, type RepoStars, type Snapshot, type Stars, slugify} from '../data.ts';
import {type Phase, type SkyBox, WHEN, daylight, mix, phaseColor, sky, skyLayer} from '../sky.ts';

// ─────────────────────────── contribution city ────────────────────────
// Isometric skyline, one building per day: height = 8 + 110·sqrt(count/peak),
// drawn back to front, with windows from a seeded RNG so the same data always
// draws the same city.
export const CITY_TW = 25;
export const CITY_TH = 12.5;
export const CITY_OX = 152.5;
export const CITY_OY = 262;
export const CITY_HMAX = 118;

export const p2 = (x: number, y: number) => `${f1(x)},${f1(y)}`;

export function* rng(seed: string): Generator<number> {
	let state = BigInt(`0x${createHash('sha256').update(seed).digest('hex').slice(0, 16)}`);
	const mask = (1n << 64n) - 1n;
	while (true) {
		state = (state * 6364136223846793005n + 1442695040888963407n) & mask;
		yield Number(state >> 11n) / 2 ** 53;
	}
}

export function levels(counts: number[]): number[] {
	const nz = counts.filter(c => c > 0).sort((a, b) => a - b);
	if (!nz.length) return [1, 1, 1];
	const q = (f: number) => nz[Math.min(nz.length - 1, Math.floor(nz.length * f))];
	return [q(0.25), q(0.5), q(0.75)];
}

// Where a city draws: tile size, origin (the back corner of the first week),
// tallest building, s, which scales the shortest building, and ws, which
// scales the window grid. Desktop is the original 25px tile.
type Iso = {tw: number; th: number; ox: number; oy: number; hmax: number; s: number; ws: number};
const DESK_ISO: Iso = {tw: CITY_TW, th: CITY_TH, ox: CITY_OX, oy: CITY_OY, hmax: CITY_HMAX, s: 1, ws: 1};

// Which windows are lit: the seeded draw that lights a window at night
// (u < .55) must also fall under the phase's threshold, so the lit windows of
// any phase are a subset of the night's and the window grid never moves.
const LIT: Record<Phase, number> = {night: 0.55, dawn: 0.2, day: 0.05, dusk: 0.24};

// Building faces and unlit windows per phase; low suns glint in the windows
// that face them (the right faces).
function faces(t: Theme, p: Phase) {
	const C = t.city;
	switch (p) {
		case 'night': return {left: C.left, right: C.right, offL: C.winOff, offR: C.winOff};
		case 'dawn': return {left: mix(C.left, '#4b2a8a', 0.12), right: mix(C.right, '#ff7ab6', 0.1), offL: C.winOff, offR: mix(C.winOff, '#ff9ec7', 0.32)};
		case 'dusk': return {left: mix(C.left, '#6a1b9a', 0.14), right: mix(C.right, '#ff9e3d', 0.12), offL: C.winOff, offR: mix(C.winOff, '#ff9e3d', 0.45)};
		case 'day': return {left: mix(C.left, daylight(t), 0.1), right: mix(C.right, daylight(t), 0.08), offL: mix(C.winOff, t.accent, 0.14), offR: mix(C.winOff, t.accent, 0.22)};
	}
}

type Cells = {w: number; dow: number; n: number}[];

function cells(calendar: Calendar): Cells {
	const start = Date.parse(`${calendar[0][0]}T00:00:00Z`);
	return calendar.map(([d, n]) => {
		const date = new Date(`${d}T00:00:00Z`);
		const idx = Math.round((date.getTime() - start) / 864e5);
		return {w: Math.floor(idx / 7), dow: date.getUTCDay(), n};
	}).sort((a, b) => (a.w + a.dow) - (b.w + b.dow) || a.w - b.w);
}

// Buildings back to front: height = 8s + (hmax - 8s)·sqrt(count/peak).
function buildings(t: Theme, calendar: Calendar, next: () => number, g: Iso, p: Phase): string {
	const C = t.city;
	const F = faces(t, p);
	const counts = calendar.map(([, n]) => n);
	const peak = Math.max(0, ...counts);
	const lv = levels(counts);
	const {tw, th, s, ws} = g;
	const shapes: string[] = [];
	let flick = 0;
	for (const {w, dow, n} of cells(calendar)) {
		const cx = g.ox + (w - dow) * tw / 2;
		const cy = g.oy + (w + dow) * th / 2;
		const L: [number, number] = [cx - tw / 2, cy];
		const R: [number, number] = [cx + tw / 2, cy];
		const T: [number, number] = [cx, cy - th / 2];
		const B: [number, number] = [cx, cy + th / 2];
		if (n === 0) {
			shapes.push(`<path d="M${p2(...T)}L${p2(...R)}L${p2(...B)}L${p2(...L)}Z" fill="${C.empty}" stroke="${C.emptyStroke}" stroke-width="${String(0.6 * s).replace(/^0\./, '.')}"/>`);
			continue;
		}
		const h = 8 * s + (g.hmax - 8 * s) * Math.sqrt(n / peak);
		const level = lv.filter(lim => n > lim).length;
		const [Tu, Ru, Bu, Lu] = [T, R, B, L].map(([x, y]) => [x, y - h] as [number, number]);
		shapes.push(`<path d="M${p2(...L)}L${p2(...B)}L${p2(...Bu)}L${p2(...Lu)}Z" fill="${F.left}"/>` +
			`<path d="M${p2(...B)}L${p2(...R)}L${p2(...Ru)}L${p2(...Bu)}Z" fill="${F.right}"/>` +
			`<path d="M${p2(...Tu)}L${p2(...Ru)}L${p2(...Bu)}L${p2(...Lu)}Z" fill="${C.roofs[level]}"/>`);
		const on: string[] = [];
		const side: string[] = [];
		const offL: string[] = [];
		const offR: string[] = [];
		const fl: [string, string][] = [];
		for (const [face, a, b] of [['l', L, B], ['r', B, R]] as const) {
			for (let row = 0; row < Math.floor((h - 6 * ws) / (7 * ws)); row++) {
				const v0 = (5 + row * 7) * ws;
				for (const u0 of [0.18, 0.58]) {
					const u = next();
					const litAtNight = u < LIT.night;
					if (!litAtNight && next() < 0.5) continue;
					const flickers = litAtNight && next() < 0.03;
					const pts = ([[u0, v0], [u0 + 0.26, v0], [u0 + 0.26, v0 + 3.2 * ws], [u0, v0 + 3.2 * ws]] as const)
						.map(([u, v]) => p2(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - v));
					const seg = `M${pts.join('L')}Z`;
					if (u >= LIT[p]) (face === 'l' ? offL : offR).push(seg);
					else if (flickers) fl.push([seg, face]);
					else (face === 'l' ? on : side).push(seg);
				}
			}
		}
		if (F.offL === F.offR) {
			if (offL.length + offR.length) shapes.push(`<path d="${[...offL, ...offR].join('')}" fill="${F.offL}"/>`);
		} else {
			if (offL.length) shapes.push(`<path d="${offL.join('')}" fill="${F.offL}"/>`);
			if (offR.length) shapes.push(`<path d="${offR.join('')}" fill="${F.offR}"/>`);
		}
		if (on.length) shapes.push(`<path d="${on.join('')}" fill="${C.winOn}"/>`);
		if (side.length) shapes.push(`<path d="${side.join('')}" fill="${C.winSide}"/>`);
		for (const [seg, face] of fl) {
			flick++;
			shapes.push(`<path class="f${flick % 3}" d="${seg}" fill="${face === 'l' ? C.winOn : C.winSide}"/>`);
		}
	}
	return shapes.join('');
}

// The sky fades out across the city's back edges, the lines from the back
// corner of its first tile (down-right along the weeks, down-left along the
// first week's days), so none of it lights the ground.
function skyFade(g: Iso): {x: number; left: number[]; right: number[]} {
	const [x, y] = [g.ox, g.oy - g.th / 2];
	const n = Math.hypot(g.tw, g.th);
	const [a, b] = [6 * g.tw / 25, 30 * g.tw / 25]; // sky side, ground side
	const along = (nx: number, ny: number) => [x - nx * a, y - ny * a, x + nx * b, y + ny * b];
	return {x, left: along(g.th / n, g.tw / n), right: along(-g.th / n, g.tw / n)};
}

type StarField = {x0: number; w: number; y0: number; h: number; n: number; skip: (x: number, y: number) => boolean};

// Stars last, so they never move the windows. Dawn and dusk keep the high,
// darker part of the sky at lower brightness; day has none.
function stars(t: Theme, next: () => number, f: StarField, p: Phase): string {
	const keep = {night: 1, dawn: 0.4, day: 0, dusk: 0.5}[p];
	const out: string[] = [];
	for (let i = 0; i < f.n; i++) {
		const x = f.x0 + next() * f.w;
		const y = f.y0 + next() * f.h;
		if (f.skip(x, y)) continue;
		const o = 0.35 + next() * 0.5;
		if (y >= f.y0 + f.h * keep) continue;
		const cls = i % 3 === 0 ? ` class="s${i % 3}"` : '';
		out.push(`<circle${cls} cx="${f1(x)}" cy="${f1(y)}" r="${[0.6, 0.8, 1.1][i % 3]}" fill="${t.city.sky}" opacity="${(p === 'night' ? o : o * 0.7).toFixed(2)}"/>`);
	}
	return `<g>${out.join('')}</g>`;
}

const r2 = (v: number) => String(Number(v.toFixed(2)));
const moon = (t: Theme, cx: number, cy: number, k: number) =>
	`<circle cx="${cx}" cy="${cy}" r="${r2(40 * k)}" fill="url(#moonglow)"/>
<circle cx="${cx}" cy="${cy}" r="${r2(14 * k)}" fill="${t.moon}"/>
<circle cx="${r2(cx + 6 * k)}" cy="${r2(cy - 5 * k)}" r="${r2(12.5 * k)}" fill="${t.bg}"/>`;

// The plane rests left of the frame, so it is hidden when motion is off.
const plane = (t: Theme, y: number) =>
	`<g clip-path="url(#frame)"><g class="plane"><g transform="translate(-30 ${y})"><rect x="0" y="0" width="14" height="2" rx="1" fill="${t.fainter}"/><circle class="bl" cx="0" cy="1" r="1.6" fill="#ff7b72"/><circle class="bl" cx="14" cy="1" r="1.6" fill="#f0f6fc" style="animation-delay:.7s"/></g></g></g>`;

// Everything but the buildings, which differ per phase: the sky, its CSS
// and defs. `frame` is the slice's inside, which clips the plane and clouds.
function scene(t: Theme, p: Phase, box: SkyBox, frame: {x: number; w: number; h: number}): {css: string; defs: string; under: (stars: string) => string} {
	const css = [`@keyframes tw{0%,100%{opacity:.9}50%{opacity:.15}}
@keyframes fl{0%,40%,100%{opacity:1}45%,60%{opacity:.1}}
@keyframes blink{0%,90%,100%{opacity:0}93%{opacity:1}}
@keyframes fly{from{transform:translate(${frame.x - 10}px,0)}to{transform:translate(${frame.x + frame.w + 70}px,-30px)}}
.s0{animation:tw 3s infinite}
.f0{animation:fl 5s infinite}.f1{animation:fl 7s infinite 2s}.f2{animation:fl 9s infinite 4s}
.plane{animation:fly 26s linear infinite}.bl{animation:blink 1.4s infinite}`];
	const defs = [`<clipPath id="frame"><rect x="${frame.x}" y="0" width="${frame.w}" height="${frame.h}"/></clipPath>`];
	if (p === 'night') {
		defs.push(`<radialGradient id="moonglow"><stop offset="0" stop-color="${t.moon}" stop-opacity=".22"/><stop offset="1" stop-color="${t.moon}" stop-opacity="0"/></radialGradient>`);
		return {css: css.join('\n'), defs: defs.join('\n'), under: st => `${st}\n${moon(t, ...box.high, box.k)}`};
	}
	const L = skyLayer(t, p, box);
	css.push(L.css);
	defs.push(L.defs);
	return {css: css.join('\n'), defs: defs.join('\n'), under: st => `${L.grad}\n${st}\n<g clip-path="url(#frame)">${L.sun}\n${L.clouds}</g>`};
}

function readout(t: Theme, x: number, y: number, size: number, anchor: 'start' | 'end'): string {
	const s = sky();
	return `<text x="${x}" y="${y}"${anchor === 'end' ? ' text-anchor="end"' : ''} class="dim" style="font-size:${size}px"><tspan fill="${phaseColor(t, s.phase)}" font-weight="700">${s.phase}</tspan> · ${s.event} ${esc(s.at)}</text>`;
}

function legendRow(t: Theme, x: number, y: number, size: number, sw: number): string {
	const C = t.city;
	const cw = size * 0.6; // JetBrains Mono advance
	const x0 = x + 5 * cw + 7;
	const swatches = [C.empty, ...C.roofs].map((c, i) => `<rect x="${f1(x0 + i * (sw + 5))}" y="${f1(y - sw + 1)}" width="${sw}" height="${sw}" fill="${c}"/>`).join('');
	return `<text x="${x}" y="${y}" class="dim" style="font-size:${size}px">quiet</text>${swatches}<text x="${f1(x0 + 5 * (sw + 5) + 1)}" y="${y}" class="dim" style="font-size:${size}px">skyscraper</text>`;
}

export async function city(t: Theme, calendar: Calendar, updated: string, counter: string): Promise<string> {
	const C = t.city;
	const p = sky().phase;
	const counts = calendar.map(([, n]) => n);
	const total = counts.reduce((a, b) => a + b, 0);
	const r = rng(`${updated}-${total}`);
	const next = () => r.next().value as number;
	const shapes = buildings(t, calendar, next, DESK_ISO, p);

	// The sky in the empty top-right corner: stars and the moon by night, a
	// gradient and a sun otherwise, and a plane crossing.
	const sc = scene(t, p, {
		x0: FL, x1: FR, top: 62, horizon: 600, bottom: 680, fade: skyFade(DESK_ISO),
		high: [FR - 80, 160], low: [FR - 86, 486], k: 1, clouds: [[488, 150, 1], [606, 226, 0.8]], drift: 40,
	}, {x: FL, w: FR - FL, h: 680});
	const st = stars(t, next, {x0: 470, w: 350, y0: 118, h: 150, n: 46, skip: (x, y) => x > 700 && y < 215}, p);
	const busiest = calendar.reduce((best, cur) => (cur[1] > best[1] ? cur : best), calendar[0]);
	const info = [
		`<tspan class="cy" font-weight="700">${num(total)}</tspan> contributions · last 365 days`,
		busiest[1] ? `busiest day <tspan class="fg">${monthDay(busiest[0])}</tspan> · ${busiest[1]}` : '',
		`${counts.filter(n => n).length} active days`,
	].filter(Boolean).map((s, i) => `<text x="${FR - 36}" y="${300 + i * 20}" text-anchor="end" class="dim" style="font-size:12px">${s}</text>`).join('');
	const legend = [C.empty, ...C.roofs].map((c, i) => `<rect x="${X + 52 + i * 16}" y="642" width="11" height="11" fill="${c}"/>`).join('');
	const body = `${heading(t, 44, 'contribution-city', counter)}
${prompt('render-city --last 365d', 0.15, '# one building per day')}
${sc.under(st)}
${plane(t, 132)}
${info}
${shapes}
<text x="${X}" y="652" class="dim" style="font-size:11px">quiet</text>${legend}<text x="${X + 52 + 5 * 16 + 6}" y="652" class="dim" style="font-size:11px">skyscraper</text>
${readout(t, FR - 36, 652, 11, 'end')}`;
	return slice(t, 680, body, {
		title: `Contribution city ${WHEN[p]}`, desc: cityAlt(calendar), css: sc.css, defs: sc.defs,
		text: `~/contribution-city${counter}$ render-city --last 365d # one building per dayquietskyscraper`,
	});
}

export function cityAlt(calendar: Calendar): string {
	const total = calendar.reduce((a, [, n]) => a + n, 0);
	const busiest = calendar.reduce((best, cur) => (cur[1] > best[1] ? cur : best), calendar[0]);
	const s = sky();
	return `Contribution city: an isometric skyline ${WHEN[s.phase]} (${s.event} ${s.at} in jdx's time zone) with one building per day of the last year, taller and brighter for busier days. ${num(total)} contributions` +
		(busiest[1] ? `, busiest day ${monthDay(busiest[0], true)} with ${busiest[1]}.` : '.');
}

// ─────────────────────────────── phone ────────────────────────────────
// Phone layouts, swapped in below 600px through <picture>.

// The same city on a 13px tile spans the 440px slice rail to rail; the
// info lines sit in the empty ground below its front edge.
const PHONE_ISO: Iso = {tw: 13, th: 6.5, ox: 67.5, oy: 180, hmax: 68, s: 0.52, ws: 0.7};

export async function phoneCity(t: Theme, calendar: Calendar, updated: string, counter: string): Promise<string> {
	const g = PHONE;
	const p = sky().phase;
	const counts = calendar.map(([, n]) => n);
	const total = counts.reduce((a, b) => a + b, 0);
	const r = rng(`${updated}-${total}`);
	const next = () => r.next().value as number;
	const shapes = buildings(t, calendar, next, PHONE_ISO, p);
	const H = 400;
	const sc = scene(t, p, {
		x0: g.FL, x1: g.FR, top: 62, horizon: 340, bottom: H, fade: skyFade(PHONE_ISO),
		high: [g.R - 34, 134], low: [g.R - 30, 286], k: 0.6, clouds: [[236, 124, 0.8], [292, 186, 0.62]], drift: 22,
	}, {x: g.FL, w: g.FR - g.FL, h: H});
	const st = stars(t, next, {x0: 150, w: 270, y0: 104, h: 110, n: 34, skip: (x, y) => x > 340 && y < 168}, p);
	const busiest = calendar.reduce((best, cur) => (cur[1] > best[1] ? cur : best), calendar[0]);
	const info = [
		`<tspan class="cy" font-weight="700">${num(total)}</tspan> contributions`,
		busiest[1] ? `busiest day <tspan class="fg">${monthDay(busiest[0])}</tspan> · ${busiest[1]}` : '',
		`${counts.filter(n => n).length} active days`,
	].filter(Boolean).map((s, i) => `<text x="${g.X}" y="${294 + i * 18}" class="dim" style="font-size:12px">${s}</text>`).join('');
	const body = `${headingG(t, g, 44, 'contribution-city', counter)}
${promptG(g, 'render-city --last 365d', 0.15, '# one building per day', 90, 13)}
${sc.under(st)}
${plane(t, 120)}
${shapes}
${info}
${readout(t, g.X, 356, 12, 'start')}
${legendRow(t, g.X, 382, 11, 10)}`;
	return sliceG(t, g, H, body, {
		title: `Contribution city ${WHEN[p]}`, desc: cityAlt(calendar), css: sc.css, defs: sc.defs,
		text: `~/contribution-city${counter}$ render-city --last 365d # one building per dayquietskyscraper`,
	});
}
