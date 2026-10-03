// ~/installs: installs of jdx tools through mise.
import {DESKTOP, FL, FR, HW, M, PHONE, type Geo, type Theme, W, X, esc, f1, halfSlice, halfSliceG, heading, headingG, num, placeholder, prompt, promptG, segment, segmentG, slice, sliceG, stagger, up40, wrap} from '../console.ts';
import {CREDIT_POST, CREDIT_URL, DAY, NEW_DAYS, age, iso, monthDay, parse, shift, short, sum, toolColor} from '../shared.ts';
import {type Calendar, type Installs, type Post, type Project, type RepoStars, type Snapshot, type Stars, type ToolInstalls, slugify} from '../data.ts';

// ───────────────────────────── ~/installs ─────────────────────────────
// isNew: launched in the last 60 days. lowBase: older, but under 1,000 installs the
// month before, so a percentage would mostly measure the small base.
type Card = {tool: string; v: ToolInstalls; p: Project; isNew: boolean; lowBase: boolean};
type Picked = {cards: Card[]; combined: number | null; baseline: number | null; hottest: Card | undefined};

// The tools both layouts show (up to six, NEW first, then by month-over-month
// growth), or null, meaning no section, when fewer than three qualify.
function pick(data: Installs, stars: Stars | null, projects: Project[]): Picked | null {
	const byRepo = new Map(projects.map(p => [p.repo, p]));
	const created = (repo: string) => stars?.repos[repo]?.created_at;
	const all = Object.entries(data.tools);
	const cards = all.filter(([, v]) => v.this_month >= 1000 && byRepo.has(v.repo))
		.sort((a, b) => b[1].this_month - a[1].this_month).slice(0, 6)
		.map(([tool, v]) => {
			const c = created(v.repo);
			const isNew = c ? age(c, data.end) < NEW_DAYS : v.last_month < 1000;
			return {tool, v, p: byRepo.get(v.repo)!, isNew, lowBase: !isNew && v.last_month < 1000};
		})
		.sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.v.mom - a.v.mom);
	if (cards.length < 3) return null;
	const lastSum = all.reduce((a, [, v]) => a + v.last_month, 0);
	const combined = lastSum >= 1000 ? (all.reduce((a, [, v]) => a + v.this_month, 0) / lastSum - 1) * 100 : null;
	const baseline = data.baseline_mom;
	const hottest = cards.find(c => !c.isNew && !c.lowBase && c.v.mom > (baseline ?? 0));
	return {cards, combined, baseline, hottest};
}

// A card's NEW or month-over-month chip, as [label, color].
function chipOf(t: Theme, c: Card, baseline: number | null): [string, string] {
	if (c.isNew) return ['NEW', t.accent2];
	if (c.lowBase) return [`from ${short(c.v.last_month)}`, t.accent];
	return [`${c.v.mom >= 0 ? '+' : ''}${Math.round(c.v.mom)}%`, c.v.mom < 0 ? t.faint : baseline !== null && c.v.mom > baseline + 2 ? t.ok : t.accent];
}

// Sparkline in the box [sx, sy, sw, sh]: 30 daily values, faint area plus a
// 7-day trailing mean, weekends shaded. `lw` is the line's width, `r` the
// radius of the dot that ends it.
function spark(t: Theme, c: Card, color: string, [sx, sy, sw, sh]: number[], lw: number, r: number): string {
	const vals = c.v.daily.map(([, n]) => n);
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
	return `${weekends}
<path d="${area}" fill="${color}" fill-opacity=".18"/>
<path class="spark" d="${line}" fill="none" stroke="${color}" stroke-width="3" opacity=".45" filter="url(#g)" pathLength="1"/>
<path class="spark" d="${line}" fill="none" stroke="${color}" stroke-width="${lw}" pathLength="1"/>
<circle class="pulse" cx="${f1(sx + sw)}" cy="${f1(lastY)}" r="${r}" fill="${color}"/>`;
}

const API = 'mise-versions.jdx.dev/api/downloads/hk/growth';
const CMD = `curl -s ${API}`;
const FOOT = "counted once per IP, tool, version and day, so these are installs, not unique users. aube also ships inside mise's npm backend and through npm and Homebrew, which isn't counted here.";
const CSS = `.spark{stroke-dasharray:1;stroke-dashoffset:0;animation:draw 1.2s ease-out both .5s}
@keyframes draw{from{stroke-dashoffset:1}}
.pulse{animation:pulse 1s ease-in-out 3 1.6s}`;

// "jdx tools +24% · all of mise +18% MoM", the growth in green.
function growth({combined, baseline}: Picked): string {
	const parts = [
		...(combined !== null ? [`jdx tools <tspan class="gr">${combined >= 0 ? '+' : ''}${Math.round(combined)}%</tspan>`] : []),
		...(baseline !== null ? [`all of mise ${baseline >= 0 ? '+' : ''}${Math.round(baseline)}%`] : []),
	];
	return parts.length ? `${parts.join(' · ')} MoM` : '';
}

function describe(data: Installs, {cards, combined, baseline}: Picked): string {
	return `Installs of jdx's tools through mise in the 30 days to ${monthDay(data.end)}, CI excluded: ` +
		cards.map(c => `${c.p.name} ${num(c.v.this_month)}${c.isNew ? ' (new)' : c.lowBase ? ` (up from ${num(c.v.last_month)})` : ` (${Math.round(c.v.mom)}% month over month)`}`).join(', ') +
		(combined !== null ? `. jdx tools combined ${Math.round(combined)}% month over month` : '') + (baseline !== null ? `, all of mise ${Math.round(baseline)}%.` : '.');
}

export async function installs(t: Theme, data: Installs, stars: Stars | null, projects: Project[], counter: string): Promise<string | null> {
	const picked = pick(data, stars, projects);
	if (!picked) return null;
	const {cards, baseline, hottest} = picked;

	const [cw, ch, gap, y0] = [(FR - 36 - X - 32) / 3, 136, 16, 152];
	const parts = cards.map((c, i) => {
		const x = X + (i % 3) * (cw + gap);
		const y = y0 + Math.floor(i / 3) * (ch + gap);
		const color = toolColor(t, c.v.repo);
		const [chip, cc] = chipOf(t, c, baseline);
		const chipW = chip.length * 6.6 + 10;
		const hot = c === hottest;
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
${spark(t, c, color, [x + 14, y + 88, cw - 28, 36], 1.8, 2.5)}
</g>`;
	});
	const sub = `installs through mise · 30 days to ${monthDay(data.end)} · CI excluded`;
	const footLines = wrap(FOOT, Math.floor((FR - 36 - X) / 6));
	const body = `${heading(t, 44, 'installs', counter)}
${prompt(CMD, 0.15)}
<g class="ln" style="animation-delay:.2s"><text x="${X}" y="136" class="dim" style="font-size:12px">${esc(sub)}</text>
<text x="${FR - 36}" y="136" text-anchor="end" class="dim" style="font-size:12px">${growth(picked)}</text></g>
${parts.join('\n')}
<g class="ln" style="animation-delay:1s">${footLines.map((l, i) => `<text x="${X}" y="${458 + i * 13}" class="fainter" style="font-size:10px">${esc(l)}</text>`).join('')}</g>`;
	return slice(t, 480, body, {
		title: 'Installs', desc: describe(data, picked), css: CSS,
		text: `~/installs${counter}$ ${CMD}${sub}jdx tools all of mise MoM+-%NEWHOTTEST installs / 30d#oftools${FOOT}0123456789k.M`,
	});
}

// ─────────────────────────────── phone ────────────────────────────────
// Phone layouts, swapped in below 600px through <picture>.

// The same cards in two columns. A 186px card can't fit the number and
// "installs / 30d" on one line, so the label and the rank stack under the
// number, and HOTTEST moves from beside the chip to a tag on the card's top
// edge. The command breaks after `curl -s \`, as a shell would continue it.
export async function phoneInstalls(t: Theme, data: Installs, stars: Stars | null, projects: Project[], counter: string): Promise<string | null> {
	const picked = pick(data, stars, projects);
	if (!picked) return null;
	const {cards, baseline, hottest} = picked;
	const {X, R} = PHONE;

	const [gap, ch, y0] = [12, 146, 176];
	const cw = (R - X - gap) / 2;
	const parts = cards.map((c, i) => {
		const x = X + (i % 2) * (cw + gap);
		const y = y0 + Math.floor(i / 2) * (ch + gap);
		const color = toolColor(t, c.v.repo);
		const [chip, cc] = chipOf(t, c, baseline);
		const chipW = chip.length * 7.2 + 8;
		const hot = c === hottest;
		const value = short(c.v.this_month);
		// The name shrinks from 17px, in half-pixel steps, rather than run into the chip.
		const nameSize = Math.min(17, Math.floor(((cw - 24 - chipW - 6) / (0.6 * c.p.name.length)) * 2) / 2);
		const tagW = 7 * 7.6 + 8;
		const tag = hot
			? `<rect x="${f1(x + cw - 12 - tagW)}" y="${y - 8}" width="${f1(tagW)}" height="16" fill="${t.bg}" stroke="${color}" stroke-opacity=".9"/>
<text x="${f1(x + cw - 12 - tagW + 4.5)}" y="${y + 4}" fill="${color}" letter-spacing="1" style="font-size:11px">HOTTEST</text>
`
			: '';
		return `<g class="ln" style="animation-delay:${(0.3 + i * 0.07).toFixed(2)}s">
<rect x="${f1(x)}" y="${y}" width="${f1(cw)}" height="${ch}" fill="${t.accent}" fill-opacity="${hot ? '.07' : '.035'}" stroke="${hot ? color : t.accent}" stroke-opacity="${hot ? '.9' : '.35'}"/>
<path d="M${f1(x)} ${y + 12}V${y}H${f1(x + 12)}" fill="none" stroke="${hot ? color : t.accent}" stroke-width="2"/>
${tag}<text x="${f1(x + 12)}" y="${y + 29}" font-weight="700" fill="${color}" style="font-size:${nameSize}px">${esc(c.p.name)}</text>
<rect x="${f1(x + cw - 12 - chipW)}" y="${y + 15}" width="${f1(chipW)}" height="18" fill="none" stroke="${cc}" stroke-opacity=".85"/>
<text x="${f1(x + cw - 12 - chipW + 4)}" y="${y + 28}" fill="${cc}" style="font-size:12px">${esc(chip)}</text>
<text x="${f1(x + 12)}" y="${y + 62}" font-weight="700" fill="${t.accent}" filter="url(#g)" opacity=".5" style="font-size:26px">${value}</text>
<text x="${f1(x + 12)}" y="${y + 62}" font-weight="700" fill="${t.accent}" style="font-size:26px">${value}</text>
<text x="${f1(x + 12)}" y="${y + 80}" class="dim" style="font-size:12px">installs / 30d</text>
<text x="${f1(x + 12)}" y="${y + 96}" fill="${t.faint}" style="font-size:12px">#${c.v.rank} of ${num(data.tools_ranked)} tools</text>
${spark(t, c, color, [x + 12, y + 104, cw - 24, 30], 2, 3)}
</g>`;
	});
	const rows = Math.ceil(cards.length / 2);
	const sub = `installs through mise · 30d to ${monthDay(data.end)} · CI excluded`;
	// 58 columns of 11px JetBrains Mono (6.6px each) fill the 384px text column.
	const footLines = wrap(FOOT, 58);
	const footY = y0 + rows * ch + (rows - 1) * gap + 24;
	const body = `${headingG(t, PHONE, 44, 'installs', counter)}
${promptG(PHONE, 'curl -s \\', 0.15, '', 92, 13)}
<g class="ln" style="animation-delay:.18s"><text x="${X}" y="110" class="dim" style="font-size:13px"><tspan class="fainter">&gt;</tspan> ${esc(API)}</text></g>
<g class="ln" style="animation-delay:.2s"><text x="${X}" y="140" class="dim" style="font-size:12px">${esc(sub)}</text>
<text x="${X}" y="157" class="dim" style="font-size:12px">${growth(picked)}</text></g>
${parts.join('\n')}
<g class="ln" style="animation-delay:1s">${footLines.map((l, i) => `<text x="${X}" y="${footY + i * 14}" class="fainter" style="font-size:11px">${esc(l)}</text>`).join('')}</g>`;
	return sliceG(t, PHONE, up40(footY + (footLines.length - 1) * 14 + 14), body, {
		title: 'Installs', desc: describe(data, picked), css: CSS,
		text: `~/installs${counter}$ ${CMD}\\>${sub}jdx tools all of mise MoM+-%NEWHOTTEST installs / 30d#oftools${FOOT}0123456789k.M`,
	});
}
