# 后端架构设计规范 - NestJS + MySQL

## 一、项目结构

```
src/
├── common/
│   ├── decorators/           # 自定义装饰器
│   │   ├── roles.decorator.ts
│   │   └── auth.decorator.ts
│   ├── filters/              # 全局异常过滤器
│   │   ├── http-exception.filter.ts
│   │   └── all-exceptions.filter.ts
│   ├── guards/               # 守卫（认证、授权）
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── refresh.guard.ts
│   ├── interceptors/         # 拦截器
│   │   ├── logging.interceptor.ts
│   │   ├── transform.interceptor.ts
│   │   └── timeout.interceptor.ts
│   ├── pipes/                # 管道（验证）
│   │   ├── validation.pipe.ts
│   │   └── parse-int.pipe.ts
│   └── constants/            # 常量定义
│       ├── error-codes.ts
│       ├── business-rules.ts
│       └── messages.ts
│
├── modules/
│   ├── auth/                 # 认证模块
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   ├── jwt.strategy.ts
│   │   ├── local.strategy.ts
│   │   ├── dtos/
│   │   │   ├── login.dto.ts
│   │   │   ├── register.dto.ts
│   │   │   └── refresh.dto.ts
│   │   └── auth.module.ts
│   │
│   ├── users/                # 用户管理模块
│   │   ├── users.service.ts
│   │   ├── users.controller.ts
│   │   ├── user.entity.ts
│   │   ├── dtos/
│   │   │   ├── create-user.dto.ts
│   │   │   ├── update-user.dto.ts
│   │   │   └── user-response.dto.ts
│   │   └── users.module.ts
│   │
│   ├── rbac/                 # 角色权限管理
│   │   ├── roles/
│   │   ├── permissions/
│   │   ├── rbac.service.ts
│   │   └── rbac.module.ts
│   │
│   ├── products/             # 产品管理模块
│   │   ├── products.service.ts
│   │   ├── products.controller.ts
│   │   ├── product.entity.ts
│   │   ├── dtos/
│   │   │   ├── create-product.dto.ts
│   │   │   ├── update-product.dto.ts
│   │   │   └── product-query.dto.ts
│   │   └── products.module.ts
│   │
│   ├── orders/               # 订单管理模块
│   │   ├── orders.service.ts
│   │   ├── orders.controller.ts
│   │   ├── order.entity.ts
│   │   ├── order-items/
│   │   ├── dtos/
│   │   │   ├── create-order.dto.ts
│   │   │   ├── update-order.dto.ts
│   │   │   └── order-query.dto.ts
│   │   └── orders.module.ts
│   │
│   ├── production/           # 生产计划模块
│   │   ├── production-plans.service.ts
│   │   ├── production-plans.controller.ts
│   │   ├── production-plan.entity.ts
│   │   ├── dtos/
│   │   │   ├── create-production-plan.dto.ts
│   │   │   └── update-production-plan.dto.ts
│   │   └── production.module.ts
│   │
│   ├── inventory/            # 库存管理模块
│   │   ├── inventory.service.ts
│   │   ├── inventory.controller.ts
│   │   ├── inventory.entity.ts
│   │   └── inventory.module.ts
│   │
│   ├── reports/              # 报表模块
│   │   ├── reports.service.ts
│   │   ├── reports.controller.ts
│   │   └── reports.module.ts
│   │
│   └── audit/                # 审计日志模块
│       ├── audit.service.ts
│       ├── audit-log.entity.ts
│       └── audit.module.ts
│
├── database/
│   ├── migrations/           # 数据库迁移
│   ├── seeders/              # 数据库填充
│   ├── schema.sql            # 数据库初始化脚本
│   └── data-source.ts        # 数据源配置
│
├── config/
│   ├── app.config.ts         # 应用配置
│   ├── database.config.ts    # 数据库配置
│   ├── jwt.config.ts         # JWT 配置
│   ├── logger.config.ts      # 日志配置
│   └── env.validation.ts     # 环境变量验证
│
├── utils/
│   ├── helpers/              # 辅助函数
│   ├── validators/           # 验证器
│   ├── formatters/           # 格式化器
│   └── encryption.ts         # 加密工具
│
├── app.module.ts             # 主应用模块
├── app.service.ts
├── app.controller.ts
└── main.ts                   # 应用入口
```

---

## 二、核心模块 - 认证模块示例

### 1. Entity 定义

```typescript
// src/modules/users/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  ManyToMany,
  JoinTable,
} from 'typeorm'
import * as bcrypt from 'bcrypt'
import { Role } from '../rbac/entities/role.entity'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true })
  username: string

  @Column({ unique: true })
  email: string

  @Column()
  password: string

  @Column({ default: true })
  isActive: boolean

  @Column({ nullable: true })
  lastLoginAt: Date

  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable()
  roles: Role[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @BeforeInsert()
  async hashPassword() {
    this.password = await bcrypt.hash(this.password, 10)
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password)
  }

  toJSON() {
    const { password, ...result } = this
    return result
  }
}
```

### 2. DTO 定义

```typescript
// src/modules/auth/dtos/login.dto.ts
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator'

export class LoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username: string

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password: string
}

// src/modules/auth/dtos/register.dto.ts
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator'

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username: string

  @IsEmail()
  email: string

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password: string
}

// src/modules/auth/dtos/refresh.dto.ts
export class RefreshTokenDto {
  @IsString()
  refreshToken: string
}
```

### 3. Service 层

```typescript
// src/modules/auth/auth.service.ts
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UsersService } from '../users/users.service'
import { LoginDto } from './dtos/login.dto'
import { RegisterDto } from './dtos/register.dto'

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByUsername(dto.username)
    if (existingUser) {
      throw new ConflictException('用户名已存在')
    }

    const user = await this.usersService.create(dto)
    return {
      id: user.id,
      username: user.username,
      email: user.email,
    }
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByUsername(dto.username)
    if (!user || !(await user.validatePassword(dto.password))) {
      throw new UnauthorizedException('用户名或密码错误')
    }

    if (!user.isActive) {
      throw new UnauthorizedException('账户已禁用')
    }

    const { accessToken, refreshToken } = await this.generateTokens(user)

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    }
  }

  private async generateTokens(user: any) {
    const payload = {
      sub: user.id,
      username: user.username,
      roles: user.roles?.map((r) => r.name) || [],
    }

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    })

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    })

    return { accessToken, refreshToken }
  }

  async validateUser(payload: any) {
    return this.usersService.findById(payload.sub)
  }
}
```

### 4. Controller 层

```typescript
// src/modules/auth/auth.controller.ts
import { Controller, Post, Body, UseGuards, Get, Req } from '@nestjs/common'
import { AuthService } from './auth.service'
import { LoginDto } from './dtos/login.dto'
import { RegisterDto } from './dtos/register.dto'
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard'

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto)
    return {
      code: 0,
      message: '注册成功',
      data: user,
    }
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto)
    return {
      code: 0,
      message: '登录成功',
      data: result,
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Req() req) {
    return {
      code: 0,
      message: '获取成功',
      data: req.user,
    }
  }
}
```

---

## 三、数据库设计

### 1. 用户表

```sql
CREATE TABLE users (
  id CHAR(36) NOT NULL PRIMARY KEY COMMENT '用户ID',
  username VARCHAR(20) NOT NULL UNIQUE COMMENT '用户名',
  email VARCHAR(100) NOT NULL UNIQUE COMMENT '邮箱',
  password VARCHAR(255) NOT NULL COMMENT '密码哈希',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
  last_login_at DATETIME COMMENT '最后登录时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_username ON users(username);
CREATE INDEX idx_email ON users(email);
```

### 2. 角色表

```sql
CREATE TABLE roles (
  id CHAR(36) NOT NULL PRIMARY KEY COMMENT '角色ID',
  name VARCHAR(50) NOT NULL UNIQUE COMMENT '角色名称',
  description VARCHAR(255) COMMENT '角色描述',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3. 权限表

```sql
CREATE TABLE permissions (
  id CHAR(36) NOT NULL PRIMARY KEY COMMENT '权限ID',
  name VARCHAR(100) NOT NULL UNIQUE COMMENT '权限名称',
  description VARCHAR(255) COMMENT '权限描述',
  resource VARCHAR(50) COMMENT '资源',
  action VARCHAR(50) COMMENT '操作',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 4. 用户角色关联表

```sql
CREATE TABLE user_roles (
  user_id CHAR(36) NOT NULL COMMENT '用户ID',
  role_id CHAR(36) NOT NULL COMMENT '角色ID',
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 5. 角色权限关联表

```sql
CREATE TABLE role_permissions (
  role_id CHAR(36) NOT NULL COMMENT '角色ID',
  permission_id CHAR(36) NOT NULL COMMENT '权限ID',
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 四、API 响应规范

### 统一返回格式

```typescript
// src/common/interfaces/response.interface.ts
export interface ApiResponse<T = any> {
  code: number      // 0 成功，其他失败
  message: string   // 提示消息
  data?: T          // 返回数据
  timestamp?: string // 时间戳
  path?: string     // 请求路径
}
```

### 错误代码规范

```typescript
// src/common/constants/error-codes.ts
export enum ErrorCode {
  // 通用错误
  SUCCESS = 0,
  UNKNOWN_ERROR = 10000,
  PARAM_ERROR = 10001,
  PERMISSION_DENIED = 10002,

  // 认证错误
  UNAUTHORIZED = 20001,
  INVALID_TOKEN = 20002,
  TOKEN_EXPIRED = 20003,
  USER_NOT_FOUND = 20004,
  INVALID_PASSWORD = 20005,

  // 业务错误
  DUPLICATE_USERNAME = 30001,
  DUPLICATE_EMAIL = 30002,
  INVALID_STATUS = 30003,
  INSUFFICIENT_STOCK = 30004,
  ORDER_NOT_FOUND = 30005,
}
```

---

## 五、环境变量配置

```bash
# .env
NODE_ENV=development
PORT=3000
API_PREFIX=api

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=password
DB_NAME=clothing_production
DB_SYNCHRONIZE=false
DB_LOGGING=true

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRATION=900 # 15 minutes
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRATION=604800 # 7 days

# CORS
CORS_ORIGIN=http://localhost:5173

# Logger
LOG_LEVEL=debug
```

---

## 六、启动脚本

### package.json

```json
{
  "scripts": {
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "build": "nest build",
    "typeorm": "typeorm",
    "migration:create": "typeorm migration:create",
    "migration:generate": "typeorm migration:generate",
    "migration:run": "typeorm migration:run",
    "migration:revert": "typeorm migration:revert",
    "seed": "ts-node src/database/seeders/index.ts",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write \"src/**/*.ts\""
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/jwt": "^10.0.0",
    "@nestjs/passport": "^9.0.0",
    "@nestjs/typeorm": "^9.0.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.0",
    "typeorm": "^0.3.0",
    "mysql2": "^3.0.0",
    "passport": "^0.6.0",
    "passport-jwt": "^4.0.0",
    "passport-local": "^1.0.0",
    "bcrypt": "^5.1.0",
    "dotenv": "^16.0.0",
    "rxjs": "^7.8.0"
  }
}
```

---

## 七、核心守卫实现

### JWT 认证守卫

```typescript
// src/common/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

### 角色权限守卫

```typescript
// src/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler())

    if (!requiredRoles) {
      return true
    }

    const request = context.switchToHttp().getRequest()
    const user = request.user

    if (!user) {
      return false
    }

    return requiredRoles.some((role) => user.roles?.includes(role))
  }
}
```

---

## 八、快速开始

### 1. 初始化项目

```bash
npm install -g @nestjs/cli
nest new clothing-production-backend
cd clothing-production-backend

# 安装依赖
npm install typeorm mysql2 bcrypt class-validator class-transformer dotenv @nestjs/jwt @nestjs/passport passport passport-jwt passport-local
```

### 2. 生成模块

```bash
nest generate module modules/auth
nest generate service modules/auth
nest generate controller modules/auth
```

### 3. 启动开发服务器

```bash
npm run start:dev
```

---

**后端架构设计基于 NestJS 最佳实践，后续可根据需要扩展功能模块。**
