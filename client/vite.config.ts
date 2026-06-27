import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [
		TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
		tailwindcss(),
		react(),
		babel({ presets: [reactCompilerPreset()] }),
	],
});
