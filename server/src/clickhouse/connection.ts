export const clickHouseConnectionOptions = {
	url: Bun.env.CLICKHOUSE_URL ?? "http://localhost:8123",
	username: Bun.env.CLICKHOUSE_USERNAME ?? "default",
	password: Bun.env.CLICKHOUSE_PASSWORD ?? "",
	database: Bun.env.CLICKHOUSE_DB ?? "watchtower",
} as const;
