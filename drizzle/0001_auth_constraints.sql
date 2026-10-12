-- Hand-written: constraints the Better Auth schema generator does not produce (plan §6.3).
-- Only two roles exist (spec §8).
ALTER TABLE "user" ADD CONSTRAINT "user_role_check" CHECK ("role" IN ('admin', 'agent'));--> statement-breakpoint
-- BR-001: emails are unique case-insensitively. The app stores them in lower case;
-- this index is defense in depth if a mixed-case email ever slips through.
CREATE UNIQUE INDEX "user_email_lower_unique" ON "user" (lower("email"));
