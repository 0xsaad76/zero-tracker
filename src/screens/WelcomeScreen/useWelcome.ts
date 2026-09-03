import {useCallback} from 'react';
import useThemeColors from '../../hooks/useThemeColors';
import {deleteAllData} from '../../watermelondb/services';
import {navigate} from '../../utils/navigationUtils';

const useWelcome = () => {
  const colors = useThemeColors();

  const handleAlreadyUser = useCallback(() => {
    navigate('ExistingUserScreen');
  }, []);

  const handleNewUser = useCallback(async () => {
    try {
      await deleteAllData();
    } catch (error) {
      if (__DEV__) {
        console.error('Error deleting data for new user:', error);
      }
    }
    navigate('PersonalizeScreen');
  }, []);

  return {
    colors,
    handleAlreadyUser,
    handleNewUser,
  };
};

export default useWelcome;
