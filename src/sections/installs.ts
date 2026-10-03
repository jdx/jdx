// ~/installs: installs of jdx tools through mise.
import {DESKTOP, FL, FR, HW, M, PHONE, type Geo, type Theme, W, X, esc, f1, halfSlice, halfSliceG, heading, headingG, num, placeholder, prompt, promptG, segment, segmentG, slice, sliceG, stagger, up40, wrap} from '../console.ts';
import {CREDIT_POST, CREDIT_URL, DAY, NEW_DAYS, age, iso, monthDay, parse, shift, short, sum, toolColor} from '../shared.ts';
import {type Calendar, type Installs, type Post, type Project, type RepoStars, type Snapshot, type Stars, slugify} from '../data.ts';

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

// ─────────────────────────────── phone ────────────────────────────────
// Phone layouts, swapped in below 600px through <picture>.
export async function phoneInstalls(t: Theme, data: Installs, stars: Stars | null, projects: Project[], counter: string): Promise<string | null> {
	return placeholder(t, PHONE.W, 600, 'installs');
}
