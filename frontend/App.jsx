import React from 'react';

import {
  NavigationContainer,
} from '@react-navigation/native';

import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';

import {
  AuthProvider,
} from './src/context/AuthContext';

import RootNavigator from './src/navigation/RootNavigator';

const App = () => {
  return (
    <SafeAreaProvider>

      <AuthProvider>

        <NavigationContainer>

          <RootNavigator />

        </NavigationContainer>

      </AuthProvider>

    </SafeAreaProvider>
  );
};

export default App;