CREATE TABLE IF NOT EXISTS dead_letters (
    received_at DateTime64(3),
    error String,
    raw String,
    source_ip String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(received_at)
ORDER BY (received_at);
