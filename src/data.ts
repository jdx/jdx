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
	// history is one [day, stars] pair per day from mise-analytics, starting at the first snapshot.
	// downloads is the GitHub release-asset counter (CI included, tracked since 2026-05) and its 7-day daily average.
	mise: {total: number; gain30: number | null; history?: [string, number][]; downloads?: {total: number; rate: number}} | null;
};

// GitHub release asset downloads of jdx tools (mise-analytics; CI included,
// every asset counts, so not unique users). rate is the daily average over the
// last 7 days; prev_rate and wow, the week before and the change, are null when
// the history doesn't reach back 14 days.
export type ToolInstalls = {
	repo: string;
	rate: number;
	prev_rate: number | null;
	wow: number | null;
	total: number;
	daily: [string, number][];
};
export type Installs = {
	end: string;
	baseline_wow: number | null;
	tools: Record<string, ToolInstalls>;
};

export function slugify(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
