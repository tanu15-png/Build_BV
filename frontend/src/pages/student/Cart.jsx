import {
  ArrowLeft,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";

import {
  useOrders,
} from "../../context/OrderContext";

export default function Cart() {
  const {
    cart,
    cafes,
    clearCart,
    updateQuantity,
    removeFromCart,
    cartBusy, cartState, catalogError, refreshCatalog,
  } = useOrders();

  const subtotal = (cartState?.totalPaise || 0) / 100;

  if (!cartState) return <div className="p-10"><p role="status">{catalogError || "Loading your saved cart…"}</p><button onClick={refreshCatalog} className="mt-4 underline">Retry</button></div>;
  if (!cart.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8faf9]">

        <div className="text-center">

          <div className="text-6xl">
            🛒
          </div>

          <h1 className="text-3xl font-black mt-5">
            Your cart is empty
          </h1>

          <p className="text-gray-500 mt-2">
            Order something from a campus café.
          </p>

          <Link
            to="/student"
            className="inline-block mt-6 bg-[#075d50] text-white px-6 py-3 rounded-xl font-bold"
          >
            Browse Cafés
          </Link>

        </div>

      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faf9]">

      <header className="bg-white border-b p-5">

        <Link
          to="/student"
          className="flex items-center gap-2 text-gray-500"
        >
          <ArrowLeft size={18} />
          Back
        </Link>

      </header>

      <main className="max-w-5xl mx-auto p-5 lg:p-10">

        <h1 className="text-4xl font-black">
          Your Cart
        </h1>
        <button disabled={cartBusy} onClick={clearCart} className="mt-3 text-sm font-bold text-red-600">Empty cart</button>

        <p className="text-gray-500 mt-2">
          {cafes.find((cafe) => cafe.id === cart[0]?.cafeId)?.name}
        </p>

        <div className="grid lg:grid-cols-[1fr_350px] gap-8 mt-8">

          <div className="space-y-4">

            {cart.map((item) => (

              <div
                key={item.id}
                className="bg-white rounded-2xl p-4 flex gap-4 shadow-card"
              >

                <img
                  src={item.image}
                  className="w-24 h-24 rounded-xl object-cover"
                />

                <div className="flex-1">

                  <h3 className="font-black">
                    {item.name}
                  </h3>

                  <p className="text-[#0f8f73] font-bold mt-1">
                    ₹{item.price.toFixed(2)}
                  </p>

                  {!item.available && <p className="mt-2 text-sm text-red-700">Unavailable now. You can reduce the quantity or remove it.</p>}
                  <div className="flex items-center gap-3 mt-4">

                    <button
                      disabled={cartBusy}
                      onClick={() =>
                        updateQuantity(
                          item.id,
                          item.quantity - 1
                        )
                      }
                      className="w-8 h-8 rounded-lg border flex items-center justify-center"
                    >
                      <Minus size={14} />
                    </button>

                    <span className="font-bold">
                      {item.quantity}
                    </span>

                    <button
                      disabled={cartBusy || !item.available || item.quantity >= 99}
                      onClick={() =>
                        updateQuantity(
                          item.id,
                          item.quantity + 1
                        )
                      }
                      className="w-8 h-8 rounded-lg border flex items-center justify-center"
                    >
                      <Plus size={14} />
                    </button>

                  </div>

                </div>

                <button
                  disabled={cartBusy}
                  onClick={() =>
                    removeFromCart(item.id)
                  }
                  className="text-red-400"
                >
                  <Trash2 size={18} />
                </button>

              </div>

            ))}

          </div>

          <div className="bg-white rounded-2xl p-6 shadow-card h-fit">

            <h2 className="text-xl font-black">
              Order Summary
            </h2>

            <div className="flex justify-between mt-6">
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between mt-3">
              <span>Pickup</span>
              <span>Available with ordering</span>
            </div>

            <hr className="my-5" />

            <div className="flex justify-between text-xl font-black">
              <span>Total</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>

            <Link
              to="/student/checkout"
              className="block text-center bg-[#075d50] text-white rounded-xl py-3 mt-6 font-bold"
            >
              Review Cart
            </Link>

          </div>

        </div>

      </main>

    </div>
  );
}