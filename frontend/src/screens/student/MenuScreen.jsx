import React, { useMemo, useState } from 'react';

import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  ArrowLeft,
  Search,
  SlidersHorizontal,
} from 'lucide-react-native';

import { menuItems, categories } from '../../data/menuData';
import colors from '../../theme/colors';

const MenuScreen = ({ navigation }) => {
  const [selectedCategory, setSelectedCategory] =
    useState('All');

  const [search, setSearch] = useState('');

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' ||
        item.category === selectedCategory;

      const searchText = search.toLowerCase().trim();

      const matchesSearch =
        item.name.toLowerCase().includes(searchText) ||
        item.description.toLowerCase().includes(searchText);

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, search]);

  const renderFoodItem = ({ item }) => {
    return (
      <Pressable
        onPress={() =>
          navigation.navigate('FoodDetails', {
            item,
          })
        }
        style={styles.foodCard}
      >
        <View style={styles.foodImage}>
          <Text style={styles.foodEmoji}>
            {item.emoji}
          </Text>
        </View>

        <View style={styles.foodInfo}>
          <View style={styles.foodNameRow}>
            <Text style={styles.foodName}>
              {item.name}
            </Text>

            {item.isVeg && (
              <View style={styles.vegIndicator}>
                <View style={styles.vegDot} />
              </View>
            )}
          </View>

          <Text
            style={styles.description}
            numberOfLines={2}
          >
            {item.description}
          </Text>

          <View style={styles.bottomRow}>
            <Text style={styles.price}>
              ₹{item.price}
            </Text>

            <Text style={styles.time}>
              {item.preparationTime}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>

      {/* Header */}

      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft
            size={22}
            color={colors.text}
          />
        </Pressable>

        <Text style={styles.headerTitle}>
          Menu
        </Text>

        <Pressable style={styles.filterButton}>
          <SlidersHorizontal
            size={20}
            color={colors.text}
          />
        </Pressable>
      </View>

      {/* Search */}

      <View style={styles.searchBox}>
        <Search
          size={20}
          color={colors.muted}
        />

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search food..."
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
      </View>

      {/* Categories */}

      <FlatList
        horizontal
        data={categories}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item }) => {
          const selected =
            selectedCategory === item;

          return (
            <Pressable
              onPress={() =>
                setSelectedCategory(item)
              }
              style={[
                styles.categoryButton,
                selected &&
                  styles.categoryButtonSelected,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  selected &&
                    styles.categoryTextSelected,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* Food list */}

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderFoodItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.foodList}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>
              {selectedCategory === 'All'
                ? 'All Food'
                : selectedCategory}
            </Text>

            <Text style={styles.itemCount}>
              {filteredItems.length} items
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>
              🔍
            </Text>

            <Text style={styles.emptyTitle}>
              No food found
            </Text>

            <Text style={styles.emptyText}>
              Try another search or category.
            </Text>
          </View>
        }
      />

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.text,
  },

  filterButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },

  searchBox: {
    height: 52,
    marginHorizontal: 20,
    backgroundColor: colors.white,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },

  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: colors.text,
  },

  categoryList: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },

  categoryButton: {
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    justifyContent: 'center',
    marginRight: 8,
  },

  categoryButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  categoryText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },

  categoryTextSelected: {
    color: colors.white,
  },

  foodList: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },

  itemCount: {
    fontSize: 12,
    color: colors.muted,
  },

  foodCard: {
    backgroundColor: colors.white,
    borderRadius: 17,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
  },

  foodImage: {
    width: 90,
    height: 90,
    borderRadius: 15,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  foodEmoji: {
    fontSize: 43,
  },

  foodInfo: {
    flex: 1,
    marginLeft: 13,
    justifyContent: 'center',
  },

  foodNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  foodName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },

  vegIndicator: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    marginLeft: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },

  vegDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  description: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    marginTop: 5,
  },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
  },

  price: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },

  time: {
    marginLeft: 10,
    fontSize: 11,
    color: colors.muted,
  },

  emptyContainer: {
    alignItems: 'center',
    marginTop: 70,
  },

  emptyEmoji: {
    fontSize: 40,
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },

  emptyText: {
    marginTop: 5,
    fontSize: 13,
    color: colors.muted,
  },
});

export default MenuScreen;