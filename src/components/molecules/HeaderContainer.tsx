import {Alert, TouchableOpacity, View} from 'react-native';
import React, {memo, useCallback} from 'react';
import Icon from '../atoms/Icons';
import MeshAvatar from '../atoms/MeshAvatar';
import useThemeColors from '../../hooks/useThemeColors';
import {useAppDispatch, useAppSelector} from '../../redux/hooks';
import {selectUserName, setUserName} from '../../redux/slice/userNameSlice';
import {navigate} from '../../utils/navigationUtils';
import PrimaryText from '../atoms/PrimaryText';
import {updateUserById} from '../../cloud';
import {selectUserId} from '../../redux/slice/userIdSlice';
import {SheetManager} from 'react-native-actions-sheet';
import {gs, hitSlop} from '../../styles/globalStyles';
import {requireCloudUser} from '../../cloud/records';

interface HeaderContainerProps {
  headerText: string;
}

const HeaderContainer: React.FC<HeaderContainerProps> = ({headerText}) => {
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const userName = useAppSelector(selectUserName);
  const userId = useAppSelector(selectUserId);

  const handleProfileClick = useCallback(() => {
    void SheetManager.show('change-name-sheet', {
      payload: {
        currentName: userName,
        onUpdate: (newName: string) => {
          updateUserById(userId, {username: newName})
            .then(() => {
              requireCloudUser(userId);
              dispatch(setUserName(newName));
            })
            .catch(() => {
              try {
                requireCloudUser(userId);
              } catch {
                return;
              }
              Alert.alert('Could not save name', 'Check your connection and try again.');
            });
        },
      },
    });
  }, [userName, userId, dispatch]);

  return (
    <View style={[gs.rowCenter, gs.mt15, gs.justifyBetween]}>
      <View style={[gs.rowCenter, gs.flex1, gs.gap12]}>
        <TouchableOpacity onPress={handleProfileClick}>
          <MeshAvatar
            name={userName ?? ''}
            size={40}
            bgColor={colors.accentGreen}
            textColor={colors.buttonText}
            meshColor={colors.buttonText}
          />
        </TouchableOpacity>
        <PrimaryText size={16} weight="semibold">
          {headerText}
        </PrimaryText>
      </View>
      <TouchableOpacity onPress={() => navigate('SettingsScreen')} hitSlop={hitSlop}>
        <Icon name="settings" size={22} color={colors.secondaryText} />
      </TouchableOpacity>
    </View>
  );
};

export default memo(HeaderContainer);
