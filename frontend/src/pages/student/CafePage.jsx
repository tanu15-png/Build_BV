import { ArrowLeft, Search, ShoppingCart } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";

import { useOrders } from "../../context/OrderContext";

export default function CafePage() {
  const { cafeId } = useParams();

  const { cart, cafes, foods, addToCart, isFoodAvailable, categories, cartBusy, catalogLoading, catalogError } = useOrders();
  const [search, setSearch] = useState("");

  const [category, setCategory] =
    useState(null);

  const cafe = cafes.find(
    (c) => c.id === cafeId
  );

  const cafeFoods = foods.filter((food) => food.cafeId === cafeId && food.name.toLowerCase().includes(search.trim().toLowerCase()));

  const filteredFoods =
    !categories.some(item => item.id === category)
      ? cafeFoods
      : cafeFoods.filter(
          (food) => food.categoryId === category
        );

  const cartTotal = cart.reduce(
    (sum, item) =>
      sum + item.unitPricePaise * item.quantity / 100,
    0
  );

  if (!cafe && (catalogLoading || catalogError)) return <p role="status" className="p-10">{catalogError || "Loading menu…"}</p>;
  if (!cafe) {
    return (
      <div className="p-10">
        Café not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faf9]">

      <header className="bg-white border-b px-5 lg:px-10 py-5">

        <Link
          to="/student"
          className="inline-flex items-center gap-2 text-gray-500"
        >
          <ArrowLeft size={18} />
          Back
        </Link>

      </header>

      <main className="max-w-7xl mx-auto p-5 lg:p-10">

        <section className="bg-[#075d50] text-white rounded-[28px] overflow-hidden">

          <div className="grid md:grid-cols-2">

            <img
              src={cafe.image}
              className="h-64 md:h-full w-full object-cover"
            />

            <div className="p-8 lg:p-12">

              <span className="text-green-300 font-bold">
                ● {cafe.status}
              </span>

              <h1 className="text-4xl font-black mt-3">
                {cafe.name}
              </h1>

              <p className="text-white/60 mt-5">
                {cafe.hours}
              </p>

            </div>

          </div>

        </section>

        {/* SEARCH */}

        <div className="relative max-w-xl mt-10">

          <Search
            className="absolute left-4 top-3.5 text-gray-400"
            size={18}
          />

          <input
            aria-label="Search menu"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search menu..."
            className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-11 pr-4 outline-none"
          />

        </div>

        {/* CATEGORY */}

        <div className="flex gap-3 mt-6 overflow-x-auto pb-2">

          {[
            { id: null, name: "All" },
            ...categories.filter(item => item.canteenId === cafe.databaseId),
          ].map((item) => (

            <button
              key={item.id || "all-categories"}
              onClick={() => setCategory(item.id)}
              className={`px-5 py-2.5 rounded-full font-semibold whitespace-nowrap ${
                category === item.id
                  ? "bg-[#075d50] text-white"
                  : "bg-white border border-gray-200"
              }`}
            >
              {item.name}
            </button>

          ))}

        </div>

        {cartBusy && <p role="status" className="mt-5 text-sm font-bold text-[#075d50]">Updating your cart… You can keep adding items.</p>}
        {!filteredFoods.length && <p className="mt-8 text-gray-500">No items in this menu yet, or no items match your search.</p>}
        {/* FOOD */}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8 pb-32">

          {filteredFoods.map((food) => (

            <div
              key={food.id}
              className="bg-white rounded-2xl overflow-hidden shadow-card"
            >

              <img
                src={food.image}
                className="w-full aspect-[4/3] object-cover"
              />

              <div className="p-5">

                <h3 className="text-xl font-black">
                  {food.name}
                </h3>

                <p className="text-gray-500 text-sm mt-2">
                  {food.description}
                </p>

                <div className="flex justify-between items-center mt-5">

                  <span className="text-[#0f8f73] font-black text-xl">
                    ₹{food.price.toFixed(2)}
                  </span>

                  <button
                    disabled={!isFoodAvailable(food)}
                    onClick={() =>
                      addToCart(food)
                    }
                    className="bg-[#0f8f73] text-white px-4 py-2 rounded-xl font-bold"
                  >
                    {isFoodAvailable(food) ? "Add to Cart" : "Unavailable"}
                  </button>

                </div>

              </div>

            </div>

          ))}

        </div>

      </main>

      {/* CART */}

      {cart.length > 0 && (

        <div className="fixed bottom-5 left-5 right-5 lg:left-auto lg:right-10 lg:w-[380px] bg-[#075d50] text-white rounded-2xl p-4 shadow-2xl z-40">

          <div className="flex justify-between items-center">

            <div className="flex items-center gap-3">

              <ShoppingCart />

              <div>
                <p className="font-bold">
                  {cart.reduce(
                    (sum, item) =>
                      sum + item.quantity,
                    0
                  )}{" "}
                  items
                </p>

                <p className="text-white/60 text-sm">
                  ₹{cartTotal.toFixed(2)}
                </p>
              </div>

            </div>

            <Link
              to="/student/cart"
              className="bg-[#facc15] text-[#075d50] px-5 py-2.5 rounded-xl font-black"
            >
              View Cart
            </Link>

          </div>

        </div>

      )}

    </div>
  );
}