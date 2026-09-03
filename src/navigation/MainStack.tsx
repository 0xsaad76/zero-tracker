import React from 'react';
import {useAppSelector} from '../redux/hooks';
import {selectIsOnboarded} from '../redux/slice/isOnboardedSlice';
import HomeStack from './HomeStack';
import OnboardingStack from './OnboardingStack';

const MainStack = () => {
  const isOnboarded = useAppSelector(selectIsOnboarded);
  return isOnboarded ? <HomeStack /> : <OnboardingStack />;
};

export default MainStack;
