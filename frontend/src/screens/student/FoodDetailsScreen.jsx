import React, { useState } from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ArrowLeft,
  Clock3,
  Minus,
  Plus,
  ShoppingCart,
} from 'lucide-react-native';
import { useCart } from '../../context/CartContext';

import colors from '../../theme/colors';

const FoodDetailsScreen = ({ route, navigation }) => {
  const { item } = route.params;
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);

  const total = item.price * quantity;

  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const increaseQuantity = () => {
    setQuantity(quantity + 1);
  };

  const handleAddToCart = () => {
  addToCart(item, quantity);

  Alert.alert(
    'Added to cart',
    `${quantity} × ${item.name} added to your cart.`,
    [
      {
        text: 'Continue Shopping',
        style: 'cancel',
      },
      {
        text: 'View Cart',
        onPress: () =>
          navigation.navigate('Cart'),
      },
    ]
  );
};

  return (
    <View style={styles.container}>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >

        {/* Header */}

        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft
            size={22}
            color={colors.text}
          />
        </Pressable>

        {/* Food image */}

        <View style={styles.imageContainer}>
          <Text style={styles.emoji}>
            {item.emoji}
          </Text>
        </View>

        {/* Information */}

        <View style={styles.info}>

          <View style={styles.titleRow}>
            <Text style={styles.title}>
              {item.name}
            </Text>

            {item.isVeg && (
              <View style={styles.vegIndicator}>
                <View style={styles.vegDot} />
              </View>
            )}
          </View>

          <Text style={styles.canteen}>
            {item.canteen}
          </Text>

          <Text style={styles.description}>
            {item.description}
          </Text>

          <View style={styles.metaRow}>

            <View style={styles.metaItem}>
              <Clock3
                size={17}
                color={colors.primary}
              />

              <Text style={styles.metaText}>
                {item.preparationTime}
              </Text>
            </View>

            <Text style={styles.category}>
              {item.category}
            </Text>

          </View>

          <Text style={styles.price}>
            ₹{item.price}
          </Text>

        </View>

        {/* Quantity */}

        <View style={styles.quantitySection}>

          <Text style={styles.quantityTitle}>
            Quantity
          </Text>

          <View style={styles.quantityControl}>

            <Pressable
              onPress={decreaseQuantity}
              style={styles.quantityButton}
            >
              <Minus
                size={19}
                color={colors.primary}
              />
            </Pressable>

            <Text style={styles.quantity}>
              {quantity}
            </Text>

            <Pressable
              onPress={increaseQuantity}
              style={styles.quantityButton}
            >
              <Plus
                size={19}
                color={colors.primary}
              />
            </Pressable>

          </View>

        </View>

      </ScrollView>

      {/* Bottom bar */}

      <View style={styles.bottomBar}>

        <View>
          <Text style={styles.totalLabel}>
            Total
          </Text>

          <Text style={styles.total}>
            ₹{total}
          </Text>
        </View>

        <Pressable
          onPress={handleAddToCart}
          style={styles.cartButton}
        >
          <ShoppingCart
            size={20}
            color={colors.white}
          />

          <Text style={styles.cartButtonText}>
            Add to Cart
          </Text>
        </Pressable>

      </View>

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
    paddingTop: 48,
    paddingBottom: 130,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },

  imageContainer: {
    height: 250,
    borderRadius: 25,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emoji: {
    fontSize: 120,
  },

  info: {
    marginTop: 25,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  title: {
    fontSize: 27,
    fontWeight: '800',
    color: colors.text,
  },

  vegIndicator: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    marginLeft: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },

  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },

  canteen: {
    marginTop: 7,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },

  description: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },

  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  metaText: {
    marginLeft: 6,
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },

  category: {
    marginLeft: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.white,
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },

  price: {
    marginTop: 20,
    fontSize: 25,
    fontWeight: '800',
    color: colors.primary,
  },

  quantitySection: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  quantityTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },

  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 13,
    padding: 5,
  },

  quantityButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  quantity: {
    width: 45,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 25,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  totalLabel: {
    fontSize: 11,
    color: colors.muted,
  },

  total: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },

  cartButton: {
    height: 52,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cartButtonText: {
    marginLeft: 8,
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
});

export default FoodDetailsScreen;