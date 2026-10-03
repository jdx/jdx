// Fetches everything the README shows into data/. Each source is fetched
// independently; when one fails, the last good value in data/snapshot.json is
// kept so a flaky API never blanks a number on the profile.
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {
	type Calendar, type Count, type GitHubStats, type Installs, type Post, type Project, type RepoStars, type Snapshot,
	type Stars, type ToolInstalls, slugify,
} from './data.ts';

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

// Shows up as an annotation on the Actions run, not just in the log.
function warn(title: string, message: string): void {
	console.warn(process.env.GITHUB_ACTIONS ? `::warning title=${title}::${message}` : `warn: ${title}: ${message}`);
}

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
		posts: oss.posts.map(({title, url, date, description, reading_time}) => ({title, url, date, description, reading_time})),
	};
}

type DauMau = {daily: {date: string; mau: number; dau: number}[]};

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
	const dau = daily.find(d => d.date === date)?.dau ?? 0;
	return {date, value: history[date], dau};
}

// Contributions, streaks, PRs and languages, after Giorgi Kobaidze's fetch.py
// (github.com/georgekobaidze/georgekobaidze, MIT). With the Actions token these
// are public contributions only; a PROFILE_TOKEN PAT adds private ones.
// An expired or revoked PROFILE_TOKEN falls back to the Actions token rather
// than freezing the stats.
let graphqlToken = process.env.PROFILE_TOKEN || token;

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
	if (!graphqlToken) throw new Error('GraphQL needs GITHUB_TOKEN or PROFILE_TOKEN');
	const res = await fetch('https://api.github.com/graphql', {
		method: 'POST',
		headers: {authorization: `bearer ${graphqlToken}`, 'content-type': 'application/json'},
		body: JSON.stringify({query, variables}),
		signal: AbortSignal.timeout(60_000),
	});
	if ((res.status === 401 || res.status === 403) && graphqlToken !== token && token) {
		warn('PROFILE_TOKEN', `GraphQL returned HTTP ${res.status}; using GITHUB_TOKEN (public contributions only)`);
		graphqlToken = token;
		return graphql(query, variables);
	}
	if (!res.ok) throw new Error(`GraphQL: HTTP ${res.status}`);
	const body = await res.json() as {data: T; errors?: {message: string}[]};
	if (body.errors?.length) throw new Error(`GraphQL: ${body.errors.map(e => e.message).join('; ')}`);
	return body.data;
}

const PROFILE_QUERY = `query($login: String!) {
  user(login: $login) {
    createdAt
    followers { totalCount }
    repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) { totalCount }
    pullRequests { totalCount }
    merged: pullRequests(states: MERGED) { totalCount }
    contributionsCollection { contributionYears }
    top: repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 100, orderBy: {field: STARGAZERS, direction: DESC}) {
      nodes { languages(first: 20) { edges { size node { name } } } }
    }
  }
}`;

type Profile = {user: {
	createdAt: string;
	followers: {totalCount: number};
	repositories: {totalCount: number};
	pullRequests: {totalCount: number};
	merged: {totalCount: number};
	contributionsCollection: {contributionYears: number[]};
	top: {nodes: {languages: {edges: {size: number; node: {name: string}}[]}}[]};
}};
type YearData = {contributionCalendar: {totalContributions: number; weeks: {contributionDays: {date: string; contributionCount: number}[]}[]}};

function iso(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
	return new Date(d.getTime() + n * 864e5);
}

// The current streak may end yesterday when today has no contributions yet.
function streaks(days: Map<string, number>, today: Date): [number, number] {
	let longest = 0;
	let run = 0;
	for (const d of [...days.keys()].filter(d => d <= iso(today)).sort()) {
		run = days.get(d)! > 0 ? run + 1 : 0;
		longest = Math.max(longest, run);
	}
	let current = 0;
	let d = today;
	if (!days.get(iso(d))) d = addDays(d, -1);
	while ((days.get(iso(d)) ?? 0) > 0) {
		current++;
		d = addDays(d, -1);
	}
	return [current, longest];
}

async function fetchGitHub(today: Date): Promise<{github: GitHubStats; calendar: Calendar}> {
	const {user: u} = await graphql<Profile>(PROFILE_QUERY, {login: 'jdx'});
	const years = [...u.contributionsCollection.contributionYears].sort();
	const yearsQuery = `query($login: String!) { user(login: $login) {${years.map(y => `
    y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${y}-12-31T23:59:59Z") {
      contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
    }`).join('')}
  } }`;
	const {user: ydata} = await graphql<{user: Record<string, YearData>}>(yearsQuery, {login: 'jdx'});

	const days = new Map<string, number>();
	let all = 0;
	for (const y of years) {
		const cal = ydata[`y${y}`].contributionCalendar;
		all += cal.totalContributions;
		for (const w of cal.weeks) for (const day of w.contributionDays) days.set(day.date, day.contributionCount);
	}
	const [current, longest] = streaks(days, today);
	// Last 53 weeks, starting on a Sunday like GitHub's own graph.
	let start = addDays(today, -52 * 7);
	start = addDays(start, -start.getUTCDay());
	const calendar: Calendar = [];
	for (let d = start; d <= today; d = addDays(d, 1)) calendar.push([iso(d), days.get(iso(d)) ?? 0]);

	const langs = new Map<string, number>();
	for (const r of u.top.nodes) for (const e of r.languages.edges) langs.set(e.node.name, (langs.get(e.node.name) ?? 0) + e.size);
	const year = today.getUTCFullYear();
	return {
		calendar,
		github: {
			created_at: u.createdAt,
			followers: u.followers.totalCount,
			public_repos: u.repositories.totalCount,
			prs: u.pullRequests.totalCount,
			prs_merged: u.merged.totalCount,
			year,
			contributions_year: ydata[`y${year}`]?.contributionCalendar.totalContributions ?? 0,
			contributions_all: all,
			streak_current: current,
			streak_longest: longest,
			languages: Object.fromEntries([...langs].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
		},
	};
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
		warn(`${kind} count`, `${kept.length} counted but its linked search shows ${linked.total_count}`);
	}
	return {count: kept.length, query};
}

// The non-mise tools from jdx.dev, keyed by owner/repo.
function toolRepos(projects: Project[]): string[] {
	return projects.map(p => p.repo).filter(r => r !== 'jdx/mise');
}

async function fetchStargazers(repo: string): Promise<RepoStars> {
	if (!token) throw new Error('the stargazers API needs GITHUB_TOKEN');
	const info = await github<{created_at: string; stargazers_count: number}>(`repos/${repo}`);
	const daily: Record<string, number> = {};
	for (let page = 1; page <= 400; page++) {
		const res = await get(`https://api.github.com/repos/${repo}/stargazers?per_page=100&page=${page}`, {
			headers: {accept: 'application/vnd.github.star+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28'},
		});
		const list = await res.json() as {starred_at: string}[];
		for (const s of list) daily[s.starred_at.slice(0, 10)] = (daily[s.starred_at.slice(0, 10)] ?? 0) + 1;
		if (list.length < 100) break;
	}
	return {
		created_at: info.created_at.slice(0, 10),
		total: info.stargazers_count,
		daily: Object.fromEntries(Object.entries(daily).sort(([a], [b]) => a.localeCompare(b))),
	};
}

// mise is too big for the stargazers API (it stops at 40k), so its 30-day
// gain comes from the daily snapshots in jdx/mise-analytics. The CSV has gaps,
// so each end of the window takes the nearest earlier row; a gap wider than
// 3 days gives no gain rather than a wrong one.
async function fetchMiseStars(end: string): Promise<Stars['mise']> {
	const csv = await (await get('https://raw.githubusercontent.com/jdx/mise-analytics/main/mise.csv')).text();
	const rows = csv.trim().split('\n').slice(1).map(l => l.split(',')).filter(r => r[4]).map(r => [r[0], Number(r[4])] as const);
	const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
	// A row dated D+1 is the snapshot taken early that morning, i.e. the end of D.
	const target = iso(addDays(new Date(`${end}T00:00:00Z`), 1));
	const cur = rows.findLast(([d]) => d <= target);
	if (!cur || days(cur[0], target) > 3) throw new Error(`mise.csv has nothing near ${target}`);
	const before = iso(addDays(new Date(`${cur[0]}T00:00:00Z`), -30));
	const prior = rows.findLast(([d]) => d <= before);
	return {total: cur[1], gain30: prior && days(prior[0], before) <= 3 ? cur[1] - prior[1] : null};
}

async function fetchStarHistory(projects: Project[], end: string, previous: Stars | null): Promise<Stars> {
	const repos: Record<string, RepoStars> = {};
	let ok = 0;
	for (const repo of toolRepos(projects)) {
		try {
			repos[repo] = await fetchStargazers(repo);
			ok++;
		} catch (err) {
			warn(`stargazers for ${repo}`, `keeping the last value: ${(err as Error).message}`);
			if (previous?.repos[repo]) repos[repo] = previous.repos[repo];
		}
	}
	if (!ok) throw new Error('no stargazer data');
	let mise = previous?.mise ?? null;
	try {
		mise = await fetchMiseStars(end);
	} catch (err) {
		warn('mise star history', `keeping the last value: ${(err as Error).message}`);
	}
	return {end, repos, mise};
}

const MISE_VERSIONS = 'https://mise-versions.jdx.dev/api';
const UA = {'user-agent': 'jdx-profile (github.com/jdx/jdx)'};
// ruby counts installs of Ruby itself through mise's core plugin, not jdx/ruby.
const NOT_INSTALLS = new Set(['jdx/mise', 'jdx/ruby']);

async function mv<T>(path: string): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await (await get(`${MISE_VERSIONS}${path}`, {headers: UA})).json() as T;
		} catch (err) {
			if (attempt >= 3) throw err;
		}
	}
}

async function fetchInstalls(projects: Project[]): Promise<Installs> {
	const map = await mv<Record<string, number>>('/downloads/30d');
	const ranked = Object.entries(map).sort((a, b) => b[1] - a[1]);
	const rank = new Map(ranked.map(([k], i) => [k, i + 1]));
	const baseline = await mv<{global: {mom: number}}>('/stats/growth').then(g => g.global.mom).catch(() => null);
	// Every series ends on the same day: the latest the API has data for.
	// Days with no installs are missing from the API, so they are filled with 0.
	const fetched: {tool: string; repo: string; growth: {thisMonth: number; lastMonth: number; mom: number}; byDate: Map<string, number>}[] = [];
	let end = '';
	for (const repo of toolRepos(projects).filter(r => !NOT_INSTALLS.has(r))) {
		const tool = repo.split('/')[1];
		if (!map[tool]) continue;
		const growth = await mv<{thisMonth: number; lastMonth: number; mom: number}>(`/downloads/${tool}/growth`);
		const {daily} = await mv<{daily: {date: string; count: number}[]}>(`/downloads/${tool}`);
		for (const d of daily) if (d.date > end) end = d.date;
		fetched.push({tool, repo, growth, byDate: new Map(daily.map(d => [d.date, d.count]))});
	}
	if (!fetched.length || !end) throw new Error('no install data for any jdx tool');
	const tools: Record<string, ToolInstalls> = {};
	for (const {tool, repo, growth, byDate} of fetched) {
		const series: [string, number][] = [];
		for (let i = 29; i >= 0; i--) {
			const d = iso(addDays(new Date(`${end}T00:00:00Z`), -i));
			series.push([d, byDate.get(d) ?? 0]);
		}
		tools[tool] = {repo, this_month: growth.thisMonth, last_month: growth.lastMonth, mom: growth.mom, rank: rank.get(tool)!, daily: series};
	}
	return {end, baseline_mom: baseline, tools_ranked: ranked.length, tools};
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
			warn(`${name} fetch failed`, `keeping the last value: ${(err as Error).message}`);
			return fallback;
		}
	}

	const oss = await attempt('oss.json', fetchOss, {
		intro: previous.intro ?? '',
		projects: previous.projects ?? [],
		posts: previous.posts ?? [],
	});
	const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
	const gh = await attempt('github', () => fetchGitHub(today), null);
	const snapshot: Snapshot = {
		...oss,
		mau: await attempt('mau', fetchMau, previous.mau ?? null),
		stars: await attempt('stars', fetchStars, previous.stars ?? null),
		issues: await attempt('issues', () => fetchCount('issue'), previous.issues ?? null),
		prs: await attempt('prs', () => fetchCount('pr'), previous.prs ?? null),
		github: gh?.github ?? previous.github ?? null,
	};
	if (failures === 6) throw new Error('every source failed; leaving data/ untouched');
	if (!snapshot.projects.length) throw new Error('no projects to render');
	if (oss.projects !== previous.projects) await attempt('logos', () => fetchLogos(oss.projects), undefined);

	await writeFile('data/snapshot.json', `${JSON.stringify(snapshot, null, '\t')}\n`);
	if (gh) await writeFile('data/calendar.json', `${JSON.stringify(gh.calendar)}\n`);

	// Charts count complete UTC days only, so re-runs on the same day agree.
	const end = iso(addDays(today, -1));
	const prevStars: Stars | null = JSON.parse(await readFile('data/stars.json', 'utf8').catch(() => 'null'));
	const stars = await attempt('star history', () => fetchStarHistory(snapshot.projects, end, prevStars), null);
	if (stars) await writeFile('data/stars.json', `${JSON.stringify(stars)}\n`);
	const installs = await attempt('installs', () => fetchInstalls(snapshot.projects), null);
	if (installs) await writeFile('data/installs.json', `${JSON.stringify(installs, null, '\t')}\n`);

	// Keeping the last value is fine for a run or two, but a source that keeps
	// failing should turn the run red instead of freezing part of the profile.
	if (!gh) {
		const cal: Calendar | null = JSON.parse(await readFile('data/calendar.json', 'utf8').catch(() => 'null'));
		const last = cal?.at(-1)?.[0];
		if (!last || (today.getTime() - Date.parse(`${last}T00:00:00Z`)) / 864e5 > 7) {
			process.exitCode = 1;
			console.error(`error: GitHub stats have not refreshed since ${last ?? 'ever'}`);
		}
	}
	console.log(
		`projects ${snapshot.projects.length} · posts ${snapshot.posts.length} · mau ${snapshot.mau?.value} · ` +
		`stars ${snapshot.stars} · issues ${snapshot.issues?.count} · prs ${snapshot.prs?.count} · ` +
		`contributions ${snapshot.github?.contributions_year}/${snapshot.github?.contributions_all} · ` +
		`streak ${snapshot.github?.streak_current}/${snapshot.github?.streak_longest}`,
	);
}

if (import.meta.main) await main();
