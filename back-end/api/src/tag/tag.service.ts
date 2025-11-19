// src/tag/tag.service.ts
import { Injectable } from '@nestjs/common';
import { MongoClient } from 'mongodb';

@Injectable()
export class TagService {
  private db: any;

  constructor() {
    const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
    const dbName   = process.env.MONGO_DB   || 'warehouse';

    const mongo = new MongoClient(mongoUrl);

    mongo.connect().then(() => {
      this.db = mongo.db(dbName);
      console.log('[TagService] MongoDB ready');
    }).catch(err => {
      console.error('[TagService] Mongo error:', err);
    });
  }

  async getActiveTags() {
    return this.db.collection('tag_state')
      .find({ present: true })
      .toArray();
  }

  async getEvents() {
    return this.db.collection('tag_events')
      .find({})
      .sort({ ts: -1 })
      .limit(50)
      .toArray();
  }
}
