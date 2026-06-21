import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoaderCircleIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth-client";
import { type LoginInput, loginSchema } from "@/lib/schemas";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	const navigate = useNavigate();
	const [serverError, setServerError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		} as LoginInput,

		validators: {
			onSubmit: loginSchema,
		},

		onSubmit: async ({ value }) => {
			setServerError(null);
			const { error } = await signIn.email({
				email: value.email,
				password: value.password,
			});
			if (error) {
				setServerError(
					error.message ?? "Invalid credentials. Please try again.",
				);
			} else {
				await navigate({ to: "/" });
			}
		},
	});

	return (
		<main className="flex min-h-svh items-center justify-center bg-background p-4">
			<div className="w-full max-w-sm">
				{/* Brand */}
				<div className="mb-6 text-center">
					<h1 className="text-2xl font-semibold tracking-tight">Watchtower</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Sign in to your account
					</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Welcome back</CardTitle>
						<CardDescription>
							Enter your credentials to continue.
						</CardDescription>
					</CardHeader>

					<CardContent>
						<form
							id="login-form"
							onSubmit={(e) => {
								e.preventDefault();
								e.stopPropagation();
								form.handleSubmit();
							}}
						>
							<FieldGroup>
								{/* Email */}
								<form.Field name="email">
									{(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid;
										return (
											<Field data-invalid={isInvalid}>
												<FieldLabel htmlFor={field.name}>Email</FieldLabel>
												<Input
													id={field.name}
													type="email"
													placeholder="you@example.com"
													autoComplete="email"
													name={field.name}
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													aria-invalid={isInvalid}
													disabled={form.state.isSubmitting}
												/>
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</Field>
										);
									}}
								</form.Field>

								{/* Password */}
								<form.Field name="password">
									{(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid;
										return (
											<Field data-invalid={isInvalid}>
												<div className="flex items-center justify-between">
													<FieldLabel htmlFor={field.name}>Password</FieldLabel>
													<a
														href="/forgot-password"
														className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
													>
														Forgot password?
													</a>
												</div>
												<Input
													id={field.name}
													type="password"
													placeholder="••••••••"
													autoComplete="current-password"
													name={field.name}
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													aria-invalid={isInvalid}
													disabled={form.state.isSubmitting}
												/>
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</Field>
										);
									}}
								</form.Field>

								{/* Server error */}
								{serverError && (
									<p
										role="alert"
										className="text-sm font-normal text-destructive"
									>
										{serverError}
									</p>
								)}
							</FieldGroup>
						</form>
					</CardContent>

					<CardFooter className="flex-col gap-4">
						<Field
							orientation="horizontal"
							className="w-full justify-end gap-2"
						>
							<Button
								type="button"
								variant="outline"
								onClick={() => form.reset()}
								disabled={form.state.isSubmitting}
							>
								Reset
							</Button>
							<Button
								type="submit"
								form="login-form"
								disabled={form.state.isSubmitting}
							>
								{form.state.isSubmitting && (
									<LoaderCircleIcon
										data-icon="inline-start"
										className="animate-spin"
									/>
								)}
								{form.state.isSubmitting ? "Signing in…" : "Sign in"}
							</Button>
						</Field>
						<FieldSeparator>or</FieldSeparator>
						<p className="text-center text-sm text-muted-foreground">
							Don&apos;t have an account?{" "}
							<Link
								to="/signup"
								className="font-medium text-foreground underline-offset-4 hover:underline"
							>
								Sign up
							</Link>
						</p>
					</CardFooter>
				</Card>
			</div>
		</main>
	);
}
