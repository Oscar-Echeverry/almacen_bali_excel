import "reflect-metadata";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import * as argon2 from "argon2";
import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities";

async function promptAdmin(): Promise<{ email: string; name: string; password: string }> {
  const emailEnv = process.env.ADMIN_EMAIL;
  const nameEnv = process.env.ADMIN_NAME;
  const passwordEnv = process.env.ADMIN_PASSWORD;
  if (emailEnv && nameEnv && passwordEnv) {
    return { email: emailEnv, name: nameEnv, password: passwordEnv };
  }
  const rl = createInterface({ input, output });
  try {
    const email = await rl.question("Admin email: ");
    const name = await rl.question("Admin name: ");
    const password = await rl.question("Admin password: ");
    return { email, name, password };
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const data = await promptAdmin();
  if (data.password.length < 12) {
    throw new Error("Admin password must be at least 12 characters");
  }
  await AppDataSource.initialize();
  const users = AppDataSource.getRepository(User);
  const email = data.email.trim().toLowerCase();
  const existing = await users.findOne({ where: { email } });
  if (existing) {
    throw new Error("Admin already exists with that email");
  }
  await users.save(users.create({
    email,
    name: data.name.trim(),
    role: "ADMIN",
    active: true,
    passwordHash: await argon2.hash(data.password, { type: argon2.argon2id }),
    mfaEnabled: false
  }));
  await AppDataSource.destroy();
  process.stdout.write("Admin created.\n");
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
