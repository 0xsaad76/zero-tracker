import {DARK_THEME_VARIANTS, isDarkThemeVariant, resolveDarkColors} from '../src/context/ThemeContext';

describe('dark theme variants', () => {
  it('keeps the legacy accent as classic on a charcoal ramp', () => {
    expect(resolveDarkColors('classic')).toMatchObject({
      primaryBackground: '#212121',
      primaryText: '#ECECEC',
      accentGreen: '#B1FB98',
      buttonText: '#000000',
    });
  });

  it('resolves a complete palette per variant', () => {
    for (const variant of DARK_THEME_VARIANTS) {
      const colors = resolveDarkColors(variant.id);
      for (const key of [
        'primaryBackground',
        'primaryText',
        'secondaryText',
        'accentGreen',
        'buttonText',
        'containerColor',
        'cardBackground',
        'accentRed',
      ] as const) {
        expect(typeof colors[key]).toBe('string');
      }
    }
    expect(resolveDarkColors('midnight').accentGreen).toBe('#5B8DEF');
    expect(resolveDarkColors('ghost').accentGreen).toBe('#E8E8E8');
    expect(resolveDarkColors('ghost').primaryBackground).toBe('#1A1A1A');
  });

  it('rejects unknown persisted variants', () => {
    expect(isDarkThemeVariant('midnight')).toBe(true);
    expect(isDarkThemeVariant('ember')).toBe(false);
    expect(isDarkThemeVariant('neon')).toBe(false);
    expect(isDarkThemeVariant(undefined)).toBe(false);
  });
});
