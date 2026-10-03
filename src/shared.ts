// Helpers shared by the sections.
import {type Theme} from './console.ts';

export const CREDIT_URL = 'https://github.com/georgekobaidze/georgekobaidze';
export const CREDIT_POST = 'https://dev.to/georgekobaidze/i-turned-my-github-profile-into-a-cyberpunk-console-with-a-city-built-from-my-contributions-h4c';

export function short(n: number): string {
	const [div, unit] = n >= 1e6 ? [1e6, 'M'] : n >= 1e3 ? [1e3, 'k'] : [1, ''];
	return `${Number((n / div).toPrecision(3))}${unit}`;
}

export function monthDay(iso: string, long = false): string {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {month: long ? 'long' : 'short', day: 'numeric', timeZone: 'UTC'});
}

export const DAY = 864e5;
export const parse = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const shift = (d: string, n: number) => iso(parse(d) + n * DAY);
export const age = (from: string, to: string) => Math.round((parse(to) - parse(from)) / DAY);

// Fixed colors so a tool looks the same in every chart; the rest are grey.
export const COLOR_ORDER = ['mr-boxington', 'fnox', 'hk', 'packslip', 'aube', 'usage', 'pitchfork'];
export function toolColor(t: Theme, repo: string): string {
	const i = COLOR_ORDER.indexOf(repo.split('/')[1]);
	return t.series[i === -1 ? t.series.length - 1 : i];
}

export function sum(daily: Record<string, number>, from: string, to: string): number {
	let n = 0;
	for (const [d, c] of Object.entries(daily)) if (d >= from && d <= to) n += c;
	return n;
}

export const NEW_DAYS = 60;
