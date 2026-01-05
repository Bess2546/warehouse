// src/common/mongo.service.ts
import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { MongoClient, Db } from "mongodb";
import { resolve } from "path";

@Injectable()
export class MongoService implements OnModuleInit {
    private readonly logger = new Logger(MongoService.name);
    private client: MongoClient;
    private database: Db;
    private isConnected = false;

    async onModuleInit() {
        await this.connect();
    }

    private async connect(){
        const mongoUrl = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
        const dbName = process.env.MONGO_DB || 'AssetTag';

        try {
            this.client = new MongoClient(mongoUrl);
            await this.client.connect();
            this.database = this.client.db(dbName);
            this.isConnected = true;
            this.logger.log('MongoDB connected successfully');
        } catch (err) {
            this.logger.error('MOngoDB connection error:', err);
            throw err;
        }
    }

    getDb(): Db | null {
        return this.database || null;
    }

    isReady(): boolean{
        return this.isConnected && !!this.database;
    }

    async waitForConnection(maxRetries = 10): Promise<boolean> {
        for (let i  = 0; i < maxRetries; i++){
            if (this.isReady()) return true;
            this.logger.debug(`Waiting for MongoDB... ${i + 1}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        return false;
    }
}