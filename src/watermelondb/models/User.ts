import {Model, Query} from '@nozbe/watermelondb';
import {text, children} from '@nozbe/watermelondb/decorators';
import type Category from './Category';
import type Expense from './Expense';
import type Debtor from './Debtor';
import type Debt from './Debt';
import type Currency from './Currency';
import type Budget from './Budget';

export default class User extends Model {
  static table = 'users';

  static associations = {
    categories: {type: 'has_many' as const, foreignKey: 'user_id'},
    expenses: {type: 'has_many' as const, foreignKey: 'user_id'},
    debtors: {type: 'has_many' as const, foreignKey: 'user_id'},
    debts: {type: 'has_many' as const, foreignKey: 'user_id'},
    currencies: {type: 'has_many' as const, foreignKey: 'user_id'},
    budgets: {type: 'has_many' as const, foreignKey: 'user_id'},
  };

  @text('username') username!: string;
  @text('email') email!: string;

  @children('categories') categories!: Query<Category>;
  @children('expenses') expenses!: Query<Expense>;
  @children('debtors') debtors!: Query<Debtor>;
  @children('debts') debts!: Query<Debt>;
  @children('currencies') currencies!: Query<Currency>;
  @children('budgets') budgets!: Query<Budget>;
}
