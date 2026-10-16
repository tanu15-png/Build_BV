// Directory confirmed for Build BV. Menu items are samples for testing.
export const cafes = [
  { id: "mukteshwari", name: "Mukteshwari's Canteen" },
  { id: "shanu", name: "Shanu's Canteen" },
  { id: "spicy-bites", name: "Spicy Bites" },
  { id: "annapurna", name: "Annapurna Canteen" },
  { id: "agarwal", name: "Agarwal Canteen" },
  { id: "fun-n-frolic", name: "Fun 'N' Frolic" },
  { id: "desi-jayka", name: "Desi Jayka" },
  { id: "bella-bite", name: "Bella Bite" },
].map((cafe) => ({
  ...cafe,
  status: "Open",
  categories: ["Snacks", "Meals", "Beverages"],
  preparationTime: "10–15 min",
  image: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=80",
}));

const sampleFoods = [
  {
    id: "maggi",
    name: "Masala Maggi",
    description: "Hot and delicious masala noodles",
    price: 60,
    category: "Snacks",
    preparationTime: 7,
    image:
      "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=500&q=80",
  },
  {
    id: "burger",
    name: "Campus Burger",
    description: "Crispy burger with fresh vegetables",
    price: 80,
    category: "Snacks",
    preparationTime: 10,
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=80",
  },
  {
    id: "sandwich",
    name: "Veg Sandwich",
    description: "Fresh grilled sandwich",
    price: 70,
    category: "Meals",
    preparationTime: 8,
    image:
      "https://images.unsplash.com/photo-1521390188846-e2a3a97453a0?auto=format&fit=crop&w=500&q=80",
  },
  {
    id: "coffee",
    name: "Cold Coffee",
    description: "Chilled creamy cold coffee",
    price: 50,
    category: "Beverages",
    preparationTime: 3,
    image:
      "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=500&q=80",
  },
  {
    id: "momos",
    name: "Veg Momos",
    description: "Steamed momos with spicy chutney",
    price: 80,
    category: "Snacks",
    preparationTime: 10,
    image:
      "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?auto=format&fit=crop&w=500&q=80",
  },
  {
    id: "tea",
    name: "Masala Tea",
    description: "Hot aromatic campus chai",
    price: 20,
    category: "Beverages",
    preparationTime: 3,
    image:
      "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=500&q=80",
  },
];


export const foods = cafes.flatMap((cafe) =>
  sampleFoods.map((food) => ({
    ...food,
    id: `${cafe.id}-${food.id}`,
    cafeId: cafe.id,
  }))
);
