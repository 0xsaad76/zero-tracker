import React from 'react';
import DebtorEntry from '../../components/molecules/DebtorEntry';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {HomeStackParamList} from '../../navigation/types';

const UpdateDebtorScreen = () => {
  const route = useRoute<RouteProp<HomeStackParamList, 'UpdateDebtorScreen'>>();
  return <DebtorEntry type={'Update'} route={route}/>;
};

export default UpdateDebtorScreen;
