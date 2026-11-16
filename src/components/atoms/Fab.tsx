import React from 'react';
import {TouchableOpacity, View} from 'react-native';
import Icon from './Icons';
import useThemeColors from '../../hooks/useThemeColors';
import {gs, hitSlop} from '../../styles/globalStyles';

interface FabProps {
  onPress: () => void;
  accessibilityLabel: string;
  icon?: string;
  /** Distance from the bottom edge; screens without a tab bar pass their safe-area inset. */
  bottom?: number;
}

/** The one floating "add" button used across the app: same size, colour, lift and corner everywhere. */
const Fab: React.FC<FabProps> = ({onPress, accessibilityLabel, icon = 'plus', bottom = 16}) => {
  const colors = useThemeColors();
  return (
    <View style={[gs.absolute, gs.zIndex1, {right: 16, bottom}]}>
      <TouchableOpacity
        style={[gs.size56, gs.roundedFull, gs.center, gs.fabShadow, {backgroundColor: colors.accentGreen}]}
        onPress={onPress}
        activeOpacity={0.8}
        hitSlop={hitSlop}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button">
        <Icon name={icon} size={26} color={colors.buttonText} />
      </TouchableOpacity>
    </View>
  );
};

export default React.memo(Fab);
