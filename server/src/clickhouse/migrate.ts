import { createClient } from "@clickhouse/client";
import { clickHouseConnectionOptions } from "@watchtower/server/clickhouse/connection";
import { sql as logsSchema } from "./migrations/0001_create_logs";
import { sql as dlqSchema } from "./migrations/0002_create_dlq";

const clickhouse = createClient(clickHouseConnectionOptions);

const migrations = [
	{ name: "0001_create_logs.sql", sql: logsSchema },
	{ name: "0002_create_dlq.sql", sql: dlqSchema },
];

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

	let count = 0;
	for (const migration of migrations) {
		if (!executed.includes(migration.name)) {
			console.log(`Migrating: ${migration.name}`);

			await clickhouse.command({ query: migration.sql });

			await clickhouse.insert({
				table: "schema_migrations",
				values: [{ name: migration.name }],
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
