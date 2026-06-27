import { z } from "zod";

export const loginSchema = z.object({
	email: z
		.email("Please enter a valid email address.")
		.min(1, "Email is required."),
	password: z.string().min(8, "Password is required.").max(40),
});

export const signupSchema = z
	.object({
		name: z.string().min(1, "Name is required."),
		email: z
			.email("Please enter a valid email address.")
			.min(1, "Email is required."),
		password: z
			.string()
			.min(8, "Password must be at least 8 characters.")
			.max(40, "Password must be at most 40 characters."),
		confirmPassword: z
			.string()
			.min(8, "Password must be at least 8 characters.")
			.max(40, "Password must be at most 40 characters."),
	})
	.superRefine(({ password, confirmPassword }, ctx) => {
		if (password !== confirmPassword) {
			ctx.addIssue({
				code: "custom",
				message: "Passwords do not match.",
				path: ["confirmPassword"],
			});
		}
	});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
