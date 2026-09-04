import React from 'react';
import {View} from 'react-native';
import {useTranslation} from 'react-i18next';
import PrimaryView from '../atoms/PrimaryView';
import PrimaryText from '../atoms/PrimaryText';
import HeaderContainer from './HeaderContainer';
import Icon from '../atoms/Icons';
import useThemeColors from '../../hooks/useThemeColors';
import {gs} from '../../styles/globalStyles';

interface FinancePlaceholderProps {
  kind: 'investing' | 'trading';
}

const FinancePlaceholder: React.FC<FinancePlaceholderProps> = ({kind}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const isInvesting = kind === 'investing';

  return (
    <PrimaryView colors={colors} useBottomPadding={false}>
      <HeaderContainer headerText={t(isInvesting ? 'futureFinance.investingTitle' : 'futureFinance.tradingTitle')} />
      <View style={[gs.flex1, gs.center, gs.px20]}>
        <View style={[gs.size60, gs.rounded18, gs.center, {backgroundColor: colors.secondaryAccent}]}>
          <Icon name={isInvesting ? 'piggy-bank' : 'trending-up'} size={28} color={colors.accentGreen} />
        </View>
        <PrimaryText size={18} weight="semibold" style={gs.mt15}>
          {t('futureFinance.comingSoon')}
        </PrimaryText>
        <PrimaryText size={13} color={colors.secondaryText} style={[gs.mt6, gs.textCenter]}>
          {t(isInvesting ? 'futureFinance.investingMessage' : 'futureFinance.tradingMessage')}
        </PrimaryText>
      </View>
    </PrimaryView>
  );
};

export default React.memo(FinancePlaceholder);
