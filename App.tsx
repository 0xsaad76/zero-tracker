import './src/i18n';
import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {setNavigationRef} from './src/utils/navigationUtils';
import {Provider} from 'react-redux';
import store from './src/redux/store';
import MainStack from './src/navigation/MainStack';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {ThemeProvider} from './src/context/ThemeContext';
import {DialogProvider} from './src/context/DialogContext';
import {CloudAuthProvider} from './src/context/CloudAuthContext';
import {SheetProvider} from 'react-native-actions-sheet';
import ErrorBoundary from './src/components/atoms/ErrorBoundary';
import './src/sheets/sheets';
import './src/utils/globalErrorHandler';

const App = () => (
  <ErrorBoundary>
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <Provider store={store}>
          <ThemeProvider>
            <DialogProvider>
              <CloudAuthProvider>
                <SheetProvider>
                  <NavigationContainer ref={setNavigationRef}>
                    <MainStack />
                  </NavigationContainer>
                </SheetProvider>
              </CloudAuthProvider>
            </DialogProvider>
          </ThemeProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  </ErrorBoundary>
);
export default App;
