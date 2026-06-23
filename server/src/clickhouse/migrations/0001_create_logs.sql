CREATE TABLE IF NOT EXISTS logs (
    id String,
    timestamp DateTime64(3),
    received_at DateTime64(3),
    level String,
    service String,
    environment String,
    message String,
    version Nullable(String),
    extras String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (service, environment, timestamp, id);
