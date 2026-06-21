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
import { signUp } from "@/lib/auth-client";
import { type SignupInput, signupSchema } from "@/lib/schemas";

export const Route = createFileRoute("/signup")({
	component: SignupPage,
});

function SignupPage() {
	const navigate = useNavigate();
	const [serverError, setServerError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			name: "",
			email: "",
			password: "",
			confirmPassword: "",
		} as SignupInput,

		validators: {
			onSubmit: signupSchema,
		},

		onSubmit: async ({ value }) => {
			setServerError(null);
			const { error } = await signUp.email({
				name: value.name,
				email: value.email,
				password: value.password,
			});
			if (error) {
				setServerError(
					error.message ?? "Something went wrong. Please try again.",
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
						Create your account
					</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Get started</CardTitle>
						<CardDescription>
							Fill in the details below to create your account.
						</CardDescription>
					</CardHeader>

					<CardContent>
						<form
							id="signup-form"
							onSubmit={(e) => {
								e.preventDefault();
								e.stopPropagation();
								form.handleSubmit();
							}}
						>
							<FieldGroup>
								{/* Full name */}
								<form.Field name="name">
									{(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid;
										return (
											<Field data-invalid={isInvalid}>
												<FieldLabel htmlFor={field.name}>Full name</FieldLabel>
												<Input
													id={field.name}
													type="text"
													placeholder="Jane Doe"
													autoComplete="name"
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
												<FieldLabel htmlFor={field.name}>Password</FieldLabel>
												<Input
													id={field.name}
													type="password"
													placeholder="••••••••"
													autoComplete="new-password"
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

								{/* Confirm password */}
								<form.Field name="confirmPassword">
									{(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid;
										return (
											<Field data-invalid={isInvalid}>
												<FieldLabel htmlFor={field.name}>
													Confirm password
												</FieldLabel>
												<Input
													id={field.name}
													type="password"
													placeholder="••••••••"
													autoComplete="new-password"
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
								form="signup-form"
								disabled={form.state.isSubmitting}
							>
								{form.state.isSubmitting && (
									<LoaderCircleIcon
										data-icon="inline-start"
										className="animate-spin"
									/>
								)}
								{form.state.isSubmitting
									? "Creating account…"
									: "Create account"}
							</Button>
						</Field>
						<FieldSeparator>or</FieldSeparator>
						<p className="text-center text-sm text-muted-foreground">
							Already have an account?{" "}
							<Link
								to="/login"
								className="font-medium text-foreground underline-offset-4 hover:underline"
							>
								Sign in
							</Link>
						</p>
					</CardFooter>
				</Card>
			</div>
		</main>
	);
}
