import "reflect-metadata";
import * as argon2 from "argon2";
import { AppDataSource } from "../src/database/data-source";
import { Device, User } from "../src/database/entities";

async function upsertUser(email: string, name: string, role: "ADMIN" | "EMPLOYEE", password: string): Promise<User> {
  const users = AppDataSource.getRepository(User);
  const existing = await users.findOne({ where: { email } });
  if (existing) {
    return existing;
  }
  return users.save(users.create({
    email,
    name,
    role,
    active: true,
    passwordHash: await argon2.hash(password, { type: argon2.argon2id })
  }));
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed development users in production");
  }
  await AppDataSource.initialize();
  await upsertUser("admin@example.local", "Admin Local", "ADMIN", "ChangeMeAdmin123!");
  const employee = await upsertUser("employee@example.local", "Employee Local", "EMPLOYEE", "ChangeMeEmployee123!");
  const devices = AppDataSource.getRepository(Device);
  const existingDevice = await devices.findOne({ where: { userId: employee.id, certificateFingerprint: "DEV-APPROVED" } });
  if (!existingDevice) {
    await devices.save(devices.create({
      userId: employee.id,
      name: "Development PC",
      certificateSerial: "DEV-SERIAL",
      certificateFingerprint: "DEV-APPROVED",
      certificateSubject: "CN=Development PC",
      status: "APPROVED"
    }));
  }
  await AppDataSource.destroy();
  process.stdout.write("Development seed completed.\n");
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
