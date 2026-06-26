import { readdirSync, readFileSync } from "node:fs";

export function loadMigrations() {
	const dir = `${import.meta.dir}/migrations`;
	const files = readdirSync(dir)
		.filter((f) => f.endsWith(".sql"))
		.sort();

	const migrations: { name: string; sql: string }[] = [];
	for (const file of files) {
		migrations.push({
			name: file,
			sql: readFileSync(`${dir}/${file}`, "utf-8"),
		});
	}
	return migrations;
}
