import React from 'react';

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Bell,
  ChevronRight,
  Clock3,
  LogOut,
  MapPin,
  Search,
  ShoppingBag,
  ShoppingCart,
} from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import colors from '../../theme/colors';

const categories = [
  {
    id: '1',
    name: 'Breakfast',
    emoji: '🍳',
  },
  {
    id: '2',
    name: 'Lunch',
    emoji: '🍛',
  },
  {
    id: '3',
    name: 'Snacks',
    emoji: '🥪',
  },
  {
    id: '4',
    name: 'Beverages',
    emoji: '🥤',
  },
];

const popularItems = [
  {
    id: '1',
    name: 'Masala Dosa',
    description: 'Crispy dosa with chutney & sambar',
    price: '₹60',
    emoji: '🥞',
  },
  {
    id: '2',
    name: 'Veg Burger',
    description: 'Fresh vegetables & cheese',
    price: '₹80',
    emoji: '🍔',
  },
  {
    id: '3',
    name: 'Cold Coffee',
    description: 'Chilled creamy coffee',
    price: '₹50',
    emoji: '☕',
  },
];

const StudentHomeScreen = ({ navigation }) => {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >

        {/* Header */}

        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Good morning 👋
            </Text>

            <Text style={styles.name}>
              {user?.name}
            </Text>
          </View>

          <Pressable
            onPress={() => navigation.navigate('Cart')}
            style={styles.iconButton}
          >
            <ShoppingCart
              size={22}
              color={colors.text}
            />
          </Pressable>
        </View>

        {/* Location */}

        <View style={styles.locationContainer}>
          <MapPin
            size={18}
            color={colors.primary}
          />

          <View>
            <Text style={styles.locationLabel}>
              Pickup location
            </Text>

            <Text style={styles.locationText}>
              Central Café
            </Text>
          </View>

          <ChevronRight
            size={20}
            color={colors.muted}
            style={styles.locationArrow}
          />
        </View>

        {/* Search */}

        <Pressable style={styles.searchBox}>
          <Search
            size={20}
            color={colors.muted}
          />

          <Text style={styles.searchText}>
            Search for food...
          </Text>
        </Pressable>

        {/* Quick Order Card */}

        <View style={styles.quickCard}>

          <View style={styles.quickIcon}>
            <Clock3
              size={26}
              color={colors.white}
            />
          </View>

          <View style={styles.quickContent}>
            <Text style={styles.quickTitle}>
              Skip the queue
            </Text>

            <Text style={styles.quickSubtitle}>
              Order your food before reaching the canteen.
            </Text>
          </View>

          <ChevronRight
            size={22}
            color={colors.white}
          />

        </View>

        {/* Categories */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Categories
          </Text>

          <Pressable
            onPress={() => navigation.navigate('Menu')}
          >
            <Text style={styles.seeAll}>
              See all
            </Text>
          </Pressable>
        </View>

        <View style={styles.categories}>
          {categories.map((category) => (
            <Pressable
              key={category.id}
              style={styles.category}
            >
              <View style={styles.categoryIcon}>
                <Text style={styles.categoryEmoji}>
                  {category.emoji}
                </Text>
              </View>

              <Text style={styles.categoryName}>
                {category.name}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Popular */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Popular today
          </Text>

          <Pressable
            onPress={() => navigation.navigate('Menu')}
          >
            <Text style={styles.seeAll}>
              See all
            </Text>
          </Pressable>
        </View>

        {popularItems.map((item) => (
          <Pressable
            key={item.id}
            style={styles.foodCard}
          >
            <View style={styles.foodImage}>
              <Text style={styles.foodEmoji}>
                {item.emoji}
              </Text>
            </View>

            <View style={styles.foodInfo}>
              <Text style={styles.foodName}>
                {item.name}
              </Text>

              <Text style={styles.foodDescription}>
                {item.description}
              </Text>

              <Text style={styles.foodPrice}>
                {item.price}
              </Text>
            </View>

            <Pressable style={styles.addButton}>
              <Text style={styles.addText}>
                +
              </Text>
            </Pressable>
          </Pressable>
        ))}

        {/* Orders */}

        <Pressable style={styles.ordersButton}>
          <ShoppingBag
            size={20}
            color={colors.primary}
          />

          <Text style={styles.ordersText}>
            View my orders
          </Text>

          <ChevronRight
            size={20}
            color={colors.primary}
          />
        </Pressable>

        {/* Logout */}

        <Pressable
          onPress={logout}
          style={styles.logoutButton}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },

  greeting: {
    fontSize: 14,
    color: colors.muted,
  },

  name: {
    marginTop: 4,
    fontSize: 25,
    fontWeight: '800',
    color: colors.text,
  },

  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },

  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 15,
    borderRadius: 15,
    marginBottom: 14,
  },

  locationLabel: {
    fontSize: 12,
    color: colors.muted,
  },

  locationText: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },

  locationArrow: {
    marginLeft: 'auto',
  },

  searchBox: {
    height: 52,
    backgroundColor: colors.white,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 18,
  },

  searchText: {
    marginLeft: 10,
    fontSize: 14,
    color: colors.muted,
  },

  quickCard: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },

  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  quickContent: {
    flex: 1,
    marginHorizontal: 12,
  },

  quickTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },

  quickSubtitle: {
    color: colors.white,
    opacity: 0.85,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
  },

  seeAll: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },

  categories: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },

  category: {
    alignItems: 'center',
  },

  categoryIcon: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 7,
    elevation: 2,
  },

  categoryEmoji: {
    fontSize: 27,
  },

  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },

  foodCard: {
    backgroundColor: colors.white,
    borderRadius: 17,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  foodImage: {
    width: 75,
    height: 75,
    borderRadius: 14,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  foodEmoji: {
    fontSize: 38,
  },

  foodInfo: {
    flex: 1,
    marginLeft: 13,
  },

  foodName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },

  foodDescription: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },

  foodPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 7,
  },

  addButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  addText: {
    color: colors.white,
    fontSize: 24,
    lineHeight: 26,
  },

  ordersButton: {
    height: 54,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 12,
  },

  ordersText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },

  logoutButton: {
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

export default StudentHomeScreen;