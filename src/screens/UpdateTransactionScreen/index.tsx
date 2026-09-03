import React from 'react';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import ExpenseEntry from '../../components/molecules/ExpenseEntry';
import type {HomeStackParamList} from '../../navigation/types';

const UpdateTransactionScreen = () => {
  const route = useRoute<RouteProp<HomeStackParamList, 'UpdateTransactionScreen'>>();

  return <ExpenseEntry type={'Update'} route={route} />;
};

export default UpdateTransactionScreen;
