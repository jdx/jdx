// The sky over the contribution city follows the time of day where jdx
// lives: night, dawn, day or dusk, from NOAA's sunrise/sunset approximation.
// Only the phase reaches the SVG, so a render changes a handful of times a
// day and the same phase and data always draw the same bytes. PROFILE_NOW
// (any Date.parse-able timestamp) stands in for the clock when testing.
import {type Theme, f1} from './console.ts';

export const TZ = 'America/Chicago';
const LAT = 32.78; // Dallas, TX
const LON = -96.8;

export type Phase = 'night' | 'dawn' | 'day' | 'dusk';

// How far each phase reaches around sunrise and sunset, in minutes.
const DAWN_BEFORE = 45;
const DAWN_AFTER = 45;
const DUSK_BEFORE = 60;
const DUSK_AFTER = 45;

export type Sky = {
	phase: Phase;
	// The next sunrise (night, dawn) or sunset (day, dusk), "07:21 CDT".
	event: 'sunrise' | 'sunset';
	at: string;
};

const RAD = Math.PI / 180;
const MIN = 6e4;

// Sunrise and sunset (ms since the epoch) on a calendar date, from NOAA's
// "General Solar Position Calculations"; good to a minute or two here.
export function sunTimes(y: number, m: number, d: number): {rise: number; set: number} {
	const day0 = Date.UTC(y, m - 1, d);
	const doy = (day0 - Date.UTC(y, 0, 1)) / 864e5 + 1;
	const len = (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 864e5;
	const g = (2 * Math.PI / len) * (doy - 1);
	const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
	const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) +
		0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
	const ha = Math.acos(Math.cos(90.833 * RAD) / (Math.cos(LAT * RAD) * Math.cos(decl)) - Math.tan(LAT * RAD) * Math.tan(decl)) / RAD;
	return {rise: day0 + (720 - 4 * (LON + ha) - eqt) * MIN, set: day0 + (720 - 4 * (LON - ha) - eqt) * MIN};
}

const localDate = new Intl.DateTimeFormat('en-CA', {timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'});
const localTime = new Intl.DateTimeFormat('en-US', {timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short'});

function clock(ms: number): string {
	const parts = Object.fromEntries(localTime.formatToParts(Math.round(ms / MIN) * MIN).map(p => [p.type, p.value]));
	return `${parts.hour}:${parts.minute} ${parts.timeZoneName}`;
}

export function skyAt(now: number): Sky {
	const [y, m, d] = localDate.format(now).split('-').map(Number);
	const {rise, set} = sunTimes(y, m, d);
	if (now < rise - DAWN_BEFORE * MIN) return {phase: 'night', event: 'sunrise', at: clock(rise)};
	if (now < rise + DAWN_AFTER * MIN) return {phase: 'dawn', event: 'sunrise', at: clock(rise)};
	if (now < set - DUSK_BEFORE * MIN) return {phase: 'day', event: 'sunset', at: clock(set)};
	if (now < set + DUSK_AFTER * MIN) return {phase: 'dusk', event: 'sunset', at: clock(set)};
	// After dusk the next sunrise is tomorrow's (noon UTC is safely the next local day).
	const [ty, tm, td] = localDate.format(Date.UTC(y, m - 1, d + 1, 12)).split('-').map(Number);
	return {phase: 'night', event: 'sunrise', at: clock(sunTimes(ty, tm, td).rise)};
}

// The sky for this render, read once so every slice agrees.
let current: Sky | undefined;
export function sky(): Sky {
	if (!current) {
		const env = process.env.PROFILE_NOW;
		const now = env ? Date.parse(env) : Date.now();
		if (Number.isNaN(now)) throw new Error(`PROFILE_NOW is not a timestamp: ${env}`);
		current = skyAt(now);
	}
	return current;
}

// "at dusk" and friends, for titles and alt text.
export const WHEN: Record<Phase, string> = {night: 'at night', dawn: 'at dawn', day: 'by day', dusk: 'at dusk'};

export function mix(a: string, b: string, k: number): string {
	const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
	const [x, y] = [rgb(a), rgb(b)];
	return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
}

const BLUR = 4; // the sun's glow, px (as the console's #g)
const SUN = '#ffd36e';
const SUN_CORE = '#fff6d8';
// Sky gradients from the top of the sky down to the horizon: [offset, color, opacity].
const GRADIENTS: Record<Exclude<Phase, 'night'>, (t: Theme) => [number, string, number][]> = {
	dawn: () => [[0, '#2b1a5e', 0], [0.4, '#4b2a8a', 0.2], [0.72, '#ff7ab6', 0.2], [1, '#ffb877', 0.36]],
	day: t => [[0, t.city.roofs[1], 0], [0.2, t.city.roofs[1], 0.08], [0.5, t.city.roofs[2], 0.16], [1, t.accent, 0.3]],
	dusk: t => [[0, '#2a0f4a', 0], [0.38, '#6a1b9a', 0.26], [0.7, t.accent2, 0.22], [1, '#ff9e3d', 0.42]],
};
// The sun's face at dawn and dusk, top to bottom.
const FACES: Record<'dawn' | 'dusk', [string, string]> = {dawn: ['#fff1c1', '#ff7ab6'], dusk: ['#ffe27a', '#ff2bd6']};
// Cloud rims and bodies.
const CLOUDS: Record<Exclude<Phase, 'night'>, (t: Theme) => [string, string]> = {
	dawn: t => ['#ff9ec7', mix(t.bg, '#ff9ec7', 0.16)],
	day: t => [t.accent, mix(t.bg, daylight(t), 0.2)],
	dusk: t => ['#ff9e3d', mix(t.bg, '#ff7ab6', 0.18)],
};
// The theme's accent washed out toward white: what daylight tints.
export const daylight = (t: Theme) => mix(t.accent, '#ffffff', 0.5);
// Each phase's word in the readout under the city.
export function phaseColor(t: Theme, p: Phase): string {
	return {night: t.moon, dawn: '#ff9ec7', day: SUN, dusk: '#ff9e3d'}[p];
}

// Where the sky sits in a slice; k scales the sun, moon and clouds.
export type SkyBox = {
	x0: number;
	x1: number;
	top: number; // the gradient runs from here (clear)...
	horizon: number; // ...to here (strongest)...
	bottom: number; // ...and holds to the slice's bottom
	// The sky fades into the ground along `left` west of x and `right` east of it.
	fade: {x: number; left: number[]; right: number[]};
	high: [number, number]; // the moon by night, the sun by day
	low: [number, number]; // the sun at dawn and dusk
	k: number;
	clouds: [number, number, number][]; // x, y, size
	drift: number; // how far clouds wander, px
};

export type SkyLayer = {defs: string; css: string; grad: string; sun: string; clouds: string};

// The gradient, sun and clouds for every phase but night, which keeps the
// city's original moon. The caller stacks them: grad, stars, sun, clouds.
export function skyLayer(t: Theme, p: Exclude<Phase, 'night'>, b: SkyBox): SkyLayer {
	const {k} = b;
	const stops = GRADIENTS[p](t).map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('');
	const box = `x="${b.x0}" y="${b.top}" width="${b.x1 - b.x0}" height="${b.bottom - b.top}"`;
	const fade = (id: string, v: number[]) => {
		const [x1, y1, x2, y2] = v.map(f1);
		return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>`;
	};
	// The halves meet at fade.x with equal values; the left one runs under
	// the right one so no antialiased seam shows.
	const split = Math.floor(b.fade.x);
	const defs: string[] = [
		`<linearGradient id="skygrad" gradientUnits="userSpaceOnUse" x1="0" y1="${b.top}" x2="0" y2="${b.horizon}">${stops}</linearGradient>`,
		fade('fadel', b.fade.left), fade('fader', b.fade.right),
		`<mask id="sky" maskUnits="userSpaceOnUse" ${box}><rect x="${b.x0}" y="${b.top}" width="${split + 2 - b.x0}" height="${b.bottom - b.top}" fill="url(#fadel)"/>` +
			`<rect x="${split}" y="${b.top}" width="${b.x1 - split}" height="${b.bottom - b.top}" fill="url(#fader)"/></mask>`,
	];
	// The sun's glow: the console's 4px blur, but with room for all of it
	// (#g stops 20% of the shape's width out, which squares off a small sun).
	defs.push(`<filter id="sunblur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${BLUR}"/></filter>`);
	const grad = `<rect ${box} fill="url(#skygrad)" mask="url(#sky)"/>`;
	const sun: string[] = [];
	const css: string[] = [];
	if (p === 'day') {
		const [cx, cy] = b.high;
		defs.push(`<radialGradient id="sunglow"><stop offset="0" stop-color="${SUN}" stop-opacity=".34"/><stop offset=".45" stop-color="${SUN}" stop-opacity=".1"/><stop offset="1" stop-color="${SUN}" stop-opacity="0"/></radialGradient>`);
		const rays = Array.from({length: 12}, (_, i) => {
			const a = i * 30 * RAD;
			const [r0, r1] = [21 * k, (i % 2 ? 27 : 32) * k];
			return `M${f1(cx + Math.cos(a) * r0)} ${f1(cy + Math.sin(a) * r0)}L${f1(cx + Math.cos(a) * r1)} ${f1(cy + Math.sin(a) * r1)}`;
		}).join('');
		sun.push(`<circle cx="${cx}" cy="${cy}" r="${f1(74 * k)}" fill="url(#sunglow)"/>`,
			`<g class="rays"><path d="${rays}" stroke="${SUN}" stroke-width="${f1(2 * k)}" stroke-linecap="round" opacity=".75"/></g>`,
			`<circle cx="${cx}" cy="${cy}" r="${f1(15 * k)}" fill="${SUN}" filter="url(#sunblur)"/>`,
			`<circle cx="${cx}" cy="${cy}" r="${f1(15 * k)}" fill="${SUN_CORE}"/>`);
		css.push(`@keyframes spin{to{transform:rotate(360deg)}}`, `.rays{transform-origin:${cx}px ${cy}px;animation:spin 80s linear infinite}`);
	} else {
		// A low synthwave sun, sliced, sinking behind the skyline.
		const [cx, cy] = b.low;
		const r = 24 * k;
		const [top, bottom] = FACES[p];
		defs.push(`<radialGradient id="sunglow"><stop offset="0" stop-color="${bottom}" stop-opacity=".3"/><stop offset=".5" stop-color="#ff9e3d" stop-opacity=".1"/><stop offset="1" stop-color="#ff9e3d" stop-opacity="0"/></radialGradient>`,
			`<linearGradient id="sunface" x1="0" y1="0" x2="0" y2="1"><stop offset=".1" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`);
		// The slits cut the face and its glow, so the mask reaches as far as
		// the blur does (3σ past the face); anything it leaves out is cut square.
		const reach = r + 3 * BLUR;
		const sq = `x="${f1(cx - reach)}" y="${f1(cy - reach)}" width="${f1(2 * reach)}" height="${f1(2 * reach)}"`;
		const bars = [[0.12, 0.07], [0.34, 0.1], [0.56, 0.13], [0.78, 0.16]]
			.map(([y, h]) => `<rect x="${f1(cx - r)}" y="${f1(cy + y * r)}" width="${f1(2 * r)}" height="${f1(h * r)}" fill="#000"/>`).join('');
		defs.push(`<mask id="slits" maskUnits="userSpaceOnUse" ${sq}><rect ${sq} fill="#fff"/>${bars}</mask>`);
		sun.push(`<circle cx="${cx}" cy="${cy}" r="${f1(96 * k)}" fill="url(#sunglow)"/>`,
			`<circle cx="${cx}" cy="${cy}" r="${f1(r)}" fill="${bottom}" filter="url(#sunblur)" opacity=".7" mask="url(#slits)"/>`,
			`<circle cx="${cx}" cy="${cy}" r="${f1(r)}" fill="url(#sunface)" mask="url(#slits)"/>`);
	}
	// Neon clouds: every puff stroked, then filled on top, which leaves only
	// the outline of their union as a glowing rim.
	const [rim, fill] = CLOUDS[p](t);
	const clouds = b.clouds.map(([x, y, s], i) => {
		const u = s * k;
		const puffs = `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(66 * u)}" height="${f1(12 * u)}" rx="${f1(6 * u)}"/>` +
			`<circle cx="${f1(x + 20 * u)}" cy="${f1(y + 2 * u)}" r="${f1(9 * u)}"/><circle cx="${f1(x + 36 * u)}" cy="${f1(y - 2 * u)}" r="${f1(12 * u)}"/><circle cx="${f1(x + 52 * u)}" cy="${f1(y + 3 * u)}" r="${f1(7 * u)}"/>`;
		return `<g class="c${i}" opacity=".85"><g fill="none" stroke="${rim}" stroke-width="${f1(4 * k)}" filter="url(#g)" opacity=".5">${puffs}</g>` +
			`<g fill="none" stroke="${rim}" stroke-width="${f1(2.4 * k)}">${puffs}</g><g fill="${fill}">${puffs}</g></g>`;
	});
	css.push(`@keyframes drift{from{transform:translateX(${-b.drift}px)}to{transform:translateX(${b.drift}px)}}`,
		`.c0{animation:drift 70s ease-in-out infinite alternate}.c1{animation:drift 95s ease-in-out infinite alternate-reverse}.c2{animation:drift 120s ease-in-out infinite alternate}`);
	return {defs: defs.join('\n'), css: css.join('\n'), grad, sun: sun.join('\n'), clouds: clouds.join('\n')};
}
