import { Glob } from "bun";

export async function loadMigrations() {
	const dir = `${import.meta.dir}/migrations`;
	const glob = new Glob("*.sql");
	const files = (await Array.fromAsync(glob.scan({ cwd: dir }))).sort();

	const migrations: { name: string; sql: string }[] = [];
	for (const file of files) {
		migrations.push({
			name: file,
			sql: await Bun.file(`${dir}/${file}`).text(),
		});
	}
	return migrations;
}
