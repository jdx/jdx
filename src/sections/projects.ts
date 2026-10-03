// ~/projects cards and ~/writing rows.
import {readFile} from 'node:fs/promises';
import {DESKTOP, FL, FR, HW, M, PHONE, type Geo, type Theme, W, X, baseDefs, esc, f1, halfSlice, halfSliceG, heading, headingG, num, placeholder, prompt, promptG, segment, segmentG, slice, sliceG, stagger, up40, wrap} from '../console.ts';
import {CREDIT_POST, CREDIT_URL, DAY, NEW_DAYS, age, iso, monthDay, parse, shift, short, sum, toolColor} from '../shared.ts';
import {type Calendar, type Installs, type Post, type Project, type RepoStars, type Snapshot, type Stars, slugify} from '../data.ts';

// ────────────────────────────── projects ──────────────────────────────
export const CARD_H = 200;

export async function logoHref(p: Project): Promise<string | null> {
	const slug = slugify(p.name);
	const svgLogo = await readFile(`data/logos/${slug}.svg`, 'utf8').catch(() => null);
	if (svgLogo) {
		// The console is always dark, so pin color-scheme-aware logos to their dark rules.
		const dark = svgLogo
			.replace(/@media\s*\(prefers-color-scheme:\s*dark\)/g, '@media all')
			.replace(/@media\s*\(prefers-color-scheme:\s*light\)/g, '@media not all');
		return `data:image/svg+xml;base64,${Buffer.from(dark).toString('base64')}`;
	}
	const png = await readFile(`data/logos/${slug}.png`).catch(() => null);
	return png ? `data:image/png;base64,${png.toString('base64')}` : null;
}

export async function card(t: Theme, p: Project, side: 'L' | 'R', delay: number): Promise<string> {
	const x0 = side === 'L' ? 52 : 10; // 378-wide box, 20px gutter between the two cards
	const [cw, y0, ch, pad, cut] = [378, 12, 176, 18, 16];
	const tx = x0 + pad;
	const box = `M${x0} ${y0}H${x0 + cw - cut}L${x0 + cw} ${y0 + cut}V${y0 + ch}H${x0 + cut}L${x0} ${y0 + ch - cut}Z`;
	const lines = wrap(p.description, 43).slice(0, 3);
	const tag = p.kind.toUpperCase();
	const tagc = /CLI$/.test(tag) ? t.ok : t.accent2;
	const tagW = tag.length * 7.6 + 16;
	const logo = await logoHref(p);
	const nx = logo ? tx + 28 : tx;
	const titleW = p.name.length * 10.2;
	const sx = x0 + cw - pad;
	const desc = lines.map((l, i) => `<text x="${tx}" y="${100 + i * 20}" class="fg" style="font-size:13px">${esc(l)}</text>`).join('\n');
	const star = `<path transform="translate(${f1(sx - p.stars.length * 7.2 - 20)} 158) scale(.55)" d="M10 0l2.9 6.6 7.1.6-5.4 4.7 1.6 7L10 15.2 3.8 18.9l1.6-7L0 7.2l7.1-.6z" fill="${t.star}"/>`;
	const body = `<g class="ln" style="animation-delay:${delay.toFixed(2)}s">
<path d="${box}" fill="${t.accent}" fill-opacity=".035"/>
<path d="${box}" fill="none" stroke="${t.accent}" stroke-opacity=".4"/>
<path d="M${x0 + cw - cut} ${y0}L${x0 + cw} ${y0 + cut}" stroke="${t.accent}" stroke-width="2"/>
${logo ? `<image href="${logo}" x="${tx}" y="${y0 + 18}" width="20" height="20"/>` : ''}
<text x="${nx}" y="${y0 + 34}" font-weight="700" fill="${t.accent}" filter="url(#g)" opacity=".6" style="font-size:17px">${esc(p.name)}</text>
<text x="${nx}" y="${y0 + 34}" font-weight="700" class="cy" style="font-size:17px">${esc(p.name)}</text>
<path d="M${f1(nx + titleW + 11)} ${y0 + 31}l8-8M${f1(nx + titleW + 13)} ${y0 + 23}h6v6" fill="none" stroke="${t.accent}" stroke-width="1.6"/>
<rect x="${tx}" y="${y0 + 46}" width="${f1(tagW)}" height="18" fill="none" stroke="${tagc}" stroke-opacity=".8"/>
<text x="${tx + 8}" y="${y0 + 59}" letter-spacing="1" fill="${tagc}" style="font-size:11px">${esc(tag)}</text>
${desc}
<text x="${tx}" y="${y0 + 158}" class="dim" style="font-size:12px"><tspan class="gr">$</tspan> ${esc(p.install)}</text>
${star}
<text x="${sx}" y="${y0 + 158}" text-anchor="end" class="dim" style="font-size:12px">${esc(p.stars)}</text>
</g>`;
	return halfSlice(t, CARD_H, side, body, {
		title: p.name,
		desc: `${p.name}: ${p.description} Install: ${p.install}. ${p.stars} stars.`,
		text: p.name + tag + p.description + `$ ${p.install}` + p.stars,
	});
}

// ─────────────────────────────── writing ──────────────────────────────
export async function articleRow(t: Theme, a: Post, i: number): Promise<string> {
	const maxc = 58;
	const shown = a.title.length <= maxc ? a.title : `${a.title.slice(0, maxc - 1).replace(/[ .,:;]+$/, '')}…`;
	const rx = FR - 36;
	const ax = rx - 10;
	const read = `${a.reading_time} min`;
	const body = `<g class="ln" style="animation-delay:${(0.2 + i * 0.08).toFixed(2)}s">
<rect x="${X - 10}" y="4" width="${rx - X + 20}" height="32" fill="${t.accent}" fill-opacity="${i % 2 === 0 ? '.04' : '0'}"/>
<text x="${X}" y="25" class="dim" style="font-size:13px">${a.date}</text>
<text x="${X + 94}" y="25" class="cy" style="font-size:13px">›</text>
<text x="${X + 112}" y="25" class="fg" style="font-size:14px">${esc(shown)}</text>
<text x="${ax - 18}" y="25" text-anchor="end" class="dim" style="font-size:13px">${esc(read)}</text>
<path d="M${ax - 6} 25l8-8M${ax - 4} 17h6v6" fill="none" stroke="${t.accent}" stroke-width="1.5"/>
</g>`;
	return slice(t, 40, body, {title: a.title, desc: `${a.title}. Published ${a.date}. ${read} read.`, text: a.date + '›' + shown + read});
}

export async function writingMore(t: Theme): Promise<string> {
	const label = ' read all posts on jdx.dev';
	const ax = X + (2 + label.length) * 7.8 + 12;
	const body = `<g class="ln" style="animation-delay:.7s">
<text x="${X}" y="26" style="font-size:13px"><tspan class="gr">&gt;&gt;</tspan><tspan class="cy">${esc(label)}</tspan></text>
<path d="M${f1(ax)} 26l8-8M${f1(ax + 2)} 18h6v6" fill="none" stroke="${t.accent}" stroke-width="1.5"/>
</g>`;
	return slice(t, 40, body, {title: 'All posts', desc: 'Read all posts on jdx.dev', text: `>>${label}`});
}

// ─────────────────────────────── phone ────────────────────────────────
// Phone layouts, swapped in below 600px through <picture>.

// JetBrains Mono advances 0.6em, so a column count is width / (size * 0.6).
const cols = (width: number, size: number) => Math.floor(width / (size * 0.6) + 1e-9);

// Cut `s` to at most `n` characters ending in an ellipsis, at a word break
// when one is near.
function ellipsis(s: string, n: number): string {
	let cut = s.length < n ? s : s.slice(0, n - 1);
	const sp = cut.lastIndexOf(' ');
	if (cut !== s && sp >= n * 0.6) cut = cut.slice(0, sp);
	return `${cut.replace(/[\s.,:;!?\-–—]+$/u, '')}…`;
}
const fit = (s: string, n: number) => (s.length <= n ? s : ellipsis(s, n));

// Word-wrap to `n` columns (hard-breaking words that are longer), keeping at
// most `max` lines; the last kept line ends in an ellipsis if text was dropped.
function clamp(s: string, n: number, max: number): string[] {
	const lines = wrap(s, n).flatMap(l => (l.length <= n ? [l] : l.match(new RegExp(`.{1,${n}}`, 'g'))!));
	if (lines.length <= max) return lines;
	return [...lines.slice(0, max - 1), ellipsis(lines.slice(max - 1).join(' '), n)];
}

// Two cards share a 440px row: each is a 186px box inside its half, with the
// same 12px gutter between them as between rows. Every card has the same
// height, so the pair's rails, glow and grid line up.
export async function phoneCard(t: Theme, p: Project, side: 'L' | 'R', delay: number): Promise<string> {
	const g = PHONE;
	const gut = 12;
	const cw = (g.R - g.X - gut) / 2;
	const [y0, ch, pad, cut] = [6, CARD_H - 12, 10, 12];
	const left = side === 'L' ? g.X : gut / 2; // so the right box ends at R
	const tx = left + pad;
	const sx = left + cw - pad;
	const inner = sx - tx;
	const box = `M${left} ${y0}H${left + cw - cut}L${left + cw} ${y0 + cut}V${y0 + ch}H${left + cut}L${left} ${y0 + ch - cut}Z`;

	const logo = await logoHref(p);
	const nx = logo ? tx + 25 : tx;
	const name = fit(p.name, cols(sx - nx - 20, 15));
	const nameW = name.length * 9;

	const stars = p.stars;
	const starW = stars.length * 7.2 + 16;
	const kind = p.kind.toUpperCase();
	const tagc = /CLI$/.test(kind) ? t.ok : t.accent2;
	const tag = fit(kind, Math.floor((inner - starW - 8 - 12) / 7.6));
	const tagW = tag.length * 7.6 + 12;

	const lineCols = cols(inner, 12);
	const desc = clamp(p.description, lineCols, 4);
	const cmd = clamp(p.install, lineCols - 2, 2);
	const yb = y0 + ch - 14; // last baseline
	const yc = yb - (cmd.length - 1) * 17;
	const install = cmd
		.map((l, i) => (i === 0
			? `<text x="${tx}" y="${yc}" class="dim" style="font-size:12px"><tspan class="gr">$</tspan> ${esc(l)}</text>`
			: `<text x="${f1(tx + 14.4)}" y="${yc + i * 17}" class="dim" style="font-size:12px">${esc(l)}</text>`))
		.join('\n');

	const body = `<g class="ln" style="animation-delay:${delay.toFixed(2)}s">
<path d="${box}" fill="${t.accent}" fill-opacity=".035"/>
<path d="${box}" fill="none" stroke="${t.accent}" stroke-opacity=".4"/>
<path d="M${left + cw - cut} ${y0}L${left + cw} ${y0 + cut}" stroke="${t.accent}" stroke-width="2"/>
${logo ? `<image href="${logo}" x="${tx}" y="${y0 + 14}" width="18" height="18"/>` : ''}
<text x="${nx}" y="${y0 + 28}" font-weight="700" fill="${t.accent}" filter="url(#g)" opacity=".6" style="font-size:15px">${esc(name)}</text>
<text x="${nx}" y="${y0 + 28}" font-weight="700" class="cy" style="font-size:15px">${esc(name)}</text>
<path d="M${f1(nx + nameW + 8)} ${y0 + 26}l7-7M${f1(nx + nameW + 10)} ${y0 + 19}h5v5" fill="none" stroke="${t.accent}" stroke-width="1.5"/>
<rect x="${tx}" y="${y0 + 40}" width="${f1(tagW)}" height="16" fill="none" stroke="${tagc}" stroke-opacity=".8"/>
<text x="${tx + 6}" y="${y0 + 52}" letter-spacing="1" fill="${tagc}" style="font-size:11px">${esc(tag)}</text>
<path transform="translate(${f1(sx - stars.length * 7.2 - 16)} ${y0 + 41}) scale(.5)" d="M10 0l2.9 6.6 7.1.6-5.4 4.7 1.6 7L10 15.2 3.8 18.9l1.6-7L0 7.2l7.1-.6z" fill="${t.star}"/>
<text x="${sx}" y="${y0 + 52}" text-anchor="end" class="dim" style="font-size:12px">${esc(stars)}</text>
${desc.map((l, i) => `<text x="${tx}" y="${y0 + 74 + i * 17}" class="fg" style="font-size:12px">${esc(l)}</text>`).join('\n')}
${install}
</g>`;
	// The right half starts 220px in, half a grid cell off the 40px grid.
	const defs = side === 'R' ? baseDefs(t, ((-g.HW % 40) + 40) % 40) : undefined;
	return halfSliceG(t, g, CARD_H, side, body, {
		title: p.name,
		desc: `${p.name}: ${p.description} Install: ${p.install}. ${p.stars} stars.`,
		text: name + tag + desc.join('') + `$ ${cmd.join('')}` + stars,
		defs,
	});
}

// 440x40: "Sep 7 › title ↗". The title stays at 13px and is cut to fit; the
// reading time is left out, since it would cost every title a dozen columns.
export async function phoneArticleRow(t: Theme, a: Post, i: number): Promise<string> {
	const g = PHONE;
	const date = monthDay(a.date);
	const tx = g.X + 70;
	const ax = g.R - 2; // the arrow spans ax-6 … ax+2
	const shown = fit(a.title, cols(ax - 6 - 8 - tx, 13));
	const body = `<g class="ln" style="animation-delay:${(0.2 + i * 0.08).toFixed(2)}s">
<rect x="${g.X - 8}" y="4" width="${g.R - g.X + 16}" height="32" fill="${t.accent}" fill-opacity="${i % 2 === 0 ? '.04' : '0'}"/>
<text x="${g.X}" y="25" class="dim" style="font-size:13px">${esc(date)}</text>
<text x="${g.X + 56}" y="25" class="cy" style="font-size:13px">›</text>
<text x="${tx}" y="25" class="fg" style="font-size:13px">${esc(shown)}</text>
<path d="M${ax - 6} 25l8-8M${ax - 4} 17h6v6" fill="none" stroke="${t.accent}" stroke-width="1.5"/>
</g>`;
	return sliceG(t, g, 40, body, {
		title: a.title,
		desc: `${a.title}. Published ${a.date}. ${a.reading_time} min read.`,
		text: date + '›' + shown,
	});
}

export async function phoneWritingMore(t: Theme): Promise<string> {
	const g = PHONE;
	const label = ' read all posts on jdx.dev';
	const ax = g.X + (2 + label.length) * 7.8 + 12;
	const body = `<g class="ln" style="animation-delay:.7s">
<text x="${g.X}" y="26" style="font-size:13px"><tspan class="gr">&gt;&gt;</tspan><tspan class="cy">${esc(label)}</tspan></text>
<path d="M${f1(ax)} 26l8-8M${f1(ax + 2)} 18h6v6" fill="none" stroke="${t.accent}" stroke-width="1.5"/>
</g>`;
	return sliceG(t, g, 40, body, {title: 'All posts', desc: 'Read all posts on jdx.dev', text: `>>${label}`});
}
