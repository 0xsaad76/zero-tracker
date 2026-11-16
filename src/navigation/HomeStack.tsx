import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import {createBottomTabNavigator, type BottomTabBarButtonProps} from '@react-navigation/bottom-tabs';
import {Platform, Pressable, View} from 'react-native';
import type {HomeStackParamList, TabParamList} from './types';
import {useTranslation} from 'react-i18next';
import Icon from '../components/atoms/Icons';
import useThemeColors from '../hooks/useThemeColors';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import ReportsScreen from '../screens/ReportsScreen';
import DebtsScreen from '../screens/DebtsScreen';
import CategoryScreen from '../screens/CategoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import DiagnosticsScreen from '../screens/DiagnosticsScreen';
import AddTransactionsScreen from '../screens/AddTransactionsScreen';
import UpdateTransactionScreen from '../screens/UpdateTransactionScreen';
import AddCategoryScreen from '../screens/AddCategoryScreen';
import UpdateCategoryScreen from '../screens/UpdateCategoryScreen';
import AddDebtorScreen from '../screens/AddDebtorScreen';
import IndividualDebtsScreen from '../screens/IndividualDebtsScreen';
import AddDebtsScreen from '../screens/AddDebtsScreen';
import UpdateDebtScreen from '../screens/UpdateDebtScreen';
import EverydayTransactionScreen from '../screens/EverydayTransactionScreen';
import CategoryTransactionScreen from '../screens/CategoryTransactionScreen';
import UpdateDebtorScreen from '../screens/UpdateDebtorScreen';
import InvestingScreen from '../screens/InvestingScreen';
import TradingScreen from '../screens/TradingScreen';
import SpendingLimitsScreen from '../screens/SpendingLimitsScreen';
import SearchScreen from '../screens/SearchScreen';
import IncomeScreen from '../screens/IncomeScreen';
import IncomeEntryScreen from '../screens/IncomeScreen/IncomeEntryScreen';
import {useFeatureFlags} from '../features/flags';
import {gs} from '../styles/globalStyles';

const screenOptions = {
  headerShown: false,
};

const ICON_SIZE = 24;

const TabIcon = ({color, icon}: {color: string; icon: string}) => (
  <View style={[gs.h26, gs.center]}>
    <Icon name={icon} size={ICON_SIZE} color={color} />
  </View>
);

const HomeIcon = ({color}: {color: string}) => {
  return <TabIcon color={color} icon="home" />;
};

const ReportsIcon = ({color}: {color: string}) => {
  return <TabIcon color={color} icon="bar-chart-3" />;
};

const DebtIcon = ({color}: {color: string}) => {
  return <TabIcon color={color} icon="credit-card" />;
};

const InvestingIcon = ({color}: {color: string}) => {
  return <TabIcon color={color} icon="piggy-bank" />;
};

const TradingIcon = ({color}: {color: string}) => {
  return <TabIcon color={color} icon="trending-up" />;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// `ref` is dropped: @react-navigation types it more loosely than Pressable
// accepts under React 19, and a custom tab button has no use for it.
const TabBarButton = ({ref: _ref, ...props}: BottomTabBarButtonProps) => (
  <Pressable {...props} android_ripple={{color: 'transparent'}} />
);

const TabStack = () => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const features = useFeatureFlags();

  const bottomPadding = Math.max(insets.bottom, 8);

  const tabBarStyle = {
    backgroundColor: colors.containerColor,
    height: 65 + bottomPadding - (Platform.OS === 'ios' ? 20 : 0),
    paddingTop: 8,
    paddingBottom: bottomPadding,
    borderTopWidth: 0,
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentGreen,
        tabBarInactiveTintColor: colors.primaryText,
        tabBarShowLabel: true,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: [gs.text11, gs.fontMedium, gs.noFontPadding],
        tabBarStyle: tabBarStyle,
        tabBarItemStyle: {minWidth: 0},
        tabBarButton: TabBarButton,
      }}>
      <Tab.Screen
        name="HomeScreen"
        component={HomeScreen}
        options={{tabBarLabel: t('tabs.home'), tabBarIcon: HomeIcon}}
      />
      <Tab.Screen
        name="ReportsScreen"
        component={ReportsScreen}
        options={{tabBarLabel: t('tabs.reports'), tabBarIcon: ReportsIcon}}
      />
      {/* Optional tabs exist only while their feature is switched on in Settings. */}
      {features.debts ? (
        <Tab.Screen
          name="DebtsScreen"
          component={DebtsScreen}
          options={{tabBarLabel: t('tabs.debts'), tabBarIcon: DebtIcon}}
        />
      ) : null}
      {features.investing ? (
        <Tab.Screen
          name="InvestingScreen"
          component={InvestingScreen}
          options={{tabBarLabel: t('tabs.investing'), tabBarIcon: InvestingIcon}}
        />
      ) : null}
      {features.trading ? (
        <Tab.Screen
          name="TradingScreen"
          component={TradingScreen}
          options={{tabBarLabel: t('tabs.trading'), tabBarIcon: TradingIcon}}
        />
      ) : null}
    </Tab.Navigator>
  );
};

const HomeStack = () => {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="TabStack" component={TabStack} />
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
      <Stack.Screen name="CategoryScreen" component={CategoryScreen} />
      <Stack.Screen name="SearchScreen" component={SearchScreen} />
      <Stack.Screen name="IncomeScreen" component={IncomeScreen} />
      <Stack.Screen name="IncomeEntryScreen" component={IncomeEntryScreen} />
      <Stack.Screen name="SpendingLimitsScreen" component={SpendingLimitsScreen} />
      <Stack.Screen name="AddTransactionsScreen" component={AddTransactionsScreen} />
      <Stack.Screen name="UpdateTransactionScreen" component={UpdateTransactionScreen} />
      <Stack.Screen name="AddCategoryScreen" component={AddCategoryScreen} />
      <Stack.Screen name="UpdateCategoryScreen" component={UpdateCategoryScreen} />
      <Stack.Screen name="EverydayTransactionScreen" component={EverydayTransactionScreen} />
      <Stack.Screen name="CategoryTransactionScreen" component={CategoryTransactionScreen} />
      <Stack.Screen name="AddDebtorScreen" component={AddDebtorScreen} />
      <Stack.Screen name="IndividualDebtsScreen" component={IndividualDebtsScreen} />
      <Stack.Screen name="AddDebtsScreen" component={AddDebtsScreen} />
      <Stack.Screen name="UpdateDebtScreen" component={UpdateDebtScreen} />
      <Stack.Screen name="UpdateDebtorScreen" component={UpdateDebtorScreen} />
      <Stack.Screen name="DiagnosticsScreen" component={DiagnosticsScreen} />
    </Stack.Navigator>
  );
};

export default HomeStack;
