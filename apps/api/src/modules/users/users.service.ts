import { Injectable } from '@nestjs/common';
import type { User, UserRole } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(input: {
    email: string;
    displayName: string;
    passwordHash: string;
    role?: UserRole;
  }): Promise<User> {
    return this.prisma.user.create({ data: input });
  }
}
