/**
 * First-admin setup command (US-11, FR-018).
 *
 * Usage:
 *
 *   pnpm auth:create-first-admin --name "Ana Pérez" --email ana@example.com [--debug]
 *
 * `--debug` prints the full details of an unexpected error. The command then asks for the password twice, with hidden input.
 *
 * Why it exists: nobody can log in until an admin exists, and admins are the
 * only ones who can create users. This command creates that very first admin.
 *
 * What it guarantees:
 * - It only works when no admin exists yet; otherwise it refuses, changes
 *   nothing and exits with a non-zero code (BR-014, AC-11.2).
 * - The password is never echoed, printed or logged (AC-11.3).
 * - The admin starts with a temporary password and must change it at first
 *   login (AC-11.1).
 *
 * It runs with `tsx --conditions=react-server` so the `server-only` imports
 * inside the container resolve outside Next.js.
 */

import { Writable } from "node:stream";
import * as readline from "node:readline";
import { parseArgs } from "node:util";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import { AppError } from "@/shared/errors/app-error";
import {
  EmailAlreadyInUseError,
  FirstAdminAlreadyExistsError,
  PasswordPolicyError,
} from "@/modules/users/domain/errors";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/modules/users/domain/password-policy";

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

const USAGE = `Usage: pnpm auth:create-first-admin --name "Ana Pérez" --email ana@example.com [--debug]

Creates the first admin of the system. You will be asked for the password
twice (the input is hidden). It must have between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.

Options:
  --name     Full name of the admin (required)
  --email    Email of the admin (required)
  --debug    Print the full details of an unexpected error
  -h, --help Show this help`;

const argumentsSchema = z.object({
  name: z.string().trim().min(1, "--name is required and must not be empty."),
  email: z.email("--email must be a valid email address."),
  debug: z.boolean().default(false),
});

type FirstAdminArguments = z.infer<typeof argumentsSchema>;

/** Thrown when the operator types something we cannot use; the message is safe to print. */
class InvalidInputError extends Error {
  /** True for command-line mistakes, where reminding the usage helps. */
  public readonly showUsage: boolean;

  constructor(message: string, options: { showUsage: boolean }) {
    super(message);
    this.showUsage = options.showUsage;
  }
}

/**
 * Set from `--debug` as soon as the arguments are read, so the error handler
 * at the bottom knows whether to print the full unexpected error.
 */
let isDebugEnabled = false;

async function main(): Promise<number> {
  const commandArguments = readArguments();
  if (commandArguments === "help") {
    console.log(USAGE);
    return EXIT_SUCCESS;
  }
  isDebugEnabled = commandArguments.debug;

  const password = await askPasswordTwice();

  // Load `.env.local` BEFORE importing the container: `@/shared/config/env`
  // validates the environment as soon as it is imported. A static import
  // would run before this line, so the container is imported dynamically.
  // Variables already set in the shell win over the file.
  loadDotenv({ path: ".env.local", quiet: true });
  const { createFirstAdmin } = await import("@/server/container");

  const admin = await createFirstAdmin({ name: commandArguments.name, email: commandArguments.email, password });
  console.log(`First admin created: ${admin.email}. They must change the password at first login.`);
  return EXIT_SUCCESS;
}

/** Reads `--name`, `--email` and `--debug` from the command line, or "help" when `--help` was given. */
function readArguments(): FirstAdminArguments | "help" {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        name: { type: "string" },
        email: { type: "string" },
        debug: { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (error) {
    // e.g. an unknown option such as `--password`.
    const message = error instanceof Error ? error.message : "Invalid arguments.";
    throw new InvalidInputError(message, { showUsage: true });
  }

  if (parsed.values.help) {
    return "help";
  }

  const result = argumentsSchema.safeParse(parsed.values);
  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message).join("\n");
    throw new InvalidInputError(messages, { showUsage: true });
  }
  return result.data;
}

/** Asks for the password and its confirmation; throws when they differ. */
async function askPasswordTwice(): Promise<string> {
  const prompter = createHiddenPrompter();
  try {
    const password = await prompter.ask("Password: ");
    const confirmation = await prompter.ask("Repeat the password: ");
    if (password !== confirmation) {
      throw new InvalidInputError("The passwords do not match. Nothing was created.", {
        showUsage: false,
      });
    }
    return password;
  } finally {
    prompter.close();
  }
}

type HiddenPrompter = {
  ask(question: string): Promise<string>;
  close(): void;
};

/**
 * Reads lines from stdin without echoing what is typed.
 *
 * How: readline writes the typed characters to its output stream, so we give
 * it an output that drops everything while the user types. The question
 * itself is written straight to stdout.
 *
 * One readline interface is reused for every question and lines are read
 * through its async iterator, which buffers them. That way piped input
 * (`printf 'pass\npass\n' | pnpm …`, no TTY) also works: both lines may
 * arrive at once and none is lost.
 */
function createHiddenPrompter(): HiddenPrompter {
  const silentOutput = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const lineReader = readline.createInterface({
    input: process.stdin,
    output: silentOutput,
    terminal: process.stdin.isTTY === true,
  });
  const lines = lineReader[Symbol.asyncIterator]();

  return {
    async ask(question: string): Promise<string> {
      process.stdout.write(question);
      const next = await lines.next();
      process.stdout.write("\n");
      if (next.done) {
        // Ctrl+C / Ctrl+D or the piped input ended early.
        throw new InvalidInputError("No password was entered. Nothing was created.", {
          showUsage: false,
        });
      }
      return next.value;
    },
    close(): void {
      lineReader.close();
    },
  };
}

/**
 * Turns any error into a safe message for the operator.
 * Only our own errors show their text; unknown errors could contain
 * connection strings or other secrets, so they get a generic line.
 */
function describeError(error: unknown): string {
  if (error instanceof InvalidInputError) {
    return error.showUsage ? `${error.message}\n\n${USAGE}` : error.message;
  }
  if (error instanceof FirstAdminAlreadyExistsError) {
    return "An admin already exists. Create more users from the Users screen.";
  }
  if (error instanceof PasswordPolicyError) {
    return `The password must have between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters. Nothing was created.`;
  }
  if (error instanceof EmailAlreadyInUseError) {
    return "A user with this email already exists. Nothing was created.";
  }
  if (error instanceof AppError) {
    return error.message;
  }
  if (isInvalidEnvironmentError(error)) {
    // Safe to show: it lists variable names and rules, never their values.
    return `${error.message}\n\nNothing was created. Copy .env.example to .env.local and fill it in.`;
  }
  return "Unexpected error: the first admin was not created. Run it again with --debug to see the details.";
}

/**
 * True for the error `src/shared/config/env.ts` throws when `.env.local` is
 * missing or incomplete. Matched by name (the string must stay equal to
 * `INVALID_ENVIRONMENT_ERROR_NAME` there): importing that file to get the
 * constant would run the validation before `.env.local` is loaded.
 */
function isInvalidEnvironmentError(error: unknown): error is Error {
  return error instanceof Error && error.name === "InvalidEnvironmentError";
}

main()
  .catch((error: unknown) => {
    console.error(describeError(error));
    if (isDebugEnabled && !(error instanceof AppError) && !(error instanceof InvalidInputError)) {
      console.error(error);
    }
    return EXIT_FAILURE;
  })
  .then((exitCode) => {
    // Exit explicitly: the Postgres connection pool keeps the event loop
    // alive, so without this the command would never finish.
    process.exit(exitCode);
  });
