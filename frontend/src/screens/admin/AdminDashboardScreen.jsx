import React from 'react';

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  BarChart3,
  LogOut,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import colors from '../../theme/colors';

const AdminDashboardScreen = () => {
  const { user, logout } = useAuth();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >

      {/* Header */}

      <View style={styles.header}>

        <View>
          <Text style={styles.smallText}>
            Administration
          </Text>

          <Text style={styles.title}>
            CampusEats Admin
          </Text>
        </View>

        <View style={styles.logo}>
          <ShieldCheck
            size={25}
            color={colors.white}
          />
        </View>

      </View>

      <Text style={styles.subtitle}>
        Monitor and manage the CampusEats platform.
      </Text>

      {/* Statistics */}

      <View style={styles.statsRow}>

        <View style={styles.statCard}>
          <Users
            size={23}
            color={colors.primary}
          />

          <Text style={styles.number}>
            1,248
          </Text>

          <Text style={styles.label}>
            Students
          </Text>
        </View>

        <View style={styles.statCard}>
          <Store
            size={23}
            color={colors.primary}
          />

          <Text style={styles.number}>
            6
          </Text>

          <Text style={styles.label}>
            Canteens
          </Text>
        </View>

      </View>

      {/* Management */}

      <Text style={styles.sectionTitle}>
        Management
      </Text>

      <Pressable style={styles.managementCard}>

        <View style={styles.icon}>
          <Users
            size={22}
            color={colors.primary}
          />
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>
            Manage Students
          </Text>

          <Text style={styles.cardSubtitle}>
            View and manage student accounts
          </Text>
        </View>

      </Pressable>

      <Pressable style={styles.managementCard}>

        <View style={styles.icon}>
          <Store
            size={22}
            color={colors.primary}
          />
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>
            Manage Canteens
          </Text>

          <Text style={styles.cardSubtitle}>
            Manage campus food outlets
          </Text>
        </View>

      </Pressable>

      <Pressable style={styles.managementCard}>

        <View style={styles.icon}>
          <BarChart3
            size={22}
            color={colors.primary}
          />
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>
            Reports & Analytics
          </Text>

          <Text style={styles.cardSubtitle}>
            View orders and platform statistics
          </Text>
        </View>

      </Pressable>

      {/* Logout */}

      <Pressable
        onPress={logout}
        style={styles.logout}
      >
        <LogOut
          size={19}
          color={colors.muted}
        />

        <Text style={styles.logoutText}>
          Logout
        </Text>
      </Pressable>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: 22,
    paddingTop: 50,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  smallText: {
    fontSize: 13,
    color: colors.muted,
  },

  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
  },

  logo: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 8,
    marginBottom: 25,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },

  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 18,
  },

  number: {
    fontSize: 25,
    fontWeight: '800',
    color: colors.text,
    marginTop: 10,
  },

  label: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 3,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 14,
  },

  managementCard: {
    backgroundColor: colors.white,
    borderRadius: 17,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  icon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  cardContent: {
    marginLeft: 13,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },

  cardSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },

  logout: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 25,
    padding: 12,
  },

  logoutText: {
    marginLeft: 7,
    color: colors.muted,
    fontWeight: '600',
  },
});

export default AdminDashboardScreen;