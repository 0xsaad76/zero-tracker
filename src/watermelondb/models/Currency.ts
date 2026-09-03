import {Model, type Relation} from '@nozbe/watermelondb';
import {text, immutableRelation} from '@nozbe/watermelondb/decorators';
import type User from './User';

export default class Currency extends Model {
  static table = 'currencies';

  static associations = {
    users: {type: 'belongs_to' as const, key: 'user_id'},
  };

  @text('code') code!: string;
  @text('symbol') symbol!: string;
  @text('name') name!: string;
  @text('user_id') userId!: string;

  @immutableRelation('users', 'user_id') user!: Relation<User>;
}
