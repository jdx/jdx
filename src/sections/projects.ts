// ~/projects cards and ~/writing rows.
import {readFile} from 'node:fs/promises';
import {DESKTOP, FL, FR, HW, M, PHONE, type Geo, type Theme, W, X, esc, f1, halfSlice, halfSliceG, heading, headingG, num, placeholder, prompt, promptG, segment, segmentG, slice, sliceG, stagger, up40, wrap} from '../console.ts';
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
export async function phoneCard(t: Theme, p: Project, side: 'L' | 'R', delay: number): Promise<string> {
	return placeholder(t, PHONE.HW, CARD_H, p.name);
}

export async function phoneArticleRow(t: Theme, a: Post, i: number): Promise<string> {
	return placeholder(t, PHONE.W, 40, a.title);
}

export async function phoneWritingMore(t: Theme): Promise<string> {
	return placeholder(t, PHONE.W, 40, 'all posts');
}
