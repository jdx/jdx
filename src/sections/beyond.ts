// ~/beyond-mise: cumulative stars of every tool except mise.
import {DESKTOP, FL, FR, HW, M, PHONE, type Geo, type Theme, W, X, esc, f1, halfSlice, halfSliceG, heading, headingG, num, placeholder, prompt, promptG, segment, segmentG, slice, sliceG, stagger, up40, wrap} from '../console.ts';
import {CREDIT_POST, CREDIT_URL, DAY, NEW_DAYS, age, iso, monthDay, parse, shift, short, sum, toolColor} from '../shared.ts';
import {type Calendar, type Installs, type Post, type Project, type RepoStars, type Snapshot, type Stars, slugify} from '../data.ts';

// ──────────────────────────── ~/beyond-mise ───────────────────────────
export const ORIGIN = '2025-01-01';
export const BAND_MIN = 300;

export function niceStep(raw: number): number {
	const p = 10 ** Math.floor(Math.log10(raw));
	return [1, 1.5, 2, 2.5, 3, 4, 5, 10].map(m => m * p).find(s => s >= raw)!;
}

type Band = {label: string; color: string; values: number[]; total: number; young: boolean};

// The stacked series both layouts draw: one band per tool with BAND_MIN stars,
// bottom to top in launch order, under a grey band for the rest.
function model(t: Theme, stars: Stars, projects: Project[]) {
	const D = stars.end;
	const names = new Map(projects.map(p => [p.repo, p.name]));
	const repos = Object.entries(stars.repos).filter(([r]) => names.has(r));
	const cum = (s: RepoStars, d: string) => sum(s.daily, '0000', d);
	const dates: string[] = [];
	for (let d = D; d >= ORIGIN; d = shift(d, -7)) dates.unshift(d);
	if (dates[0] !== ORIGIN) dates.unshift(ORIGIN);

	const own = repos.filter(([, s]) => cum(s, D) >= BAND_MIN).sort((a, b) => a[1].created_at.localeCompare(b[1].created_at));
	const rest = repos.filter(([, s]) => cum(s, D) < BAND_MIN);
	const bands: Band[] = [];
	if (rest.length) {
		bands.push({
			label: `+${rest.length} more`, color: t.series.at(-1)!,
			values: dates.map(d => rest.reduce((a, [, s]) => a + cum(s, d), 0)),
			total: rest.reduce((a, [, s]) => a + cum(s, D), 0), young: false,
		});
	}
	for (const [repo, s] of own) {
		bands.push({label: names.get(repo)!, color: toolColor(t, repo), values: dates.map(d => cum(s, d)), total: cum(s, D), young: age(s.created_at, D) < NEW_DAYS});
	}
	const totals = dates.map((_, i) => bands.reduce((a, b) => a + b.values[i], 0));
	const grand = totals.at(-1)!;
	const yearAgo = shift(D, -365);
	const yearAgoTotal = repos.reduce((a, [, s]) => a + cum(s, yearAgo), 0);
	// Stars on tools launched within the year, to say honestly where the growth came from.
	const launched = repos.filter(([, s]) => s.created_at > yearAgo).reduce((a, [, s]) => a + cum(s, D), 0);
	const others = bands.length - (rest.length ? 1 : 0) + rest.length;
	return {D, names, own, dates, bands, totals, grand, yearAgo, yearAgoTotal, others, launched};
}

type Model = ReturnType<typeof model>;

// The stacked bands, bottom up, each fading in after the one below.
function areas(m: Model, xOf: (d: string) => number, yOf: (v: number) => number): string {
	const out: string[] = [];
	const lower = m.dates.map(() => 0);
	m.bands.forEach((b, bi) => {
		const top = b.values.map((v, i) => lower[i] + v);
		const up = m.dates.map((d, i) => `${f1(xOf(d))},${f1(yOf(top[i]))}`);
		const down = m.dates.map((d, i) => `${f1(xOf(d))},${f1(yOf(lower[i]))}`).reverse();
		const delay = (0.3 + bi * 0.12).toFixed(2);
		out.push(`<g class="band" style="animation-delay:${delay}s"><path d="M${up.join('L')}L${down.join('L')}Z" fill="${b.color}" fill-opacity=".22"/>
<path d="M${up.join('L')}" fill="none" stroke="${b.color}" stroke-width="3" opacity=".45" filter="url(#g)"/>
<path d="M${up.join('L')}" fill="none" stroke="${b.color}" stroke-width="1.5"/></g>`);
		top.forEach((v, i) => (lower[i] = v));
	});
	return out.join('\n');
}

// A pulsing dot at the end of each band launched in the last NEW_DAYS.
function pulses(m: Model, px1: number, yOf: (v: number) => number): string {
	return m.bands.filter(b => b.young).map(b => {
		const y = yOf(m.totals.at(-1)! - m.bands.slice(m.bands.indexOf(b) + 1).reduce((a, x) => a + x.total, 0));
		return `<circle class="pulse" cx="${px1}" cy="${f1(y)}" r="3" fill="${b.color}"/>`;
	}).join('');
}

function describe(m: Model): string {
	return `Stacked area chart of cumulative GitHub stars since January 2025 for jdx's tools other than mise: ${short(m.grand)} stars in total, about ${short(m.yearAgoTotal)} a year earlier${m.grand > m.yearAgoTotal && m.launched * 2 > m.grand - m.yearAgoTotal ? ', mostly from tools launched since then' : ''}. ` +
		m.bands.slice().reverse().map(b => `${b.label} ${b.total}`).join(', ') + '.';
}

export async function beyondMise(t: Theme, stars: Stars, projects: Project[], counter: string): Promise<string> {
	const data = model(t, stars, projects);
	const {D, names, own, bands, grand, yearAgo, yearAgoTotal, others} = data;

	const [px0, px1, py0, py1] = [X, 700, 160, 380];
	const step = niceStep(grand / 5);
	const ymax = Math.ceil(grand / step) * step;
	const span = parse(D) - parse(ORIGIN);
	const xOf = (d: string) => px0 + ((parse(d) - parse(ORIGIN)) / span) * (px1 - px0);
	const yOf = (v: number) => py1 - (v / ymax) * (py1 - py0);

	const grid: string[] = [];
	for (let v = step; v <= ymax; v += step) {
		grid.push(`<line x1="${px0}" y1="${f1(yOf(v))}" x2="${px1}" y2="${f1(yOf(v))}" stroke="${t.accent}" stroke-opacity=".12" stroke-dasharray="2 4"/>`);
		grid.push(`<text x="${px0 - 6}" y="${f1(yOf(v) + 4)}" text-anchor="end" class="fainter" style="font-size:10px">${short(v)}</text>`);
	}
	const ticks: string[] = [];
	for (let y = 2025; ; y++) {
		let stop = false;
		for (const [m, label] of [[1, `Jan '${String(y).slice(2)}`], [4, 'Apr'], [7, 'Jul'], [10, 'Oct']] as const) {
			const d = `${y}-${String(m).padStart(2, '0')}-01`;
			if (d > D) {
				stop = true;
				break;
			}
			ticks.push(`<line x1="${f1(xOf(d))}" y1="${py1}" x2="${f1(xOf(d))}" y2="${py1 + 4}" stroke="${t.accent}" stroke-opacity=".4"/><text x="${f1(xOf(d))}" y="${py1 + 16}" text-anchor="middle" class="fainter" style="font-size:10px">${label}</text>`);
		}
		if (stop) break;
	}

	// Labels in the right gutter at each band's midpoint, at least 16px apart.
	let base = 0;
	const want = bands.map(b => {
		const mid = yOf(base + b.total / 2);
		base += b.total;
		return mid;
	});
	const placed = [...want];
	for (let i = 1; i < placed.length; i++) placed[i] = Math.min(placed[i], placed[i - 1] - 16);
	const shiftDown = Math.max(0, py0 - 4 - placed.at(-1)!);
	const labels = bands.map((b, i) => {
		const y = placed[i] + shiftDown;
		return `<path d="M${px1 + 2} ${f1(want[i])}L${px1 + 12} ${f1(y)}" stroke="${b.color}" stroke-opacity=".5" fill="none"/>
<text x="${px1 + 16}" y="${f1(y + 4)}" fill="${b.color}" style="font-size:11px">${esc(b.label)} <tspan class="dim">${short(b.total)}</tspan></text>`;
	}).join('\n');

	// Launch notches for tools with their own band, labels alternating rows.
	const launches = own.filter(([, s]) => s.created_at >= ORIGIN).map(([repo, s], i) => {
		const x = f1(xOf(s.created_at));
		return `<line x1="${x}" y1="${py1}" x2="${x}" y2="${py1 - 6}" stroke="${toolColor(t, repo)}" stroke-width="2"/><text x="${x}" y="${py1 + 30 + (i % 2) * 12}" text-anchor="middle" fill="${toolColor(t, repo)}" style="font-size:9.5px">${esc(names.get(repo)!)}</text>`;
	}).join('');
	const ya = f1(xOf(yearAgo));
	const callout = `<line x1="${ya}" y1="${py0}" x2="${ya}" y2="${py1}" stroke="${t.dim}" stroke-opacity=".5" stroke-dasharray="3 3"/>
<text x="${f1(Number(ya) + 6)}" y="${py0 + 10}" class="dim" style="font-size:10px">~${short(yearAgoTotal)} a year ago</text>`;
	const head = `<tspan class="cy" font-weight="700">${short(grand)}★</tspan> across ${others} tools beyond mise`;
	const body = `${heading(t, 44, 'beyond-mise', counter)}
${prompt('gh api repos/{owner}/{repo}/stargazers --paginate', 0.15, '# every tool except mise')}
<g class="ln" style="animation-delay:.2s"><text x="${X}" y="136" class="dim" style="font-size:12px">cumulative stars since Jan 2025, stacked by launch</text>
<text x="${FR - 36}" y="136" text-anchor="end" class="dim" style="font-size:12px">${head}</text></g>
${grid.join('')}
<line x1="${px0}" y1="${py1}" x2="${px1}" y2="${py1}" stroke="${t.accent}" stroke-opacity=".4"/>
${ticks.join('')}
${areas(data, xOf, yOf)}
${callout}
<g class="ln" style="animation-delay:1.1s">${labels}</g>
${launches}
${pulses(data, px1, yOf)}`;
	const css = `.band{animation:fadein .5s ease-out both}
.pulse{animation:pulse 1s ease-in-out 3 1.4s}`;
	return slice(t, 440, body, {
		title: 'Beyond mise', desc: describe(data), css,
		text: `~/beyond-mise${counter}$ gh api repos/{owner}/{repo}/stargazers --paginate # every tool except mise cumulative stars since Jan 2025, stacked by launch★ across tools beyond mise~a year agoJanAprJulOct'0123456789k.+more`,
	});
}

// ─────────────────────────────── phone ────────────────────────────────
// Phone layouts, swapped in below 600px through <picture>.
//
// The desktop's right-gutter labels don't fit in 440px, so the plot takes the
// whole text column and a two-column legend under it names each band, top of
// the stack first. Y-axis values sit inside the plot above their gridlines;
// only Jan and Jul get x-axis labels.
const CH = 0.6; // JetBrains Mono advance, in ems

export async function phoneBeyondMise(t: Theme, stars: Stars, projects: Project[], counter: string): Promise<string> {
	const g = PHONE;
	const data = model(t, stars, projects);
	const {D, names, own, bands, grand, yearAgo, yearAgoTotal, others} = data;

	const [px0, px1, py0, py1] = [g.X, g.R - 4, 184, 380];
	const step = niceStep(grand / 5);
	const ymax = Math.ceil(grand / step) * step;
	const span = parse(D) - parse(ORIGIN);
	const xOf = (d: string) => px0 + ((parse(d) - parse(ORIGIN)) / span) * (px1 - px0);
	const yOf = (v: number) => py1 - (v / ymax) * (py1 - py0);
	// x for a label of `chars` at `size` centered on cx, kept inside the text column.
	const fit = (cx: number, chars: number, size: number) => {
		const w = chars * size * CH;
		return Math.min(Math.max(cx, g.X + w / 2), g.R - w / 2);
	};

	const grid: string[] = [];
	for (let v = step; v <= ymax; v += step) {
		grid.push(`<line x1="${px0}" y1="${f1(yOf(v))}" x2="${px1}" y2="${f1(yOf(v))}" stroke="${t.accent}" stroke-opacity=".12" stroke-dasharray="2 4"/>`);
		grid.push(`<text x="${px0 + 2}" y="${f1(yOf(v) - 4)}" fill="${t.faint}" style="font-size:11px">${short(v)}</text>`);
	}
	const ticks: string[] = [];
	for (let y = 2025; ; y++) {
		let stop = false;
		for (const [mo, label] of [[1, `Jan '${String(y).slice(2)}`], [4, ''], [7, 'Jul'], [10, '']] as const) {
			const d = `${y}-${String(mo).padStart(2, '0')}-01`;
			if (d > D) {
				stop = true;
				break;
			}
			const x = xOf(d);
			ticks.push(`<line x1="${f1(x)}" y1="${py1}" x2="${f1(x)}" y2="${py1 + (label ? 5 : 3)}" stroke="${t.accent}" stroke-opacity=".4"/>`);
			if (label) ticks.push(`<text x="${f1(fit(x, label.length, 12))}" y="${py1 + 18}" text-anchor="middle" fill="${t.faint}" style="font-size:12px">${label}</text>`);
		}
		if (stop) break;
	}

	// Launch notches; each name takes the first row it fits in without overlap.
	const rowEnds: number[] = [];
	const launches = own.filter(([, s]) => s.created_at >= ORIGIN).map(([repo, s]) => {
		const name = names.get(repo)!;
		const x = xOf(s.created_at);
		const cx = fit(x, name.length, 11);
		const w = name.length * 11 * CH;
		let row = rowEnds.findIndex(end => cx - w / 2 >= end + 8);
		if (row < 0) row = rowEnds.push(0) - 1;
		rowEnds[row] = cx + w / 2;
		const c = toolColor(t, repo);
		return `<line x1="${f1(x)}" y1="${py1}" x2="${f1(x)}" y2="${py1 - 6}" stroke="${c}" stroke-width="2"/><text x="${f1(cx)}" y="${py1 + 34 + row * 13}" text-anchor="middle" fill="${c}" style="font-size:11px">${esc(name)}</text>`;
	}).join('');

	const ya = xOf(yearAgo);
	const note = `~${short(yearAgoTotal)} a year ago`;
	const flip = ya + 6 + note.length * 12 * CH > g.R;
	const callout = `<line x1="${f1(ya)}" y1="${py0}" x2="${f1(ya)}" y2="${py1}" stroke="${t.dim}" stroke-opacity=".5" stroke-dasharray="3 3"/>
<text x="${f1(flip ? ya - 6 : ya + 6)}" y="${py0 + 14}"${flip ? ' text-anchor="end"' : ''} class="dim" style="font-size:12px">${note}</text>`;

	// Legend: two columns, filled top to bottom in stack order (top band first).
	const ly = (rowEnds.length ? py1 + 34 + (rowEnds.length - 1) * 13 : py1 + 18) + 28;
	const order = bands.slice().reverse();
	const perCol = Math.ceil(order.length / 2);
	const gap = 28;
	const colW = (g.R - g.X - gap) / 2;
	const legend = order.map((b, i) => {
		const cx = g.X + Math.floor(i / perCol) * (colW + gap);
		const y = ly + (i % perCol) * 20;
		const total = short(b.total);
		const room = Math.floor((colW - 16 - 8) / (12 * CH)) - total.length;
		const label = b.label.length > room ? `${b.label.slice(0, room - 1)}…` : b.label;
		return `<g class="ln" style="animation-delay:${(1.1 + i * 0.06).toFixed(2)}s"><rect x="${cx}" y="${y - 9}" width="10" height="10" rx="2" fill="${b.color}" fill-opacity=".3" stroke="${b.color}"${b.young ? ' class="pulse"' : ''}/>
<text x="${cx + 16}" y="${y}" fill="${b.color}" style="font-size:12px">${esc(label)}</text><text x="${f1(cx + colW)}" y="${y}" text-anchor="end" class="dim" style="font-size:12px">${total}</text></g>`;
	}).join('\n');
	const h = up40(ly + (perCol - 1) * 20 + 18);

	const body = `${headingG(t, g, 44, 'beyond-mise', counter)}
${promptG(g, 'gh api repos/{owner}/{repo}/stargazers --paginate', 0.15, '', 92, 12)}
<g class="ln" style="animation-delay:.2s"><text x="${g.X}" y="132" font-weight="700" fill="${t.accent}" filter="url(#g)" opacity=".6" style="font-size:22px">${short(grand)}★</text>
<text x="${g.X}" y="132"><tspan class="cy" font-weight="700" style="font-size:22px">${short(grand)}★</tspan><tspan class="fg" style="font-size:13px"> across ${others} tools beyond mise</tspan></text>
<text x="${g.X}" y="154" class="dim" style="font-size:12px">cumulative stars since Jan 2025, stacked by launch</text></g>
${grid.join('')}
<line x1="${px0}" y1="${py1}" x2="${px1}" y2="${py1}" stroke="${t.accent}" stroke-opacity=".4"/>
${ticks.join('')}
${areas(data, xOf, yOf)}
${callout}
${launches}
${pulses(data, px1, yOf)}
${legend}`;
	const css = `.band{animation:fadein .5s ease-out both}
.pulse{animation:pulse 1s ease-in-out 3 1.4s}`;
	return sliceG(t, g, h, body, {
		title: 'Beyond mise', desc: describe(data), css,
		text: `~/beyond-mise${counter}$ gh api repos/{owner}/{repo}/stargazers --paginate cumulative stars since Jan 2025, stacked by launch★ across tools beyond mise~a year agoJanJul'0123456789k.+more…`,
	});
}
