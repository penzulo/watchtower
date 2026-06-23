import { join } from "node:path";
import { createClient } from "@clickhouse/client";
import { clickHouseConnectionOptions } from "@watchtower/server/clickhouse/connection";

const clickhouse = createClient(clickHouseConnectionOptions);

export async function runMigrations() {
	console.log("Running ClickHouse migrations...");

	// Ensure the schema_migrations table exists
	await clickhouse.command({
		query: `
			CREATE TABLE IF NOT EXISTS schema_migrations (
				name String,
				executed_at DateTime DEFAULT now()
			) ENGINE = MergeTree()
			ORDER BY name;
		`,
	});

	// Get executed migrations
	const result = await clickhouse.query({
		query: `SELECT name FROM schema_migrations`,
		format: "JSONEachRow",
	});
	const executed = (await result.json<{ name: string }>()).map((r) => r.name);

	const migrationsDir = join(import.meta.dir, "migrations");
	const glob = new Bun.Glob("*.sql");
	const migrationFiles = (
		await Array.fromAsync(glob.scan(migrationsDir))
	).sort();

	let count = 0;
	for (const file of migrationFiles) {
		if (!executed.includes(file)) {
			console.log(`Migrating: ${file}`);
			const filePath = join(migrationsDir, file);
			const sql = await Bun.file(filePath).text();

			await clickhouse.command({ query: sql });

			await clickhouse.insert({
				table: "schema_migrations",
				values: [{ name: file }],
				format: "JSONEachRow",
			});
			count++;
		}
	}

	if (count === 0) {
		console.log("ClickHouse schema is up to date.");
	} else {
		console.log(`Successfully applied ${count} migration(s).`);
	}
}
