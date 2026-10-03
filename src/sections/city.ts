// ~/contribution-city, ported from Giorgi Kobaidze's render.py (MIT; see NOTICE).
import {createHash} from 'node:crypto';
import {DESKTOP, FL, FR, HW, M, PHONE, type Geo, type Theme, W, X, esc, f1, halfSlice, halfSliceG, heading, headingG, num, placeholder, prompt, promptG, segment, segmentG, slice, sliceG, stagger, up40, wrap} from '../console.ts';
import {CREDIT_POST, CREDIT_URL, DAY, NEW_DAYS, age, iso, monthDay, parse, shift, short, sum, toolColor} from '../shared.ts';
import {type Calendar, type Installs, type Post, type Project, type RepoStars, type Snapshot, type Stars, slugify} from '../data.ts';

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

export async function city(t: Theme, calendar: Calendar, updated: string, counter: string): Promise<string> {
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

export function cityAlt(calendar: Calendar): string {
	const total = calendar.reduce((a, [, n]) => a + n, 0);
	const busiest = calendar.reduce((best, cur) => (cur[1] > best[1] ? cur : best), calendar[0]);
	return `Contribution city: an isometric night skyline with one building per day of the last year, taller and brighter for busier days. ${num(total)} contributions` +
		(busiest[1] ? `, busiest day ${monthDay(busiest[0], true)} with ${busiest[1]}.` : '.');
}

// ─────────────────────────────── phone ────────────────────────────────
// Phone layouts, swapped in below 600px through <picture>.
export async function phoneCity(t: Theme, calendar: Calendar, updated: string, counter: string): Promise<string> {
	return placeholder(t, PHONE.W, 400, 'contribution city');
}
