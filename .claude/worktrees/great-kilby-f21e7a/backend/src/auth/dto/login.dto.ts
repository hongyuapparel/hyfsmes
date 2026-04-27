import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator'

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: '请输入用户名' })
  @MinLength(1, { message: '用户名不能为空' })
  @MaxLength(64, { message: '用户名过长' })
  username!: string

  @IsString()
  @IsNotEmpty({ message: '请输入密码' })
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(128, { message: '密码过长' })
  password!: string
}
