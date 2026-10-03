// Fetches everything the README shows into data/. Each source is fetched
// independently; when one fails, the last good value in data/snapshot.json is
// kept so a flaky API never blanks a number on the profile.
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {type Post, type Project, type Snapshot, type Count, slugify} from './data.ts';

const OSS_URL = process.env.OSS_JSON_URL ?? 'https://jdx.dev/oss.json';
const DAU_MAU_URL = 'https://mise-versions.jdx.dev/api/stats/dau-mau';
const OWNERS = [
	{login: 'jdx', path: 'users/jdx/repos?type=owner'},
	{login: 'aubepkg', path: 'orgs/aubepkg/repos?type=public'},
];
// Accounts that act as bots without being GitHub Apps.
const BOT_USERS = ['mise-en-dev'];
const RELEASE_TITLE = /^chore(\([^)]*\))?: release\b/i;
const LOGO_SIZE = 96;

const token = process.env.GITHUB_TOKEN;

async function get(url: string, init: RequestInit = {}): Promise<Response> {
	const res = await fetch(url, {...init, signal: AbortSignal.timeout(30_000)});
	if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
	return res;
}

async function github<T>(path: string): Promise<T> {
	const headers: Record<string, string> = {
		accept: 'application/vnd.github+json',
		'x-github-api-version': '2022-11-28',
	};
	if (token) headers.authorization = `Bearer ${token}`;
	return (await get(`https://api.github.com/${path}`, {headers})).json() as Promise<T>;
}

async function fetchOss(): Promise<Pick<Snapshot, 'intro' | 'projects' | 'posts'>> {
	const oss = await (await get(OSS_URL)).json() as {intro: string; projects: Project[]; posts: Post[]};
	if (!oss.projects?.length) throw new Error('oss.json has no projects');
	return {
		intro: oss.intro,
		projects: oss.projects,
		posts: oss.posts.map(({title, url, date, description}) => ({title, url, date, description})),
	};
}

type DauMau = {daily: {date: string; mau: number}[]};

// Merges the trailing 30 days into data/mau.json so milestones can be dated
// from our own history once the API window has moved past them.
async function fetchMau(): Promise<Snapshot['mau']> {
	const {daily} = await (await get(DAU_MAU_URL)).json() as DauMau;
	const history: Record<string, number> = JSON.parse(await readFile('data/mau.json', 'utf8').catch(() => '{}'));
	for (const {date, mau} of daily) if (mau > 0) history[date] = mau;
	const dates = Object.keys(history).sort();
	if (!dates.length) throw new Error('no MAU data');
	await writeFile('data/mau.json', `${JSON.stringify(Object.fromEntries(dates.map(d => [d, history[d]])), null, '\t')}\n`);
	const date = dates.at(-1)!;
	return {date, value: history[date]};
}

type Repo = {stargazers_count: number; fork: boolean; archived: boolean; private: boolean};

async function fetchStars(): Promise<number> {
	let total = 0;
	for (const owner of OWNERS) {
		for (let page = 1; ; page++) {
			const repos = await github<Repo[]>(`${owner.path}&per_page=100&page=${page}`);
			for (const r of repos) if (!r.fork && !r.archived && !r.private) total += r.stargazers_count;
			if (repos.length < 100) break;
		}
	}
	return total;
}

type SearchItem = {title: string; user: {login: string; type: string}};

async function search(q: string): Promise<{total: number; items: SearchItem[]}> {
	const items: SearchItem[] = [];
	let total = 0;
	for (let page = 1; page <= 10; page++) {
		const res = await github<{total_count: number; items: SearchItem[]}>(
			`search/issues?q=${encodeURIComponent(q)}&per_page=100&page=${page}`,
		);
		total = res.total_count;
		items.push(...res.items);
		if (items.length >= total || res.items.length < 100) break;
	}
	return {total, items};
}

function isBot(user: SearchItem['user']): boolean {
	return user.type === 'Bot' || BOT_USERS.includes(user.login);
}

// Counts open issues or non-draft PRs across public, non-archived repos,
// leaving out bots and release PRs. The returned query reproduces the count
// on github.com closely enough to link to; the count itself is exact.
async function fetchCount(kind: 'issue' | 'pr'): Promise<Count> {
	const base = [
		...OWNERS.map(o => `${o.login === 'jdx' ? 'user' : 'org'}:${o.login}`),
		'is:public', 'archived:false', 'is:open', `is:${kind}`,
		...(kind === 'pr' ? ['draft:false'] : []),
	];
	const {items} = await search(base.join(' '));
	const kept = items.filter(i => !isBot(i.user) && !(kind === 'pr' && RELEASE_TITLE.test(i.title)));
	const bots = [...new Set(items.filter(i => isBot(i.user)).map(i => i.user.login))].sort();
	const query = [
		...base,
		...bots.map(b => (b.endsWith('[bot]') ? `-author:app/${b.slice(0, -5)}` : `-author:${b}`)),
		...(kind === 'pr' ? ['NOT "chore: release" in:title'] : []),
	].join(' ');
	const linked = await github<{total_count: number}>(`search/issues?q=${encodeURIComponent(query)}&per_page=1`);
	if (linked.total_count !== kept.length) {
		console.warn(`warn: ${kind} count ${kept.length} but its linked search shows ${linked.total_count}`);
	}
	return {count: kept.length, query};
}

// Downloads every logo before touching data/logos, so a failure part-way
// leaves the previous set intact. Raster logos are shrunk to LOGO_SIZE since
// each card embeds its logo as a data URI.
async function fetchLogos(projects: Project[]): Promise<void> {
	const files = new Map<string, Buffer>();
	for (const p of projects) {
		if (!p.logo) continue;
		const buf = Buffer.from(await (await get(p.logo)).arrayBuffer());
		const slug = slugify(p.name);
		if (p.logo.endsWith('.svg')) {
			files.set(`${slug}.svg`, buf);
		} else {
			files.set(`${slug}.png`, await sharp(buf)
				.resize(LOGO_SIZE, LOGO_SIZE, {fit: 'contain', background: {r: 0, g: 0, b: 0, alpha: 0}})
				.png({compressionLevel: 9})
				.toBuffer());
		}
	}
	await rm('data/logos', {recursive: true, force: true});
	await mkdir('data/logos', {recursive: true});
	for (const [name, buf] of files) await writeFile(`data/logos/${name}`, buf);
}

async function main() {
	await mkdir('data', {recursive: true});
	const previous: Partial<Snapshot> = JSON.parse(await readFile('data/snapshot.json', 'utf8').catch(() => '{}'));
	let failures = 0;
	async function attempt<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
		try {
			return await fn();
		} catch (err) {
			failures++;
			console.warn(`warn: ${name} failed, keeping last value: ${(err as Error).message}`);
			return fallback;
		}
	}

	const oss = await attempt('oss.json', fetchOss, {
		intro: previous.intro ?? '',
		projects: previous.projects ?? [],
		posts: previous.posts ?? [],
	});
	const snapshot: Snapshot = {
		...oss,
		mau: await attempt('mau', fetchMau, previous.mau ?? null),
		stars: await attempt('stars', fetchStars, previous.stars ?? null),
		issues: await attempt('issues', () => fetchCount('issue'), previous.issues ?? null),
		prs: await attempt('prs', () => fetchCount('pr'), previous.prs ?? null),
	};
	if (failures === 5) throw new Error('every source failed; leaving data/ untouched');
	if (!snapshot.projects.length) throw new Error('no projects to render');
	if (oss.projects !== previous.projects) await attempt('logos', () => fetchLogos(oss.projects), undefined);

	await writeFile('data/snapshot.json', `${JSON.stringify(snapshot, null, '\t')}\n`);
	console.log(
		`projects ${snapshot.projects.length} · posts ${snapshot.posts.length} · mau ${snapshot.mau?.value} · ` +
		`stars ${snapshot.stars} · issues ${snapshot.issues?.count} · prs ${snapshot.prs?.count}`,
	);
}

if (import.meta.main) await main();
