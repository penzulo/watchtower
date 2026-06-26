export const clickHouseConnectionOptions = {
	url: Bun.env.CLICKHOUSE_URL ?? "http://localhost:8123",
	username: Bun.env.CLICKHOUSE_USERNAME ?? "default",
	password: Bun.env.CLICKHOUSE_PASSWORD ?? "",
	database: Bun.env.CLICKHOUSE_DB ?? "watchtower",
	max_open_connections: 64,
	keep_alive: {
		// Keep sockets alive well past the request gap so they get reused
		// across consecutive jobs instead of being torn down and reopened.
		enabled: true,
		socket_ttl: 30_000,
	},
} as const;
