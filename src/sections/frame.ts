// The console chrome: header, footer, section heads, and button rows.
import {siBluesky, siGithubsponsors, siMastodon, siX} from 'simple-icons';
import {DESKTOP, FL, FR, HW, M, PHONE, type Geo, type Theme, W, X, esc, f1, halfSlice, halfSliceG, heading, headingG, num, placeholder, prompt, promptG, segment, segmentG, slice, sliceG, stagger, up40, wrap} from '../console.ts';
import {CREDIT_POST, CREDIT_URL, DAY, NEW_DAYS, age, iso, monthDay, parse, shift, short, sum, toolColor} from '../shared.ts';
import {type Calendar, type Installs, type Post, type Project, type RepoStars, type Snapshot, type Stars, slugify} from '../data.ts';

// ─────────────────────────────── header ───────────────────────────────
export async function header(t: Theme, s: Snapshot): Promise<string> {
	const barLeft = 'SYS://ENTIRE.IO // NODE:JDX';
	const barRight = 'ONLINE · ALL SYSTEMS NOMINAL';
	const name = 'JEFF DICKEY';
	const tools = s.projects.slice(0, 7).map(p => p.name).join(' · ');
	const lines = ['open source maintainer · developer tools in Rust', tools, 'full-time on open source at '];
	const h = 360;
	const css = `@keyframes type{from{width:0}}
@keyframes flicker{0%{opacity:0}10%{opacity:1}14%{opacity:.2}22%{opacity:1}30%{opacity:.4}40%,100%{opacity:1}}
@keyframes gm{0%,92%,100%{transform:translate(0,0)}93%{transform:translate(5px,-1px)}95%{transform:translate(-3px,1px)}97%{transform:translate(2px,0)}}
@keyframes gc{0%,92%,100%{transform:translate(0,0)}93%{transform:translate(-5px,1px)}95%{transform:translate(4px,-1px)}97%{transform:translate(-2px,0)}}
.typing{animation:type .7s steps(8) .3s both}
.name{animation:flicker .9s linear 1.1s both}
.gm{animation:gm 6s linear 2s infinite}.gc{animation:gc 6s linear 2s infinite}`;
	const defs = `<pattern id="scan" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" fill-opacity=".2"/></pattern>
<filter id="tglow" x="-5%" y="-40%" width="110%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>
<filter id="sglow" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="3"/></filter>
<clipPath id="typeclip"><rect class="typing" x="${X}" y="80" width="140" height="30"/></clipPath>`;
	const dotx = FR - 20 - barRight.length * 8.2 - 16;
	const rows = [
		`<text class="fg" x="${X}" y="{y}"><tspan class="cy">&gt;&gt;</tspan> ${esc(lines[0])}</text>`,
		`<text class="fg" x="${X}" y="{y}"><tspan class="cy">&gt;&gt;</tspan> ${esc(lines[1])}</text>`,
		`<text class="fg" x="${X}" y="{y}"><tspan class="cy">&gt;&gt;</tspan> ${esc(lines[2])}<tspan class="cy" font-weight="700">ENTIRE.IO</tspan></text>`,
	];
	const [descLines] = stagger(rows, 218, 24, 1.75, 0.25);
	const big = (x: number, fill: string, extra = '') => `<text x="${x}" y="172" fill="${fill}"${extra} style="font-size:56px">${name}</text>`;
	const body = `<rect x="${FL}" y="${M}" width="${FR - FL}" height="34" fill="${t.accent}" fill-opacity=".08"/>
<line x1="${FL}" y1="${M + 34}" x2="${FR}" y2="${M + 34}" stroke="${t.accent}" stroke-opacity=".5"/>
<text x="${FL + 16}" y="${M + 22}" letter-spacing="1" class="cy" style="font-size:12px">${esc(barLeft)}</text>
<text x="${FR - 20}" y="${M + 22}" letter-spacing="1" class="dim" text-anchor="end" style="font-size:12px">${esc(barRight)}</text>
<circle class="dot" cx="${f1(dotx)}" cy="${M + 18}" r="4" fill="${t.ok}"/>
<circle class="dot" cx="${f1(dotx)}" cy="${M + 18}" r="4" fill="${t.ok}" filter="url(#sglow)"/>
<g clip-path="url(#typeclip)"><text x="${X}" y="102" class="dim"><tspan class="gr">$</tspan> whoami</text></g>
<g class="name" font-weight="800" letter-spacing="2" style="font-size:56px">
${big(X, t.accent, ' opacity=".55" filter="url(#tglow)"')}
<g class="gm">${big(X + 3, t.accent2, ' opacity=".75"')}</g>
<g class="gc">${big(X - 3, t.accent, ' opacity=".85"')}</g>
${big(X, t.bright)}
</g>
${descLines}
<g class="ln" style="animation-delay:2.8s">
<text x="${X}" y="304" class="gr">$</text>
<rect class="cursor" x="${X + 18}" y="291" width="10" height="17" fill="${t.accent}"/>
<rect class="cursor" x="${X + 18}" y="291" width="10" height="17" fill="${t.accent}" filter="url(#sglow)"/>
</g>
<rect x="${FL}" y="${M + 35}" width="${FR - FL}" height="${h - M - 35}" fill="url(#scan)"/>`;
	return slice(t, h, body, {
		title: 'Jeff Dickey', desc: headerAlt(s),
		text: barLeft + barRight + name + '$ whoami>>' + lines.join('') + 'ENTIRE.IO',
		top: true, css, defs, weights: [400, 700, 800],
	});
}

export function headerAlt(s: Snapshot): string {
	return `Jeff Dickey (@jdx). Open source maintainer building developer tools in Rust, full-time at entire.io: ${s.projects.slice(0, 7).map(p => p.name).join(', ')}.`;
}

// ─────────────────────────────── footer ───────────────────────────────
export async function footer(t: Theme): Promise<string> {
	const credit = '// console after @georgekobaidze';
	const body = `<text x="${X}" y="30" class="dim"><tspan class="gr">$</tspan> exit</text>
<text x="${X}" y="52" class="dim">connection to <tspan class="cy">jdx</tspan> closed. <tspan class="fainter">// EOF</tspan></text>
<text x="${FR - 36}" y="52" text-anchor="end" class="fainter" style="font-size:11px">${esc(credit)}</text>`;
	return slice(t, 80, body, {title: 'End of profile', desc: 'Connection closed.', text: `$ exit connection to jdx closed. // EOF${credit}`, bottom: true});
}

// ──────────────────────────────── links ───────────────────────────────
export type Button = {label: string; handle: string; url: string; icon: (t: Theme, x: number, y: number) => string};

export function pathIcon(d: string) {
	return (t: Theme, x: number, y: number) => `<path transform="translate(${x} ${y}) scale(${18 / 24})" d="${d}" fill="${t.accent}"/>`;
}

export const LINKS: Button[] = [
	{
		label: 'jdx.dev', handle: 'blog, newsletter', url: 'https://jdx.dev',
		icon: (t, x, y) => `<rect x="${x}" y="${y}" width="18" height="18" rx="3" fill="${t.accent}"/><text x="${x + 9}" y="${y + 13}" text-anchor="middle" font-weight="700" fill="${t.bg}" style="font-size:10px">&gt;_</text>`,
	},
	{label: 'Sponsor', handle: 'jdx.dev/sponsors', url: 'https://jdx.dev/sponsors', icon: pathIcon(siGithubsponsors.path)},
	{label: 'X', handle: '@jdxcode', url: 'https://x.com/jdxcode', icon: pathIcon(siX.path)},
	{label: 'Bluesky', handle: '@jdx.dev', url: 'https://bsky.app/profile/jdx.dev', icon: pathIcon(siBluesky.path)},
	{label: 'Mastodon', handle: '@jdx · fosstodon', url: 'https://fosstodon.org/@jdx', icon: pathIcon(siMastodon.path)},
];

export async function sectionHead(t: Theme, name: string, counter: string, cmd: string, comment = ''): Promise<string> {
	return slice(t, 120, heading(t, 44, name, counter) + '\n' + prompt(cmd, 0.15, comment), {
		title: name, desc: name, text: `~/${name}${counter}$ ${cmd} ${comment}`,
	});
}

// A row of n equal buttons spanning the text column (x = 52 … 828). Each
// button must sit inside its own image, so the last one starts exactly at its
// segment's left edge; for n = 5 this gives Giorgi's 124px buttons, 39px apart.
export async function button(t: Theme, b: Button, k: number, n: number, delay0 = 0.25): Promise<string> {
	const seg = W / n;
	const bw = FR - 36 - (n - 1) * seg;
	const gap = ((n - 1) * seg - X) / (n - 1) - bw;
	const lx = X + k * (bw + gap) - seg * k;
	const h = 80;
	const by = 12;
	const bh = 56;
	const cut = 12;
	const box = `M${f1(lx)} ${by}H${f1(lx + bw - cut)}L${f1(lx + bw)} ${by + cut}V${by + bh}H${f1(lx)}Z`;
	const maxHandle = Math.floor((bw - 24) / 6);
	const handle = b.handle.length > maxHandle ? `${b.handle.slice(0, maxHandle - 1)}…` : b.handle;
	const body = `<g class="ln" style="animation-delay:${(delay0 + k * 0.08).toFixed(2)}s">
<path d="${box}" fill="${t.accent}" fill-opacity=".05"/>
<path d="${box}" fill="none" stroke="${t.accent}" stroke-opacity=".55"/>
<path d="M${f1(lx + bw - cut)} ${by}L${f1(lx + bw)} ${by + cut}" stroke="${t.accent}" stroke-width="2"/>
<g filter="url(#g)" opacity=".5">${b.icon(t, Math.round(lx + 12), by + 11)}</g>
${b.icon(t, Math.round(lx + 12), by + 11)}
<text x="${f1(lx + 38)}" y="${by + 25}" font-weight="700" class="cy" style="font-size:13px">${esc(b.label)}</text>
<text x="${f1(lx + 12)}" y="${by + 46}" class="dim" style="font-size:10px">${esc(handle)}</text>
</g>`;
	return segment(t, k, n, h, body, {title: b.label, desc: `${b.label}: ${b.url}`, text: b.label + handle + '>_'});
}

// ─────────────────────────────── phone ────────────────────────────────
// Phone layouts, swapped in below 600px through <picture>.
export async function phoneHeader(t: Theme, s: Snapshot): Promise<string> {
	return placeholder(t, PHONE.W, 360, 'header');
}

export async function phoneFooter(t: Theme): Promise<string> {
	return placeholder(t, PHONE.W, 80, 'footer');
}

export async function phoneSectionHead(t: Theme, name: string, counter: string, cmd: string, comment = ''): Promise<string> {
	return placeholder(t, PHONE.W, 120, `~/${name}`);
}

export async function phoneButton(t: Theme, b: Button, k: number, n: number, delay0 = 0.25): Promise<string> {
	return placeholder(t, PHONE.W / n, 80, b.label);
}
