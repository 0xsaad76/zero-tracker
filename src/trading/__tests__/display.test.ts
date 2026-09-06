import {createTradingFormatter, createTradingPriceFormatter} from '../display';

it('formats journal amounts with the lens currency', () => {
  expect(createTradingFormatter('USD')(100)).toContain('$100');
  expect(createTradingFormatter('INR')(100)).toContain('10,500');
});

it('keeps up to 8 decimals on average prices', () => {
  expect(createTradingPriceFormatter('INR')(3833.21)).toContain('4,02,487');
  expect(createTradingPriceFormatter('USD')(0.00001234)).toContain('0.00001234');
  expect(createTradingPriceFormatter('USD')(100)).toContain('$100');
});
