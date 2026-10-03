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
export type Post = {title: string; url: string; date: string; description: string};
export type Count = {count: number; query: string};
export type Snapshot = {
	intro: string;
	projects: Project[];
	posts: Post[];
	mau: {date: string; value: number} | null;
	stars: number | null;
	issues: Count | null;
	prs: Count | null;
};

export function slugify(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
