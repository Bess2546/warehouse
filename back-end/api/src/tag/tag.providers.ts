// src/tag/tag.providers.ts
import { MongoClient } from 'mongodb';

export const tagProviders = [
  {
    provide: 'DATABASE_CONNECTION',
    useFactory: async () => {
      const client = await MongoClient.connect('mongodb://localhost:27017');
      return client.db('testdb');   // เปลี่ยนชื่อ db ตามของคุณ
    },
  },
  {
    provide: 'TAG_COLLECTION',
    useFactory: (db: any) => db.collection('tags'),
    inject: ['DATABASE_CONNECTION'],
  },
];
