import {z} from 'zod';
import {defaultInvestmentTypes, investmentBackupSchema, investmentTypeSchema} from '../../investments/model';
import {
  defaultTradingPairs,
  defaultTradingStrategies,
  tradeBackupSchema,
  tradingBalanceSchema,
  tradingPairSchema,
  tradingStrategySchema,
} from '../../trading/model';

const userSchema = z.object({
  username: z.string(),
  email: z.string(),
});

const categorySchema = z.object({
  name: z.string(),
  categoryStatus: z.boolean().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

const expenseSchema = z.object({
  title: z.string(),
  amount: z.number(),
  description: z.string().optional(),
  category: z.object({name: z.string()}),
  date: z.string(),
});

const currencySchema = z.object({
  code: z.string(),
  symbol: z.string(),
  name: z.string(),
});

const debtorSchema = z.object({
  title: z.string(),
  debtorStatus: z.boolean().optional(),
  icon: z.string().optional(),
  type: z.string().optional(),
  color: z.string().optional(),
});

const debtSchema = z.object({
  amount: z.number(),
  description: z.string(),
  debtor: z.object({title: z.string()}),
  date: z.string(),
  type: z.string(),
});

const budgetSchema = z.object({
  amount: z.number(),
  month: z.string(),
  budgetType: z.string(),
  category: z.object({name: z.string()}).optional(),
});

const investmentTypesSchema = z
  .array(investmentTypeSchema)
  .max(100)
  .superRefine((types, ctx) => {
    if (new Set(types.map(type => type.id)).size !== types.length) {
      ctx.addIssue({code: 'custom', message: 'Investment type IDs must be unique.'});
    }
    if (new Set(types.map(type => type.name.toLowerCase())).size !== types.length) {
      ctx.addIssue({code: 'custom', message: 'Investment type names must be unique.'});
    }
  });

const tradingStrategyListSchema = z
  .array(tradingStrategySchema)
  .max(100)
  .superRefine((strategies, ctx) => {
    if (new Set(strategies.map(strategy => strategy.id)).size !== strategies.length) {
      ctx.addIssue({code: 'custom', message: 'Strategy IDs must be unique.'});
    }
    if (new Set(strategies.map(strategy => strategy.name.toLowerCase())).size !== strategies.length) {
      ctx.addIssue({code: 'custom', message: 'Strategy names must be unique.'});
    }
  });

const tradingPairListSchema = z
  .array(tradingPairSchema)
  .max(100)
  .superRefine((pairs, ctx) => {
    if (new Set(pairs.map(pair => pair.id)).size !== pairs.length) {
      ctx.addIssue({code: 'custom', message: 'Pair IDs must be unique.'});
    }
    if (new Set(pairs.map(pair => pair.name.toLowerCase())).size !== pairs.length) {
      ctx.addIssue({code: 'custom', message: 'Pair names must be unique.'});
    }
  });

const tradingBalanceListSchema = z
  .array(tradingBalanceSchema)
  .max(1200)
  .superRefine((balances, ctx) => {
    if (new Set(balances.map(balance => balance.month)).size !== balances.length) {
      ctx.addIssue({code: 'custom', message: 'Duplicate opening balance month.'});
    }
  });

const exportDataSchema = z
  .object({
    users: z.array(userSchema).min(1),
    categories: z.array(categorySchema),
    expenses: z.array(expenseSchema),
    currencies: z.array(currencySchema),
    debtors: z.array(debtorSchema),
    debts: z.array(debtSchema),
    budgets: z.array(budgetSchema).default([]),
    investments: z.array(investmentBackupSchema).optional(),
    investmentTypes: investmentTypesSchema.optional(),
    trades: z.array(tradeBackupSchema).optional(),
    tradingStrategies: tradingStrategyListSchema.optional(),
    tradingPairs: tradingPairListSchema.optional(),
    tradingBalances: tradingBalanceListSchema.optional(),
    preferences: z
      .object({
        theme: z.enum(['system', 'light', 'dark']),
        locale: z.string().nullable(),
        weekStart: z.enum(['sunday', 'monday']),
        showBudgetProgress: z.boolean(),
        tradingCurrency: z.enum(['USD', 'INR']).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const typeIds = new Set((data.investmentTypes ?? defaultInvestmentTypes).map(type => type.id));
    data.investments?.forEach((investment, index) => {
      if (investment.type && !typeIds.has(investment.type)) {
        ctx.addIssue({
          code: 'custom',
          path: ['investments', index, 'type'],
          message: 'Investment type is missing from investmentTypes.',
        });
      }
    });
    const strategyIds = new Set((data.tradingStrategies ?? defaultTradingStrategies).map(strategy => strategy.id));
    const pairIds = new Set((data.tradingPairs ?? defaultTradingPairs).map(pair => pair.id));
    data.trades?.forEach((trade, index) => {
      if (!strategyIds.has(trade.strategy)) {
        ctx.addIssue({
          code: 'custom',
          path: ['trades', index, 'strategy'],
          message: 'Trade strategy is missing from tradingStrategies.',
        });
      }
      if (!pairIds.has(trade.pair)) {
        ctx.addIssue({
          code: 'custom',
          path: ['trades', index, 'pair'],
          message: 'Trade pair is missing from tradingPairs.',
        });
      }
    });
  });

const exportEnvelopeSchema = z.object({
  key: z.string(),
  version: z.number().optional(),
  data: exportDataSchema,
});

export type ExportData = z.infer<typeof exportDataSchema>;
export type ExportEnvelope = z.infer<typeof exportEnvelopeSchema>;

export interface ValidationResult {
  success: boolean;
  data?: ExportEnvelope;
  error?: string;
}

/**
 * Validates the structure of an import file before processing.
 * Returns a typed result to avoid exceptions during import.
 */
export const validateExportEnvelope = (json: unknown): ValidationResult => {
  const result = exportEnvelopeSchema.safeParse(json);
  if (result.success) {
    return {success: true, data: result.data};
  }

  const firstIssue = result.error.issues[0];
  const path = firstIssue?.path?.join('.') || '';
  const message = firstIssue?.message || 'Unknown validation error';
  return {
    success: false,
    error: path ? `Invalid field "${path}": ${message}` : message,
  };
};
