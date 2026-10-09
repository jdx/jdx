// ~/mise-stars: mise's cumulative stars since launch, the day each milestone
// was passed, and a projection to the next one. Modelled on the milestone
// summaries on mise-versions.jdx.dev/stats.
import {type Geo, type Theme, DESKTOP, PHONE, f1, headingG, promptG, sliceG, up40} from '../console.ts';
import {type Stars} from '../data.ts';
import {DAY, monthDay, parse, shift, short} from '../shared.ts';
import {niceStep} from './beyond.ts';

type Point = [string, number];

// 1k, 2.5k, 5k, then every 5k to 50k and every 10k after.
const MILESTONES = [1000, 2500, 5000, ...Array.from({length: 9}, (_, i) => 10000 + i * 5000), ...Array.from({length: 5}, (_, i) => 60000 + i * 10000)];
// Passed milestones below this are not worth a dot on the chart.
const DOT_MIN = 5000;

const label = (n: number) => short(n).toUpperCase();
const year = (d: string) => d.slice(0, 4);
const date = (d: string) => `${monthDay(d)}, ${year(d)}`;

function model(stars: Stars) {
	const history = stars.mise?.history;
	if (!history || history.length < 2) return null;
	const [first] = history;
	const [D, cur] = history.at(-1)!;
	const at = (d: string) => history.findLast(([x]) => x <= d)?.[1] ?? first[1];
	const rate = (n: number) => (cur - at(shift(D, -n))) / n;
	// The average of the 7-, 30- and 365-day rates, like the stats page.
	const perDay = (rate(7) + rate(30) + rate(365)) / 3;
	const passed = MILESTONES.filter(m => m <= cur).map(m => ({m, day: history.find(([, n]) => n >= m)![0]}));
	const next = MILESTONES.find(m => m > cur);
	if (!next || perDay <= 0) return null;
	const eta = shift(D, Math.ceil((next - cur) / perDay));
	// Weekly points are plenty for the line; the last is always today.
	const points: Point[] = [];
	for (const p of history) if (!points.length || parse(p[0]) - parse(points.at(-1)![0]) >= 7 * DAY) points.push(p);
	if (points.at(-1)![0] !== D) points.push(history.at(-1)!);
	return {start: first[0], D, cur, points, passed, next, eta, perDay, last: passed.at(-1)};
}

type Model = NonNullable<ReturnType<typeof model>>;

function describe(m: Model): string {
	const done = m.last ? ` Passed ${label(m.last.m)} on ${date(m.last.day)}.` : '';
	return `Line chart of mise's GitHub stars since ${date(m.start)}: ${m.cur.toLocaleString('en-US')} stars.${done} On pace for ${label(m.next)} around ${date(m.eta)}.`;
}

function plot(t: Theme, g: Geo, m: Model, py0: number, py1: number): string {
	const px0 = g.X;
	const px1 = g.R - (g.narrow ? 4 : 24);
	const step = niceStep(m.next / 5);
	const ymax = Math.ceil(m.next / step) * step;
	const t1 = parse(m.eta) + 7 * DAY;
	const span = t1 - parse(m.start);
	const xOf = (d: string) => px0 + ((parse(d) - parse(m.start)) / span) * (px1 - px0);
	const yOf = (v: number) => py1 - (v / ymax) * (py1 - py0);
	const fs = g.narrow ? 11 : 10;

	const grid: string[] = [];
	for (let v = step; v <= ymax; v += step) {
		grid.push(`<line x1="${px0}" y1="${f1(yOf(v))}" x2="${px1}" y2="${f1(yOf(v))}" stroke="${t.accent}" stroke-opacity=".12" stroke-dasharray="2 4"/>`);
		grid.push(g.narrow
			? `<text x="${px0 + 2}" y="${f1(yOf(v) - 4)}" fill="${t.faint}" style="font-size:${fs}px">${short(v)}</text>`
			: `<text x="${px0 - 6}" y="${f1(yOf(v) + 4)}" text-anchor="end" class="fainter" style="font-size:${fs}px">${short(v)}</text>`);
	}
	const ticks: string[] = [];
	for (let y = Number(year(m.start)); y <= Number(year(m.eta)); y++) {
		for (const [mo, text] of [[1, `Jan '${String(y).slice(2)}`], [7, 'Jul']] as const) {
			const d = `${y}-${String(mo).padStart(2, '0')}-01`;
			if (d <= m.start || d > m.eta) continue;
			const x = f1(xOf(d));
			// Phones label January only; the year label would collide with July.
			const show = !g.narrow || mo === 1;
			ticks.push(`<line x1="${x}" y1="${py1}" x2="${x}" y2="${py1 + (show ? 4 : 3)}" stroke="${t.accent}" stroke-opacity=".4"/>`);
			if (show) ticks.push(`<text x="${x}" y="${py1 + 16}" text-anchor="middle" class="fainter" style="font-size:${fs}px">${text}</text>`);
		}
	}

	const line = m.points.map(([d, n]) => `${f1(xOf(d))},${f1(yOf(n))}`);
	const [x1, y1] = [f1(xOf(m.D)), f1(yOf(m.cur))];
	const [xe, ye] = [f1(xOf(m.eta)), f1(yOf(m.next))];
	const area = `M${line.join('L')}L${x1},${py1}L${f1(xOf(m.start))},${py1}Z`;
	const dots = m.passed.filter(p => p.m >= DOT_MIN).map(p => {
		const [x, y] = [xOf(p.day), yOf(p.m)];
		return `<circle cx="${f1(x)}" cy="${f1(y)}" r="3.5" fill="${t.bg}" stroke="${t.accent2}" stroke-width="1.5"/>
<text x="${f1(x + 7)}" y="${f1(y + 14)}" fill="${t.accent2}" style="font-size:${fs + 1}px">${label(p.m)}</text>`;
	}).join('\n');
	return `${grid.join('')}
<line x1="${px0}" y1="${py1}" x2="${px1}" y2="${py1}" stroke="${t.accent}" stroke-opacity=".4"/>
${ticks.join('')}
<line x1="${px0}" y1="${f1(yOf(m.next))}" x2="${px1}" y2="${f1(yOf(m.next))}" stroke="${t.ok}" stroke-opacity=".35" stroke-dasharray="3 3"/>
<g class="band"><path d="${area}" fill="${t.accent}" fill-opacity=".14"/>
<path d="M${line.join('L')}" fill="none" stroke="${t.accent}" stroke-width="4" opacity=".45" filter="url(#g)"/>
<path d="M${line.join('L')}" fill="none" stroke="${t.accent}" stroke-width="1.8"/></g>
<g class="ln" style="animation-delay:.9s"><line x1="${x1}" y1="${y1}" x2="${xe}" y2="${ye}" stroke="${t.ok}" stroke-width="1.8" stroke-dasharray="5 4"/>
<circle cx="${xe}" cy="${ye}" r="4" fill="none" stroke="${t.ok}" stroke-width="1.5"/>
<text x="${Number(xe) + 2}" y="${Number(ye) - 9}" text-anchor="end" class="gr" style="font-size:${fs + 1}px">${label(m.next)}</text></g>
${dots}
<circle class="pulse" cx="${x1}" cy="${y1}" r="3.5" fill="${t.accent}"/>`;
}

function summary(t: Theme, g: Geo, m: Model, y: number): string {
	const days = Math.round((parse(m.eta) - parse(m.D)) / DAY);
	const passed = m.last
		? `<tspan class="dim">Passed </tspan><tspan fill="${t.accent2}" font-weight="700">${label(m.last.m)}</tspan><tspan class="dim"> · ${date(m.last.day)}</tspan>`
		: '';
	const pace = `<tspan class="dim">On pace for </tspan><tspan class="gr" font-weight="700">${label(m.next)}</tspan><tspan class="dim"> · ${date(m.eta)} · in ${days} day${days === 1 ? '' : 's'}</tspan>`;
	const sub = 'cumulative stars since launch';
	if (g.narrow) {
		return `<g class="ln" style="animation-delay:.2s"><text x="${g.X}" y="${y}" font-weight="700" fill="${t.accent}" filter="url(#g)" opacity=".6" style="font-size:22px">${short(m.cur)}★</text>
<text x="${g.X}" y="${y}"><tspan class="cy" font-weight="700" style="font-size:22px">${short(m.cur)}★</tspan><tspan class="fg" style="font-size:13px"> mise on GitHub</tspan></text>
<text x="${g.X}" y="${y + 22}" class="dim" style="font-size:12px">${sub}</text>
<text x="${g.X}" y="${y + 46}" style="font-size:12px">${passed}</text>
<text x="${g.X}" y="${y + 66}" style="font-size:12px">${pace}</text></g>`;
	}
	return `<g class="ln" style="animation-delay:.2s"><text x="${g.X}" y="${y}" class="dim" style="font-size:12px"><tspan class="cy" font-weight="700" style="font-size:15px">${short(m.cur)}★</tspan> ${sub}</text>
<text x="${g.R - 36}" y="${y}" text-anchor="end" style="font-size:12px">${passed}</text>
<text x="${g.R - 36}" y="${y + 20}" text-anchor="end" style="font-size:12px">${pace}</text></g>`;
}

async function render(t: Theme, g: Geo, stars: Stars, counter: string): Promise<string | null> {
	const m = model(stars);
	if (!m) return null;
	const css = `.band{animation:fadein .5s ease-out .3s both}
.pulse{animation:pulse 1s ease-in-out 3 1.4s}`;
	const cmd = 'gh api repos/jdx/mise --jq .stargazers_count';
	if (g.narrow) {
		const py1 = 400;
		const body = `${headingG(t, g, 44, 'mise-stars', counter)}
${promptG(g, cmd, 0.15, '', 92, 12)}
${summary(t, g, m, 132)}
${plot(t, g, m, 232, py1)}`;
		return sliceG(t, g, up40(py1 + 36), body, {title: 'mise stars', desc: describe(m), css, text: "~/mise-stars$ ★·0123456789k.'"});
	}
	const body = `${headingG(t, g, 44, 'mise-stars', counter)}
${promptG(g, cmd, 0.15)}
${summary(t, g, m, 136)}
${plot(t, g, m, 190, 380)}`;
	return sliceG(t, g, 440, body, {title: 'mise stars', desc: describe(m), css, text: "~/mise-stars$ ★·0123456789k.'"});
}

export const miseStars = (t: Theme, stars: Stars, counter: string) => render(t, DESKTOP, stars, counter);
export const phoneMiseStars = (t: Theme, stars: Stars, counter: string) => render(t, PHONE, stars, counter);
export function miseStarsAlt(stars: Stars): string {
	const m = model(stars);
	return m ? describe(m) : 'mise stars';
}
