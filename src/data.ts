// Shapes shared by fetch.ts (writes data/) and render.ts (reads it).

export type Project = {
	name: string;
	repo: string;
	kind: string;
	description: string;
	tagline: string;
	install: string;
	stars: string;
	href: string;
	logo: string;
};
export type Post = {title: string; url: string; date: string; description: string; reading_time: number};
export type Count = {count: number; query: string};
export type GitHubStats = {
	created_at: string;
	followers: number;
	public_repos: number;
	prs: number;
	prs_merged: number;
	year: number;
	contributions_year: number;
	contributions_all: number;
	streak_current: number;
	streak_longest: number;
	languages: Record<string, number>;
};
export type Snapshot = {
	intro: string;
	projects: Project[];
	posts: Post[];
	mau: {date: string; value: number; dau: number} | null;
	stars: number | null;
	issues: Count | null;
	prs: Count | null;
	github: GitHubStats | null;
};
// One [date, contributions] pair per day for the last 53 weeks, starting on a Sunday.
export type Calendar = [string, number][];

// Stars per UTC day from each repo's stargazers (starred_at), all time.
// Counts only current stargazers, so history runs slightly low.
export type RepoStars = {created_at: string; total: number; daily: Record<string, number>};
export type Stars = {
	end: string; // last complete UTC day counted
	repos: Record<string, RepoStars>;
	mise: {total: number; gain30: number | null} | null;
};

// Installs of jdx tools through mise (mise-versions; CI excluded, one per
// IP/tool/version/day, so not unique users).
export type ToolInstalls = {
	repo: string;
	this_month: number;
	last_month: number;
	mom: number;
	rank: number;
	daily: [string, number][];
};
export type Installs = {
	end: string;
	baseline_mom: number | null;
	tools_ranked: number;
	tools: Record<string, ToolInstalls>;
};

export function slugify(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
