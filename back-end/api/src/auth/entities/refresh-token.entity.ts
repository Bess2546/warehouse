// src/auth/entities/refresh-token.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn} from "typeorm";
import { User } from "../../users/entities/user.entity";

@Entity('refresh_tokens')
export class RefreshToken{
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'user_id'})
    userId: number;

    @ManyToOne(() => User, {onDelete: 'CASCADE'})
    @JoinColumn({ name: 'user_id'})
    user: User;

    @Column({ name: 'token_hash', length: 255})
    tokenHash: string;

    @Column({ name: 'expires_at', type: 'timestamp'})
    expiresAt: Date;    

    @CreateDateColumn({ name: 'created_at'})
    createdAt: Date;    

    @Column({ default: false})
    revoked: boolean;

    @Column({ name: 'device_info', type:'text', nullable: true })
    deviceInfo: string | null;

}