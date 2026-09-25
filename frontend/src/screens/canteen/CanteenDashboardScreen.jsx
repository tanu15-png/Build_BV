import React from 'react';

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ChefHat,
  ClipboardList,
  LogOut,
  PackageCheck,
  Plus,
  Utensils,
} from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import colors from '../../theme/colors';

const CanteenDashboardScreen = () => {
  const { user, logout } = useAuth();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >

      <View style={styles.header}>
        <View>
          <Text style={styles.smallText}>
            Canteen Dashboard
          </Text>

          <Text style={styles.title}>
            {user?.name}
          </Text>
        </View>

        <View style={styles.logo}>
          <ChefHat
            size={25}
            color={colors.white}
          />
        </View>
      </View>

      <Text style={styles.subtitle}>
        Manage today's food orders and menu.
      </Text>

      {/* Statistics */}

      <View style={styles.statsRow}>

        <View style={styles.statCard}>
          <ClipboardList
            size={22}
            color={colors.primary}
          />

          <Text style={styles.statNumber}>
            12
          </Text>

          <Text style={styles.statLabel}>
            New Orders
          </Text>
        </View>

        <View style={styles.statCard}>
          <PackageCheck
            size={22}
            color={colors.primary}
          />

          <Text style={styles.statNumber}>
            28
          </Text>

          <Text style={styles.statLabel}>
            Completed
          </Text>
        </View>

      </View>

      {/* Actions */}

      <Text style={styles.sectionTitle}>
        Quick actions
      </Text>

      <Pressable style={styles.actionCard}>
        <View style={styles.actionIcon}>
          <ClipboardList
            size={22}
            color={colors.primary}
          />
        </View>

        <View style={styles.actionContent}>
          <Text style={styles.actionTitle}>
            Manage Orders
          </Text>

          <Text style={styles.actionSubtitle}>
            View and update incoming orders
          </Text>
        </View>
      </Pressable>

      <Pressable style={styles.actionCard}>
        <View style={styles.actionIcon}>
          <Utensils
            size={22}
            color={colors.primary}
          />
        </View>

        <View style={styles.actionContent}>
          <Text style={styles.actionTitle}>
            Manage Menu
          </Text>

          <Text style={styles.actionSubtitle}>
            Add, edit or remove food items
          </Text>
        </View>

        <Plus
          size={20}
          color={colors.primary}
        />
      </Pressable>

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
    fontSize: 26,
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

  statNumber: {
    fontSize: 27,
    fontWeight: '800',
    color: colors.text,
    marginTop: 10,
  },

  statLabel: {
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

  actionCard: {
    backgroundColor: colors.white,
    borderRadius: 17,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  actionContent: {
    flex: 1,
    marginLeft: 13,
  },

  actionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },

  actionSubtitle: {
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

export default CanteenDashboardScreen;