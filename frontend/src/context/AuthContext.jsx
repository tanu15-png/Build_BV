import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

const STORAGE_KEY = '@campus_eats_user';

const DEMO_USERS = {
  student: {
    name: 'Tanu Verma',
    email: 'student@college.edu',
    password: 'student123',
    role: 'student',
  },

  canteen: {
    name: 'Central Café',
    email: 'canteen@college.edu',
    password: 'canteen123',
    role: 'canteen',
  },

  admin: {
    name: 'CampusEats Admin',
    email: 'admin@campuseats.com',
    password: 'admin123',
    role: 'admin',
  },
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const storedUser =
        await AsyncStorage.getItem(STORAGE_KEY);

      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.log('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const foundUser = Object.values(DEMO_USERS).find(
      (demoUser) =>
        demoUser.email === email &&
        demoUser.password === password
    );

    if (!foundUser) {
      return {
        success: false,
        message: 'Invalid email or password',
      };
    }

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(foundUser)
    );

    setUser(foundUser);

    return {
      success: true,
      user: foundUser,
    };
  };

  const loginAsRole = async (role) => {
    const demoUser = DEMO_USERS[role];

    if (!demoUser) {
      return {
        success: false,
        message: 'Invalid role',
      };
    }

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(demoUser)
    );

    setUser(demoUser);

    return {
      success: true,
      user: demoUser,
    };
  };

  const logout = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginAsRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider'
    );
  }

  return context;
};