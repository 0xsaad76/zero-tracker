import {Model, type Relation} from '@nozbe/watermelondb';
import {text, field, immutableRelation} from '@nozbe/watermelondb/decorators';
import type User from './User';

export default class Budget extends Model {
  static table = 'budgets';

  static associations = {
    users: {type: 'belongs_to' as const, key: 'user_id'},
  };

  @text('user_id') userId!: string;
  /** Empty string means an overall limit; otherwise this owns a category limit. */
  @text('category_id') categoryId!: string;
  @field('amount') amount!: number;
  @text('month') month!: string;
  @text('budget_type') budgetType!: string;

  @immutableRelation('users', 'user_id') user!: Relation<User>;
}
