import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {OnboardingStackParamList} from './types';
import OnboardingScreen from '../screens/OnboardingScreen';
import ChooseCurrencyScreen from '../screens/ChooseCurrencyScreen';
import ExistingUserScreen from '../screens/ExistingUserScreen';

const screenOptions = {
  headerShown: false,
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

const OnboardingStack = () => {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="OnboardingScreen" component={OnboardingScreen} />
      <Stack.Screen name="ExistingUserScreen" component={ExistingUserScreen} />
      <Stack.Screen
        name="ChooseCurrencyScreen"
        component={ChooseCurrencyScreen}
      />
    </Stack.Navigator>
  );
};

export default OnboardingStack;
