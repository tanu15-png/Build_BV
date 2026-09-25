import React, { useState } from 'react';

import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  ChefHat,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import colors from '../../theme/colors';

const roles = [
  {
    id: 'student',
    label: 'Student',
    Icon: GraduationCap,
  },
  {
    id: 'canteen',
    label: 'Canteen',
    Icon: ChefHat,
  },
  {
    id: 'admin',
    label: 'Admin',
    Icon: ShieldCheck,
  },
];

const demoCredentials = {
  student: {
    email: 'student@college.edu',
    password: 'student123',
  },

  canteen: {
    email: 'canteen@college.edu',
    password: 'canteen123',
  },

  admin: {
    email: 'admin@campuseats.com',
    password: 'admin123',
  },
};

const LoginScreen = () => {
  const { login, loginAsRole } = useAuth();

  const [selectedRole, setSelectedRole] =
    useState('student');

  const [email, setEmail] = useState(
    demoCredentials.student.email
  );

  const [password, setPassword] = useState(
    demoCredentials.student.password
  );

  const selectRole = (role) => {
    setSelectedRole(role);

    setEmail(demoCredentials[role].email);
    setPassword(demoCredentials[role].password);
  };

  const handleLogin = async () => {
    const result = await login(email, password);

    if (!result.success) {
      Alert.alert(
        'Login Failed',
        result.message
      );
    }
  };

  const handleDemoLogin = async (role) => {
    await loginAsRole(role);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >

        {/* Logo */}

        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <ChefHat
              size={34}
              color={colors.white}
            />
          </View>

          <Text style={styles.logoText}>
            CampusEats
          </Text>
        </View>

        {/* Header */}

        <View style={styles.header}>
          <Text style={styles.title}>
            Welcome to CampusEats
          </Text>

          <Text style={styles.subtitle}>
            Order ahead. Reach on time.
            Pick up without waiting.
          </Text>
        </View>

        {/* Login Card */}

        <View style={styles.card}>

          <Text style={styles.sectionTitle}>
            Choose your role
          </Text>

          <View style={styles.roles}>
            {roles.map((role) => {
              const Icon = role.Icon;

              const selected =
                selectedRole === role.id;

              return (
                <Pressable
                  key={role.id}
                  onPress={() =>
                    selectRole(role.id)
                  }
                  style={[
                    styles.roleButton,
                    selected &&
                      styles.roleButtonSelected,
                  ]}
                >
                  <Icon
                    size={20}
                    color={
                      selected
                        ? colors.white
                        : colors.primary
                    }
                  />

                  <Text
                    style={[
                      styles.roleText,
                      selected &&
                        styles.roleTextSelected,
                    ]}
                  >
                    {role.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Email */}

          <Text style={styles.label}>
            Email
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />

          {/* Password */}

          <Text style={styles.label}>
            Password
          </Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
          />

          {/* Login */}

          <Pressable
            onPress={handleLogin}
            style={styles.loginButton}
          >
            <Text style={styles.loginText}>
              Login
            </Text>
          </Pressable>

        </View>

        {/* Demo Accounts */}

        <View style={styles.demoSection}>

          <Text style={styles.demoTitle}>
            Demo Accounts
          </Text>

          <Pressable
            style={styles.demoButton}
            onPress={() =>
              handleDemoLogin('student')
            }
          >
            <GraduationCap
              size={20}
              color={colors.primary}
            />

            <Text style={styles.demoText}>
              Login as Student
            </Text>
          </Pressable>

          <Pressable
            style={styles.demoButton}
            onPress={() =>
              handleDemoLogin('canteen')
            }
          >
            <ChefHat
              size={20}
              color={colors.primary}
            />

            <Text style={styles.demoText}>
              Login as Canteen
            </Text>
          </Pressable>

          <Pressable
            style={styles.demoButton}
            onPress={() =>
              handleDemoLogin('admin')
            }
          >
            <ShieldCheck
              size={20}
              color={colors.primary}
            />

            <Text style={styles.demoText}>
              Login as Admin
            </Text>
          </Pressable>

        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 50,
    paddingBottom: 40,
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },

  logoCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  logoText: {
    marginTop: 12,
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
  },

  header: {
    marginBottom: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },

  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,

    elevation: 4,

    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 14,
  },

  roles: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22,
  },

  roleButton: {
    flex: 1,
    minHeight: 52,

    borderWidth: 1,
    borderColor: colors.primary,

    borderRadius: 12,

    justifyContent: 'center',
    alignItems: 'center',

    flexDirection: 'row',
    gap: 5,
  },

  roleButtonSelected: {
    backgroundColor: colors.primary,
  },

  roleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },

  roleTextSelected: {
    color: colors.white,
  },

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },

  input: {
    height: 52,

    borderWidth: 1,
    borderColor: colors.border,

    borderRadius: 12,

    paddingHorizontal: 14,

    fontSize: 15,
    color: colors.text,

    backgroundColor: colors.background,

    marginBottom: 16,
  },

  loginButton: {
    height: 54,

    borderRadius: 14,

    backgroundColor: colors.primary,

    justifyContent: 'center',
    alignItems: 'center',

    marginTop: 4,
  },

  loginText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },

  demoSection: {
    marginTop: 28,
  },

  demoTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },

  demoButton: {
    height: 52,

    backgroundColor: colors.white,

    borderRadius: 12,

    borderWidth: 1,
    borderColor: colors.border,

    flexDirection: 'row',

    justifyContent: 'center',
    alignItems: 'center',

    gap: 10,

    marginBottom: 10,
  },

  demoText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
});

export default LoginScreen;