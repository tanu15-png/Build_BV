import React from 'react';

import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ArrowLeft,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
} from 'lucide-react-native';

import { useCart } from '../../context/CartContext';

import colors from '../../theme/colors';

const CartScreen = ({ navigation }) => {
  const {
    cartItems,
    cartTotal,
    updateQuantity,
    removeFromCart,
  } = useCart();

  const renderItem = ({ item }) => {
    return (
      <View style={styles.cartCard}>

        <View style={styles.foodImage}>
          <Text style={styles.emoji}>
            {item.emoji}
          </Text>
        </View>

        <View style={styles.itemInfo}>

          <Text style={styles.itemName}>
            {item.name}
          </Text>

          <Text style={styles.itemPrice}>
            ₹{item.price}
          </Text>

          <View style={styles.quantityRow}>

            <Pressable
              onPress={() =>
                updateQuantity(
                  item.id,
                  item.quantity - 1
                )
              }
              style={styles.quantityButton}
            >
              <Minus
                size={16}
                color={colors.primary}
              />
            </Pressable>

            <Text style={styles.quantity}>
              {item.quantity}
            </Text>

            <Pressable
              onPress={() =>
                updateQuantity(
                  item.id,
                  item.quantity + 1
                )
              }
              style={styles.quantityButton}
            >
              <Plus
                size={16}
                color={colors.primary}
              />
            </Pressable>

          </View>

        </View>

        <View style={styles.rightSection}>

          <Text style={styles.itemTotal}>
            ₹{item.price * item.quantity}
          </Text>

          <Pressable
            onPress={() =>
              removeFromCart(item.id)
            }
            style={styles.deleteButton}
          >
            <Trash2
              size={18}
              color={colors.muted}
            />
          </Pressable>

        </View>

      </View>
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

        <Text style={styles.title}>
          My Cart
        </Text>

        <View style={styles.placeholder} />

      </View>

      {cartItems.length === 0 ? (

        <View style={styles.emptyContainer}>

          <View style={styles.emptyIcon}>
            <ShoppingCart
              size={38}
              color={colors.primary}
            />
          </View>

          <Text style={styles.emptyTitle}>
            Your cart is empty
          </Text>

          <Text style={styles.emptyText}>
            Add some delicious food to get started.
          </Text>

          <Pressable
            onPress={() =>
              navigation.navigate('Menu')
            }
            style={styles.browseButton}
          >
            <Text style={styles.browseText}>
              Browse Menu
            </Text>
          </Pressable>

        </View>

      ) : (

        <>
          <FlatList
            data={cartItems}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          />

          {/* Checkout summary */}

          <View style={styles.bottomCard}>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Subtotal
              </Text>

              <Text style={styles.summaryValue}>
                ₹{cartTotal}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Convenience fee
              </Text>

              <Text style={styles.summaryValue}>
                ₹0
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>
                Total
              </Text>

              <Text style={styles.totalValue}>
                ₹{cartTotal}
              </Text>
            </View>

            <Pressable
              onPress={() =>
                navigation.navigate('Checkout')
              }
              style={styles.checkoutButton}
            >
              <Text style={styles.checkoutText}>
                Proceed to Checkout
              </Text>
            </Pressable>

          </View>
        </>

      )}

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
    paddingBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  backButton: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },

  placeholder: {
    width: 43,
  },

  title: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.text,
  },

  list: {
    paddingHorizontal: 20,
    paddingBottom: 180,
  },

  cartCard: {
    backgroundColor: colors.white,
    borderRadius: 17,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  foodImage: {
    width: 78,
    height: 78,
    borderRadius: 14,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emoji: {
    fontSize: 38,
  },

  itemInfo: {
    flex: 1,
    marginLeft: 13,
  },

  itemName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },

  itemPrice: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 4,
  },

  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
  },

  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  quantity: {
    width: 35,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },

  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 78,
  },

  itemTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },

  deleteButton: {
    padding: 5,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 35,
  },

  emptyIcon: {
    width: 82,
    height: 82,
    borderRadius: 25,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyTitle: {
    marginTop: 18,
    fontSize: 21,
    fontWeight: '800',
    color: colors.text,
  },

  emptyText: {
    marginTop: 7,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
  },

  browseButton: {
    marginTop: 22,
    height: 50,
    paddingHorizontal: 25,
    borderRadius: 13,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  browseText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
  },

  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 25,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  summaryLabel: {
    fontSize: 13,
    color: colors.muted,
  },

  summaryValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 7,
  },

  totalLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },

  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },

  checkoutButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },

  checkoutText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
});

export default CartScreen;