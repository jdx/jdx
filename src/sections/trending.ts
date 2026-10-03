// ~/trending: stars gained by each tool this month.
import {DESKTOP, FL, FR, HW, M, PHONE, type Geo, type Theme, W, X, esc, f1, halfSlice, halfSliceG, heading, headingG, num, placeholder, prompt, promptG, segment, segmentG, slice, sliceG, stagger, up40, wrap} from '../console.ts';
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

// ─────────────────────────────── phone ────────────────────────────────
// Phone layouts, swapped in below 600px through <picture>.
export async function phoneTrendingHead(t: Theme, stars: Stars, days: number, counter: string): Promise<string> {
	return placeholder(t, PHONE.W, 160, 'trending');
}

export async function phoneTrendingRow(t: Theme, r: Trend, i: number, max: number): Promise<string> {
	return placeholder(t, PHONE.W, 40, r.p.name);
}

export async function phoneTrendingLegend(t: Theme): Promise<string> {
	return placeholder(t, PHONE.W, 40, 'legend');
}
