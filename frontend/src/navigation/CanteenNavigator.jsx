import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CanteenDashboardScreen from '../screens/canteen/CanteenDashboardScreen';

const Stack = createNativeStackNavigator();

const CanteenNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="CanteenDashboard"
        component={CanteenDashboardScreen}
      />
    </Stack.Navigator>
  );
};

export default CanteenNavigator;