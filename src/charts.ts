// The three chart sections: ~/trending (stars gained this month),
// ~/beyond-mise (cumulative stars of every other tool), and ~/installs
// (installs through mise). Drawn in the console frame from console.ts.
import {FR, type Theme, X, esc, f1, heading, num, prompt, slice, wrap} from './console.ts';
import type {Installs, Project, RepoStars, Stars} from './data.ts';

const DAY = 864e5;
const parse = (d: string) => Date.parse(`${d}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const shift = (d: string, n: number) => iso(parse(d) + n * DAY);
const age = (from: string, to: string) => Math.round((parse(to) - parse(from)) / DAY);

function short(n: number): string {
	const [div, unit] = n >= 1e6 ? [1e6, 'M'] : n >= 1e3 ? [1e3, 'k'] : [1, ''];
	return `${Number((n / div).toPrecision(3))}${unit}`;
}

function monthDay(d: string): string {
	return new Date(parse(d)).toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'});
}

// Fixed colors so a tool looks the same in every chart; the rest are grey.
const COLOR_ORDER = ['mr-boxington', 'fnox', 'hk', 'packslip', 'aube', 'usage', 'pitchfork'];
export function toolColor(t: Theme, repo: string): string {
	const i = COLOR_ORDER.indexOf(repo.split('/')[1]);
	return t.series[i === -1 ? t.series.length - 1 : i];
}

function sum(daily: Record<string, number>, from: string, to: string): number {
	let n = 0;
	for (const [d, c] of Object.entries(daily)) if (d >= from && d <= to) n += c;
	return n;
}

const NEW_DAYS = 60;

// ───────────────────────────── ~/trending ─────────────────────────────
export type Trend = {p: Project; color: string; gain: number; gain7: number; prior: number; total: number; isNew: boolean; ratio: number | null; daily: number[]};

export function trends(t: Theme, stars: Stars, projects: Project[]): {rows: Trend[]; days: number} {
	const byRepo = new Map(projects.map(p => [p.repo, p]));
	const D = stars.end;
	// A quiet month widens the window rather than showing a chart of zeros.
	for (const days of [30, 90]) {
		const rows = Object.entries(stars.repos).flatMap(([repo, s]: [string, RepoStars]) => {
			const p = byRepo.get(repo);
			if (!p) return [];
			const from = shift(D, -(days - 1));
			const gain = sum(s.daily, from, D);
			const prior = sum(s.daily, shift(from, -days), shift(from, -1));
			const isNew = age(s.created_at, D) < NEW_DAYS;
			// ▲ only when the previous window is a fair comparison.
			const ratio = !isNew && prior >= 20 && gain / prior >= 1.2 ? gain / prior : null;
			const daily = Array.from({length: 30}, (_, i) => s.daily[shift(D, i - 29)] ?? 0);
			return [{p, color: toolColor(t, repo), gain, gain7: sum(s.daily, shift(D, -6), D), prior, total: sum(s.daily, '0000', D), isNew, ratio, daily}];
		}).filter(r => r.gain > 0)
			.sort((a, b) => b.gain - a.gain || b.gain7 - a.gain7 || a.p.name.localeCompare(b.p.name));
		if (rows.filter(r => r.gain >= 5).length >= 3 || days === 90) return {rows: rows.slice(0, 6), days};
	}
	throw new Error('unreachable');
}

export async function trendingHead(t: Theme, stars: Stars, days: number, counter: string): Promise<string> {
	const sub = `★ gained · ${days} days to ${monthDay(stars.end)} (UTC)`;
	const m = stars.mise;
	const right = m ? `<tspan class="cy" font-weight="700">mise</tspan> ${short(m.total)}★ · +${num(m.gain30)} in 30d` : '';
	const body = `${heading(t, 44, 'trending', counter)}
${prompt('gh api repos/jdx/{tool}/stargazers --paginate', 0.15, '# who is getting starred')}
<g class="ln" style="animation-delay:.25s">
<text x="${X}" y="140" class="dim" style="font-size:12px">${esc(sub)}</text>
<text x="${FR - 36}" y="140" text-anchor="end" class="dim" style="font-size:12px">${right}</text>
</g>`;
	return slice(t, 160, body, {
		title: 'Trending', desc: `Stars gained by jdx's tools in the ${days} days to ${monthDay(stars.end)}.`,
		text: `~/trending${counter}$ gh api repos/jdx/{tool}/stargazers --paginate # who is getting starred${sub}mise★·+, in30d`,
	});
}

export async function trendingRow(t: Theme, r: Trend, i: number, max: number): Promise<string> {
	const c = r.color;
	const delay = 0.2 + i * 0.09;
	const nameW = r.p.name.length * 9;
	let chip = '';
	if (r.isNew || r.ratio) {
		const label = r.isNew ? 'NEW' : `▲${r.ratio!.toFixed(1)}x`;
		const cc = r.isNew ? t.accent2 : t.ok;
		const cx = X + nameW + 10;
		chip = `<rect class="chip" x="${f1(cx)}" y="7" width="${f1(label.length * 6.6 + 10)}" height="15" fill="none" stroke="${cc}" stroke-opacity=".85"/>
<text class="chip" x="${f1(cx + 5)}" y="18" fill="${cc}" letter-spacing=".5" style="font-size:10px">${esc(label)}</text>`;
	}
	const [bx, bw] = [270, 330];
	const w = Math.max(2, (r.gain / max) * bw);
	const hx = 660;
	const hmax = Math.max(1, ...r.daily);
	const hist = r.daily.map((n, k) => {
		const h = n ? Math.max(1.5, (n / hmax) * 24) : 0;
		return h ? `<rect x="${hx + k * 3}" y="${f1(32 - h)}" width="2" height="${f1(h)}"/>` : '';
	}).join('');
	const pitch = r.p.tagline || r.p.kind;
	const body = `<g class="ln" style="animation-delay:${delay.toFixed(2)}s">
<rect x="${X - 10}" y="2" width="${FR - 36 - X + 20}" height="36" fill="${t.accent}" fill-opacity="${i % 2 === 0 ? '.04' : '0'}"/>
<text x="${X}" y="19" font-weight="700" fill="${c}" style="font-size:15px">${esc(r.p.name)}</text>
${chip}
<text x="${X}" y="33" class="dim" style="font-size:10.5px">${esc(pitch)}</text>
<rect x="${bx}" y="14" width="${bw}" height="12" fill="${t.well}"/>
<g class="bar" style="animation-delay:${(delay + 0.15).toFixed(2)}s">
<rect x="${bx}" y="14" width="${f1(w)}" height="12" fill="${c}" filter="url(#g)" opacity=".55"/>
<rect x="${bx}" y="14" width="${f1(w)}" height="12" fill="url(#bar)"/>
</g>
<text class="lbl" x="${f1(bx + w + 8)}" y="25" font-weight="700" fill="${c}" style="font-size:13px;animation-delay:${(delay + 0.6).toFixed(2)}s">+${num(r.gain)}</text>
<g fill="${c}" opacity=".75">${hist}</g>
<text x="${FR - 36}" y="25" text-anchor="end" class="dim" style="font-size:12px">${num(r.total)}★</text>
</g>`;
	const css = `.bar{transform-box:fill-box;transform-origin:0 50%;animation:grow .9s cubic-bezier(.2,.8,.2,1) both}
@keyframes grow{from{transform:scaleX(0)}}
.lbl{animation:fadein .3s ease-out both}
.chip{animation:pulse 1s ease-in-out 3}`;
	const defs = `<linearGradient id="bar" x1="0" x2="1"><stop offset="0" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}"/></linearGradient>`;
	const chipText = r.isNew ? ' (new)' : r.ratio ? ` (${r.ratio.toFixed(1)}x the previous window)` : '';
	return slice(t, 40, body, {
		title: r.p.name, css, defs,
		desc: `${r.p.name}${chipText}: +${r.gain} stars, ${r.total} total. ${pitch}.`,
		text: `${r.p.name}NEW▲.x${pitch}+★${r.gain}${r.total}`,
	});
}

export async function trendingLegend(t: Theme): Promise<string> {
	const text = 'bar: stars gained · ticks: stars per day · NEW: under 60 days old · ▲: faster than the window before';
	const body = `<g class="ln" style="animation-delay:.8s"><text x="${X}" y="24" class="fainter" style="font-size:11px">${esc(text)}</text></g>`;
	return slice(t, 40, body, {title: 'Legend', desc: text, text});
}

// ──────────────────────────── ~/beyond-mise ───────────────────────────
const ORIGIN = '2025-01-01';
const BAND_MIN = 300;

function niceStep(raw: number): number {
	const p = 10 ** Math.floor(Math.log10(raw));
	return [1, 1.5, 2, 2.5, 3, 4, 5, 10].map(m => m * p).find(s => s >= raw)!;
}

export async function beyondMise(t: Theme, stars: Stars, projects: Project[], counter: string): Promise<string> {
	const D = stars.end;
	const names = new Map(projects.map(p => [p.repo, p.name]));
	const repos = Object.entries(stars.repos).filter(([r]) => names.has(r));
	const cum = (s: RepoStars, d: string) => sum(s.daily, '0000', d);
	const dates: string[] = [];
	for (let d = D; d >= ORIGIN; d = shift(d, -7)) dates.unshift(d);
	if (dates[0] !== ORIGIN) dates.unshift(ORIGIN);

	const own = repos.filter(([, s]) => cum(s, D) >= BAND_MIN).sort((a, b) => a[1].created_at.localeCompare(b[1].created_at));
	const rest = repos.filter(([, s]) => cum(s, D) < BAND_MIN);
	type Band = {label: string; color: string; values: number[]; total: number; young: boolean};
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

	const areas: string[] = [];
	const lower = dates.map(() => 0);
	bands.forEach((b, bi) => {
		const top = b.values.map((v, i) => lower[i] + v);
		const up = dates.map((d, i) => `${f1(xOf(d))},${f1(yOf(top[i]))}`);
		const down = dates.map((d, i) => `${f1(xOf(d))},${f1(yOf(lower[i]))}`).reverse();
		const delay = (0.3 + bi * 0.12).toFixed(2);
		areas.push(`<g class="band" style="animation-delay:${delay}s"><path d="M${up.join('L')}L${down.join('L')}Z" fill="${b.color}" fill-opacity=".22"/>
<path d="M${up.join('L')}" fill="none" stroke="${b.color}" stroke-width="3" opacity=".45" filter="url(#g)"/>
<path d="M${up.join('L')}" fill="none" stroke="${b.color}" stroke-width="1.5"/></g>`);
		top.forEach((v, i) => (lower[i] = v));
	});

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
	const pulses = bands.filter(b => b.young).map(b => {
		const y = yOf(totals.at(-1)! - bands.slice(bands.indexOf(b) + 1).reduce((a, x) => a + x.total, 0));
		return `<circle class="pulse" cx="${px1}" cy="${f1(y)}" r="3" fill="${b.color}"/>`;
	}).join('');
	const ya = f1(xOf(yearAgo));
	const callout = `<line x1="${ya}" y1="${py0}" x2="${ya}" y2="${py1}" stroke="${t.dim}" stroke-opacity=".5" stroke-dasharray="3 3"/>
<text x="${f1(Number(ya) + 6)}" y="${py0 + 10}" class="dim" style="font-size:10px">~${short(yearAgoTotal)} a year ago</text>`;
	const others = bands.length - (rest.length ? 1 : 0) + rest.length;
	const head = `<tspan class="cy" font-weight="700">${short(grand)}★</tspan> across ${others} tools beyond mise`;
	const body = `${heading(t, 44, 'beyond-mise', counter)}
${prompt('gh api repos/{owner}/{repo}/stargazers --paginate', 0.15, '# every tool except mise')}
<g class="ln" style="animation-delay:.2s"><text x="${X}" y="136" class="dim" style="font-size:12px">cumulative stars since Jan 2025, stacked by launch</text>
<text x="${FR - 36}" y="136" text-anchor="end" class="dim" style="font-size:12px">${head}</text></g>
${grid.join('')}
<line x1="${px0}" y1="${py1}" x2="${px1}" y2="${py1}" stroke="${t.accent}" stroke-opacity=".4"/>
${ticks.join('')}
${areas.join('\n')}
${callout}
<g class="ln" style="animation-delay:1.1s">${labels}</g>
${launches}
${pulses}`;
	const css = `.band{animation:fadein .5s ease-out both}
.pulse{animation:pulse 1s ease-in-out 3 1.4s}`;
	const desc = `Stacked area chart of cumulative GitHub stars since January 2025 for jdx's tools other than mise: ${short(grand)} stars in total, about ${short(yearAgoTotal)} a year earlier, mostly from new launches. ` +
		bands.slice().reverse().map(b => `${b.label} ${b.total}`).join(', ') + '.';
	return slice(t, 440, body, {
		title: 'Beyond mise', desc, css,
		text: `~/beyond-mise${counter}$ gh api repos/{owner}/{repo}/stargazers --paginate # every tool except mise cumulative stars since Jan 2025, stacked by launch★ across tools beyond mise~a year agoJanAprJulOct'0123456789k.+more`,
	});
}

// ───────────────────────────── ~/installs ─────────────────────────────
export async function installs(t: Theme, data: Installs, stars: Stars | null, projects: Project[], counter: string): Promise<string | null> {
	const byRepo = new Map(projects.map(p => [p.repo, p]));
	const created = (repo: string) => stars?.repos[repo]?.created_at;
	const all = Object.entries(data.tools);
	const cards = all.filter(([, v]) => v.this_month >= 1000 && byRepo.has(v.repo))
		.sort((a, b) => b[1].this_month - a[1].this_month).slice(0, 6)
		.map(([tool, v]) => {
			const c = created(v.repo);
			const isNew = v.last_month < 1000 || (c ? age(c, data.end) < NEW_DAYS : false);
			return {tool, v, p: byRepo.get(v.repo)!, isNew};
		})
		.sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.v.mom - a.v.mom);
	if (cards.length < 3) return null;
	const combined = (all.reduce((a, [, v]) => a + v.this_month, 0) / all.reduce((a, [, v]) => a + v.last_month, 0) - 1) * 100;
	const baseline = data.baseline_mom;
	const hottest = cards.find(c => !c.isNew && c.v.mom > (baseline ?? 0));

	const [cw, ch, gap, y0] = [(FR - 36 - X - 32) / 3, 136, 16, 152];
	const parts = cards.map((c, i) => {
		const x = X + (i % 3) * (cw + gap);
		const y = y0 + Math.floor(i / 3) * (ch + gap);
		const color = toolColor(t, c.v.repo);
		let chip: string;
		let cc: string;
		if (c.isNew) {
			chip = 'NEW';
			cc = t.accent2;
		} else {
			chip = `${c.v.mom >= 0 ? '+' : ''}${Math.round(c.v.mom)}%`;
			cc = c.v.mom < 0 ? t.faint : baseline !== null && c.v.mom > baseline + 2 ? t.ok : t.accent;
		}
		const chipW = chip.length * 6.6 + 10;
		const hot = c === hottest;
		// Sparkline: 30 daily values, faint area plus a 7-day trailing mean.
		const vals = c.v.daily.map(([, n]) => n);
		const [sx, sy, sw, sh] = [x + 14, y + 88, cw - 28, 36];
		const smax = Math.max(1, ...vals);
		const sxOf = (k: number) => sx + (k / (vals.length - 1)) * sw;
		const syOf = (n: number) => sy + sh - (n / smax) * sh;
		const mean = vals.map((_, k) => {
			const win = vals.slice(Math.max(0, k - 6), k + 1);
			return win.reduce((a, b) => a + b, 0) / win.length;
		});
		const weekends = c.v.daily.map(([d], k) => ([0, 6].includes(new Date(parse(d)).getUTCDay())
			? `<rect x="${f1(sxOf(k) - sw / 58)}" y="${sy}" width="${f1(sw / 29)}" height="${sh}" fill="${t.accent}" fill-opacity=".05"/>` : '')).join('');
		const area = `M${f1(sx)},${sy + sh}` + vals.map((n, k) => `L${f1(sxOf(k))},${f1(syOf(n))}`).join('') + `L${f1(sx + sw)},${sy + sh}Z`;
		const line = mean.map((n, k) => `${k ? 'L' : 'M'}${f1(sxOf(k))},${f1(syOf(n))}`).join('');
		const lastY = syOf(mean.at(-1)!);
		const value = short(c.v.this_month);
		return `<g class="ln" style="animation-delay:${(0.3 + i * 0.07).toFixed(2)}s">
<rect x="${f1(x)}" y="${y}" width="${f1(cw)}" height="${ch}" fill="${t.accent}" fill-opacity="${hot ? '.07' : '.035'}" stroke="${hot ? color : t.accent}" stroke-opacity="${hot ? '.9' : '.35'}"/>
<path d="M${f1(x)} ${y + 12}V${y}H${f1(x + 12)}" fill="none" stroke="${hot ? color : t.accent}" stroke-width="2"/>
<text x="${f1(x + 14)}" y="${y + 26}" font-weight="700" fill="${color}" style="font-size:17px">${esc(c.p.name)}</text>
<rect x="${f1(x + cw - 14 - chipW)}" y="${y + 13}" width="${f1(chipW)}" height="16" fill="none" stroke="${cc}" stroke-opacity=".85"/>
<text x="${f1(x + cw - 14 - chipW + 5)}" y="${y + 25}" fill="${cc}" style="font-size:10.5px">${esc(chip)}</text>
${hot ? `<text x="${f1(x + cw - 14 - chipW - 6)}" y="${y + 25}" text-anchor="end" fill="${color}" letter-spacing="1" style="font-size:9.5px">HOTTEST</text>` : ''}
<text x="${f1(x + 14)}" y="${y + 60}" font-weight="700" fill="${t.accent}" filter="url(#g)" opacity=".5" style="font-size:26px">${value}</text>
<text x="${f1(x + 14)}" y="${y + 60}" font-weight="700" fill="${t.accent}" style="font-size:26px">${value}</text>
<text x="${f1(x + 14 + value.length * 15.6 + 8)}" y="${y + 60}" class="dim" style="font-size:10.5px">installs / 30d</text>
<text x="${f1(x + 14)}" y="${y + 78}" class="fainter" style="font-size:11px">#${c.v.rank} of ${num(data.tools_ranked)} tools</text>
${weekends}
<path d="${area}" fill="${color}" fill-opacity=".18"/>
<path class="spark" d="${line}" fill="none" stroke="${color}" stroke-width="3" opacity=".45" filter="url(#g)" pathLength="1"/>
<path class="spark" d="${line}" fill="none" stroke="${color}" stroke-width="1.8" pathLength="1"/>
<circle class="pulse" cx="${f1(sx + sw)}" cy="${f1(lastY)}" r="2.5" fill="${color}"/>
</g>`;
	});
	const sub = `installs through mise · 30 days to ${monthDay(data.end)} · CI excluded`;
	const right = `jdx tools <tspan class="gr">${combined >= 0 ? '+' : ''}${Math.round(combined)}%</tspan>` + (baseline !== null ? ` · all of mise ${baseline >= 0 ? '+' : ''}${Math.round(baseline)}%` : '') + ' MoM';
	const foot = "counted once per IP, tool, version and day, so these are installs, not unique users. aube also ships inside mise's npm backend and through npm and Homebrew, which isn't counted here.";
	const footLines = wrap(foot, Math.floor((FR - 36 - X) / 6));
	const body = `${heading(t, 44, 'installs', counter)}
${prompt('curl -s mise-versions.jdx.dev/api/downloads/hk/growth', 0.15)}
<g class="ln" style="animation-delay:.2s"><text x="${X}" y="136" class="dim" style="font-size:12px">${esc(sub)}</text>
<text x="${FR - 36}" y="136" text-anchor="end" class="dim" style="font-size:12px">${right}</text></g>
${parts.join('\n')}
<g class="ln" style="animation-delay:1s">${footLines.map((l, i) => `<text x="${X}" y="${458 + i * 13}" class="fainter" style="font-size:10px">${esc(l)}</text>`).join('')}</g>`;
	const css = `.spark{stroke-dasharray:1;stroke-dashoffset:0;animation:draw 1.2s ease-out both .5s}
@keyframes draw{from{stroke-dashoffset:1}}
.pulse{animation:pulse 1s ease-in-out 3 1.6s}`;
	const desc = `Installs of jdx's tools through mise in the 30 days to ${monthDay(data.end)}, CI excluded: ` +
		cards.map(c => `${c.p.name} ${num(c.v.this_month)}${c.isNew ? ' (new)' : ` (${Math.round(c.v.mom)}% month over month)`}`).join(', ') +
		`. jdx tools combined ${Math.round(combined)}% month over month` + (baseline !== null ? `, all of mise ${Math.round(baseline)}%.` : '.');
	return slice(t, 480, body, {
		title: 'Installs', desc, css,
		text: `~/installs${counter}$ curl -s mise-versions.jdx.dev/api/downloads/hk/growth${sub}jdx tools all of mise MoM+-%NEWHOTTEST installs / 30d#oftools${foot}0123456789k.M`,
	});
}
