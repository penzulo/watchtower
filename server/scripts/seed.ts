import { auth } from "@watchtower/server/auth";

async function seed() {
	console.log("🌱 Seeding database...");

	const email = "admin@watchtower.local";
	const password = "password123";
	const name = "Admin User";

	try {
		// Better Auth allows invoking its APIs directly on the server
		// We mock the Request object as it's required by the underlying API
		const _request = new Request(
			"http://localhost:3000/api/auth/sign-up/email",
			{
				method: "POST",
			},
		);

		const result = await auth.api.signUpEmail({
			body: {
				email,
				password,
				name,
			},
			asResponse: false,
		});

		console.log("✅ Seed complete!");
		console.log(`👤 User created: ${result.user.email}`);
		console.log(`🔑 Password: ${password}`);
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.includes("User already exists")
		) {
			console.log("⚠️ User already exists. Skipping seed.");
		} else {
			console.error("❌ Failed to seed database:", error);
		}
	}

	process.exit(0);
}

seed();
