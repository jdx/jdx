// ~/stats: GitHub numbers, languages, and mise users.
import {DESKTOP, FL, FR, HW, M, PHONE, type Geo, type Theme, W, X, esc, f1, halfSlice, halfSliceG, heading, headingG, num, placeholder, prompt, promptG, segment, segmentG, slice, sliceG, stagger, up40, wrap} from '../console.ts';
import {CREDIT_POST, CREDIT_URL, DAY, NEW_DAYS, age, iso, monthDay, parse, shift, short, sum, toolColor} from '../shared.ts';
import {type Calendar, type Installs, type Post, type Project, type RepoStars, type Snapshot, type Stars, slugify} from '../data.ts';

// ─────────────────────────────── stats ────────────────────────────────
export function tile(t: Theme, x: number, y: number, w: number, h: number, label: string, value: string, sub: string, delay: number): string {
	return `<g class="ln" style="animation-delay:${delay.toFixed(2)}s">
<rect x="${f1(x)}" y="${y}" width="${f1(w)}" height="${h}" fill="${t.accent}" fill-opacity=".035" stroke="${t.accent}" stroke-opacity=".35"/>
<path d="M${f1(x)} ${y + 12}V${y}H${f1(x + 12)}" fill="none" stroke="${t.accent}" stroke-width="2"/>
<text x="${f1(x + 16)}" y="${y + 22}" letter-spacing="1.5" class="dim" style="font-size:10.5px">${esc(label)}</text>
<text x="${f1(x + 16)}" y="${y + 50}" font-weight="700" fill="${t.accent}" filter="url(#g)" opacity=".55" style="font-size:30px">${esc(value)}</text>
<text x="${f1(x + 16)}" y="${y + 50}" font-weight="700" fill="${t.accent}" style="font-size:30px">${esc(value)}</text>
<text x="${f1(x + 16)}" y="${y + h - 12}" fill="${t.faint}" style="font-size:12px">${esc(sub)}</text>
</g>`;
}

export function milestone(history: Record<string, number>): string {
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

export async function stats(t: Theme, s: Snapshot, history: Record<string, number>, updated: string, counter: string): Promise<string> {
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

// ─────────────────────────────── phone ────────────────────────────────
// Phone layouts, swapped in below 600px through <picture>.
export async function phoneStats(t: Theme, s: Snapshot, history: Record<string, number>, updated: string, counter: string): Promise<string> {
	return placeholder(t, PHONE.W, 800, 'stats');
}
