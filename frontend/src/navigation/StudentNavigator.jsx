import React from 'react';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import StudentHomeScreen from '../screens/student/StudentHomeScreen';
import MenuScreen from '../screens/student/MenuScreen';
import FoodDetailsScreen from '../screens/student/FoodDetailsScreen';
import CartScreen from '../screens/student/CartScreen';

const Stack = createNativeStackNavigator();

const StudentNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >

      <Stack.Screen
        name="StudentHome"
        component={StudentHomeScreen}
      />

      <Stack.Screen
        name="Menu"
        component={MenuScreen}
      />

      <Stack.Screen
        name="FoodDetails"
        component={FoodDetailsScreen}
      />

      <Stack.Screen
        name="Cart"
        component={CartScreen}
      />

    </Stack.Navigator>
  );
};

export default StudentNavigator;