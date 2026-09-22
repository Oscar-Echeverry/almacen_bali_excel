import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as argon2 from "argon2";
import { Repository } from "typeorm";
import { ErrorCodeException } from "../common/error-code.exception";
import { User } from "../database/entities";
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from "./dto";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>
  ) {}

  list(): Promise<User[]> {
    return this.users.find({ order: { createdAt: "DESC" } });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      throw new ErrorCodeException("AUTH_INVALID", "No se pudo crear el usuario.", HttpStatus.CONFLICT);
    }
    return this.users.save(this.users.create({
      email,
      name: dto.name.trim(),
      role: dto.role,
      active: true,
      passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
      mustChangePassword: dto.role === "EMPLOYEE"
    }));
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.mustFind(id);
    if (dto.name !== undefined) {
      user.name = dto.name.trim();
    }
    if (dto.active !== undefined) {
      user.active = dto.active;
    }
    if (dto.mfaEnabled !== undefined) {
      user.mfaEnabled = dto.mfaEnabled;
      if (!dto.mfaEnabled) {
        user.mfaSecretEncrypted = null;
      }
    }
    return this.users.save(user);
  }

  async resetPassword(id: string, dto: ResetPasswordDto): Promise<User> {
    const user = await this.mustFind(id);
    user.passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    user.mustChangePassword = dto.mustChangePassword ?? true;
    user.failedLoginCount = 0;
    user.lockedUntil = null;
    return this.users.save(user);
  }

  private async mustFind(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      throw new ErrorCodeException("AUTH_INVALID", "Usuario no encontrado.", HttpStatus.NOT_FOUND);
    }
    return user;
  }
}
