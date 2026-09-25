import React from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/auth/LoginScreen';

import StudentNavigator from './StudentNavigator';
import CanteenNavigator from './CanteenNavigator';
import AdminNavigator from './AdminNavigator';

import colors from '../theme/colors';

const Stack = createNativeStackNavigator();

const RootNavigator = () => {
  const { user, loading } = useAuth();

  // While checking AsyncStorage
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />
      </View>
    );
  }

  // User is not logged in
  if (!user) {
    return (
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
        />
      </Stack.Navigator>
    );
  }

  // Student
  if (user.role === 'student') {
    return <StudentNavigator />;
  }

  // Canteen
  if (user.role === 'canteen') {
    return <CanteenNavigator />;
  }

  // Admin
  if (user.role === 'admin') {
    return <AdminNavigator />;
  }

  return null;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});

export default RootNavigator;