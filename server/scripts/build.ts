import { resolve } from "node:path";

async function build() {
	console.log("Building Watchtower server binary...");

	const serverDir = resolve(import.meta.dir, "..");

	const result = await Bun.build({
		entrypoints: [resolve(serverDir, "src/index.ts")],
		outdir: resolve(serverDir, "bin"),
		naming: "watchtower-server", // explicitly name the binary to avoid conflict with tsc 'src' dir
		target: "bun",
		compile: true,
		minify: true,
	});

	if (!result.success) {
		console.error("Build failed with errors:");
		for (const log of result.logs) {
			console.error(log);
		}
		process.exit(1);
	}

	console.log(
		`✅ Successfully compiled binary to: ${resolve(serverDir, "bin", "watchtower-server")}`,
	);
}

build();
