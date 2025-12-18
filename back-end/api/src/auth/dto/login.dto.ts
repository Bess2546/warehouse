// src/auth/dto/login.dto.ts
import {IsNotEmpty, IsString} from 'class-validator'

export class LoginDto{
    @IsNotEmpty({message: 'Enter Username'})
    @IsString()
    username: string;

    @IsNotEmpty({ message: 'Enter password'})
    @IsString()
    password: string;
}