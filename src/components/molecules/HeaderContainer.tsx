import {TouchableOpacity, View} from 'react-native';
import React, {memo} from 'react';
import Icon from '../atoms/Icons';
import MeshAvatar from '../atoms/MeshAvatar';
import useThemeColors from '../../hooks/useThemeColors';
import {useAppSelector} from '../../redux/hooks';
import {selectUserName} from '../../redux/slice/userNameSlice';
import {navigate} from '../../utils/navigationUtils';
import PrimaryText from '../atoms/PrimaryText';
import {gs, hitSlop} from '../../styles/globalStyles';

interface HeaderContainerProps {
  headerText: string;
  /** Home shows a search shortcut next to Settings. */
  showSearch?: boolean;
}

const HeaderContainer: React.FC<HeaderContainerProps> = ({headerText, showSearch = false}) => {
  const colors = useThemeColors();
  const userName = useAppSelector(selectUserName);

  return (
    <View style={[gs.rowCenter, gs.mt15, gs.justifyBetween]}>
      <View style={[gs.rowCenter, gs.flex1, gs.gap12]}>
        {/* The avatar and the cog both lead to Settings, where the name is edited. */}
        <TouchableOpacity
          onPress={() => navigate('SettingsScreen')}
          accessibilityRole="button"
          accessibilityLabel="Open settings">
          <MeshAvatar
            name={userName ?? ''}
            size={40}
            bgColor={colors.accentGreen}
            textColor={colors.buttonText}
            meshColor={colors.buttonText}
          />
        </TouchableOpacity>
        <PrimaryText size={16} weight="semibold" numberOfLines={1} style={gs.flex1}>
          {headerText}
        </PrimaryText>
      </View>
      <View style={[gs.rowCenter, gs.gap12, gs.ml10]}>
        {showSearch ? (
          <TouchableOpacity
            onPress={() => navigate('SearchScreen')}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Search spending">
            <Icon name="search" size={22} color={colors.secondaryText} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => navigate('SettingsScreen')}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Open settings">
          <Icon name="settings" size={22} color={colors.secondaryText} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default memo(HeaderContainer);
