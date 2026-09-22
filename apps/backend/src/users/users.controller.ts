import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { User } from "../database/entities";
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from "./dto";
import { UsersService } from "./users.service";

@UseGuards(AuthGuard)
@Roles("ADMIN")
@Controller("admin/users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(): Promise<User[]> {
    return this.users.list();
  }

  @Post()
  create(@Body() dto: CreateUserDto): Promise<User> {
    return this.users.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateUserDto): Promise<User> {
    return this.users.update(id, dto);
  }

  @Post(":id/reset-password")
  resetPassword(@Param("id") id: string, @Body() dto: ResetPasswordDto): Promise<User> {
    return this.users.resetPassword(id, dto);
  }
}
