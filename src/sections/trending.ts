// ~/trending: stars gained by each tool this month.
import {DESKTOP, FL, FR, HW, M, PHONE, type Geo, type Theme, W, X, esc, f1, halfSlice, halfSliceG, heading, headingG, num, prompt, promptG, segment, segmentG, slice, sliceG, stagger, up40, wrap} from '../console.ts';
import {CREDIT_POST, CREDIT_URL, DAY, NEW_DAYS, age, iso, monthDay, parse, shift, short, sum, toolColor} from '../shared.ts';
import {type Calendar, type Installs, type Post, type Project, type RepoStars, type Snapshot, type Stars, slugify} from '../data.ts';

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
			// The window before must lie entirely after the repo was created.
			const ratio = age(s.created_at, D) >= 2 * days && prior >= 20 && gain / prior >= 1.2 ? gain / prior : null;
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
	const right = m ? `<tspan class="cy" font-weight="700">mise</tspan> ${short(m.total)}★${m.gain30 === null ? '' : ` · +${num(m.gain30)} in 30d`}` : '';
	const body = `${heading(t, 44, 'trending', counter)}
${prompt('gh api repos/jdx/{tool}/stargazers --paginate', 0.15, '# what is getting starred')}
<g class="ln" style="animation-delay:.25s">
<text x="${X}" y="140" class="dim" style="font-size:12px">${esc(sub)}</text>
<text x="${FR - 36}" y="140" text-anchor="end" class="dim" style="font-size:12px">${right}</text>
</g>`;
	return slice(t, 160, body, {
		title: 'Trending', desc: `Stars gained by jdx's tools in the ${days} days to ${monthDay(stars.end)}.`,
		text: `~/trending${counter}$ gh api repos/jdx/{tool}/stargazers --paginate # what is getting starred${sub}mise★·+, in30d`,
	});
}

const ROW_CSS = `.bar{transform-box:fill-box;transform-origin:0 50%;animation:grow .9s cubic-bezier(.2,.8,.2,1) both}
@keyframes grow{from{transform:scaleX(0)}}
.lbl{animation:fadein .3s ease-out both}
.chip{animation:pulse 1s ease-in-out 3}`;

const barDefs = (c: string) => `<linearGradient id="bar" x1="0" x2="1"><stop offset="0" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}"/></linearGradient>`;

function rowDesc(r: Trend, pitch: string): string {
	const chipText = r.isNew ? ' (new)' : r.ratio ? ` (${r.ratio.toFixed(1)}x the previous window)` : '';
	return `${r.p.name}${chipText}: +${r.gain} stars, ${r.total} total. ${pitch}.`;
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
		const h = n > 0 ? Math.max(1.5, (n / hmax) * 24) : 0;
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
	return slice(t, 40, body, {
		title: r.p.name, css: ROW_CSS, defs: barDefs(c),
		desc: rowDesc(r, pitch),
		text: `${r.p.name}NEW▲.x${pitch}+★${r.gain}${r.total}`,
	});
}

export async function trendingLegend(t: Theme): Promise<string> {
	const text = 'bar: stars gained · ticks: stars per day · NEW: under 60 days old · ▲: faster than the window before';
	const body = `<g class="ln" style="animation-delay:.8s"><text x="${X}" y="24" class="fainter" style="font-size:11px">${esc(text)}</text></g>`;
	return slice(t, 40, body, {title: 'Legend', desc: text, text});
}

// ─────────────────────────────── phone ────────────────────────────────
// Phone layouts, swapped in below 600px through <picture>. A row is two
// lines: the name, chip and bar over the tagline and the per-day ticks. The
// total is left to the alt text; the ticks say more about a trend.
const P = PHONE;
const PBX = 180; // bar track start, shared by every row so the bars compare
const PHX = P.R - 60; // per-day ticks: 30 at a 2px pitch, ending at R
const CH11 = 6.6; // JetBrains Mono advance at 11px
const CH13 = 7.8; // and at 13px

export async function phoneTrendingHead(t: Theme, stars: Stars, days: number, counter: string): Promise<string> {
	const sub = `★ gained · ${days} days to ${monthDay(stars.end)} (UTC)`;
	const m = stars.mise;
	const mise = m ? `<tspan class="cy" font-weight="700">mise</tspan> ${short(m.total)}★${m.gain30 === null ? '' : ` · +${num(m.gain30)} in 30d`}` : '';
	const body = `${headingG(t, P, 44, 'trending', counter)}
${promptG(P, 'gh api repos/jdx/{tool}/stargazers', 0.15, '# starred', 92, 13)}
<g class="ln" style="animation-delay:.25s">
<text x="${P.X}" y="${mise ? 124 : 132}" class="dim" style="font-size:12px">${esc(sub)}</text>
${mise ? `<text x="${P.X}" y="144" class="dim" style="font-size:12px">${mise}</text>` : ''}
</g>`;
	return sliceG(t, P, 160, body, {
		title: 'Trending', desc: `Stars gained by jdx's tools in the ${days} days to ${monthDay(stars.end)}.`,
		text: `~/trending${counter}$ gh api repos/jdx/{tool}/stargazers # starred${sub}mise★·+, in30d`,
	});
}

// Cut at a word so the text fits `chars` columns.
function fit(s: string, chars: number): string {
	if (s.length <= chars) return s;
	const cut = s.slice(0, chars - 1).replace(/\s+\S*$/, '');
	return `${cut}…`;
}

export async function phoneTrendingRow(t: Theme, r: Trend, i: number, max: number): Promise<string> {
	const c = r.color;
	const delay = 0.2 + i * 0.09;
	const label = r.isNew ? 'NEW' : r.ratio ? `▲${r.ratio.toFixed(1)}x` : '';
	const chipW = label ? label.length * (CH11 + 0.5) + 9.5 : 0;
	// A long name shrinks rather than run into the bars.
	const room = PBX - 10 - P.X - (label ? chipW + 8 : 0);
	const size = Math.min(15, Math.floor((room / (r.p.name.length * 0.6)) * 2) / 2);
	let chip = '';
	if (label) {
		const cc = r.isNew ? t.accent2 : t.ok;
		const cx = P.X + r.p.name.length * size * 0.6 + 8;
		chip = `<rect class="chip" x="${f1(cx)}" y="5" width="${f1(chipW)}" height="15" fill="none" stroke="${cc}" stroke-opacity=".85"/>
<text class="chip" x="${f1(cx + 5)}" y="16.5" fill="${cc}" letter-spacing=".5" style="font-size:11px">${esc(label)}</text>`;
	}
	// The widest label is the top row's, so the track leaves room for it.
	const bw = Math.min(170, P.R - PBX - 6 - `+${num(max)}`.length * CH13);
	const w = Math.max(2, (r.gain / max) * bw);
	const hmax = Math.max(1, ...r.daily);
	const hist = r.daily.map((n, k) => {
		const h = n > 0 ? Math.max(1.5, (n / hmax) * 11) : 0;
		return h ? `<rect x="${PHX + k * 2}" y="${f1(33 - h)}" width="1.5" height="${f1(h)}"/>` : '';
	}).join('');
	const pitch = r.p.tagline || r.p.kind;
	const tag = fit(pitch, Math.floor((PHX - 10 - P.X) / CH11));
	const body = `<g class="ln" style="animation-delay:${delay.toFixed(2)}s">
<rect x="${P.X - 10}" y="2" width="${P.R - P.X + 20}" height="36" fill="${t.accent}" fill-opacity="${i % 2 === 0 ? '.04' : '0'}"/>
<text x="${P.X}" y="18" font-weight="700" fill="${c}" style="font-size:${size}px">${esc(r.p.name)}</text>
${chip}
<text x="${P.X}" y="32" class="dim" style="font-size:11px">${esc(tag)}</text>
<rect x="${PBX}" y="7" width="${f1(bw)}" height="11" fill="${t.well}"/>
<g class="bar" style="animation-delay:${(delay + 0.15).toFixed(2)}s">
<rect x="${PBX}" y="7" width="${f1(w)}" height="11" fill="${c}" filter="url(#g)" opacity=".55"/>
<rect x="${PBX}" y="7" width="${f1(w)}" height="11" fill="url(#bar)"/>
</g>
<text class="lbl" x="${f1(PBX + w + 6)}" y="17.5" font-weight="700" fill="${c}" style="font-size:13px;animation-delay:${(delay + 0.6).toFixed(2)}s">+${num(r.gain)}</text>
<g fill="${c}" opacity=".75">${hist}</g>
</g>`;
	return sliceG(t, P, 40, body, {
		title: r.p.name, css: ROW_CSS, defs: barDefs(c),
		desc: rowDesc(r, pitch),
		text: `${r.p.name}NEW▲.x${tag}+${r.gain}`,
	});
}

export async function phoneTrendingLegend(t: Theme): Promise<string> {
	const text = 'bar: stars gained · ticks: stars per day · NEW: under 60 days old · ▲: faster than the window before';
	// Two lines at phone width, broken between entries.
	const cols = Math.floor((P.R - P.X) / CH11);
	const lines: string[] = [];
	for (const part of text.split(' · ')) {
		const last = lines.at(-1);
		if (last && last.length + 3 + part.length <= cols) lines[lines.length - 1] = `${last} · ${part}`;
		else lines.push(part);
	}
	const h = up40(lines.length * 15 + 10);
	const y0 = (h - lines.length * 15) / 2 + 11;
	const body = `<g class="ln" style="animation-delay:.8s">${lines.map((l, k) => `<text x="${P.X}" y="${y0 + k * 15}" class="fainter" style="font-size:11px">${esc(l)}</text>`).join('')}</g>`;
	return sliceG(t, P, h, body, {title: 'Legend', desc: text, text});
}
