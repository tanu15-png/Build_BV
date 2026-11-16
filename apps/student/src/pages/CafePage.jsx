import { MenuLoading } from '@spoonate/portal/components/Brand';
import OfferPrice from '@spoonate/portal/components/OfferPrice';
import { ArrowLeft, Search } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";

import { useOrders } from "@spoonate/portal/context/OrderContext";

export default function CafePage() {
  const { cafeId } = useParams();

  const { cart, cafes, foods, addToCart, isFoodAvailable, categories, catalogLoading, catalogError } = useOrders();
  const [offersOnly,setOffersOnly]=useState(false);
  const [search, setSearch] = useState("");

  const [category, setCategory] =
    useState(null);

  const cafe = cafes.find(
    (c) => c.id === cafeId
  );

  const cafeFoods = foods.filter((food) => food.cafeId === cafeId && (!offersOnly||food.offer) && food.name.toLowerCase().includes(search.trim().toLowerCase()));

  const filteredFoods =
    !categories.some(item => item.id === category)
      ? cafeFoods
      : cafeFoods.filter(
          (food) => food.categoryId === category
        );

  if (!cafe && (catalogLoading || catalogError)) return catalogError ? <p role="alert" className="p-10">{catalogError}</p> : <main className="p-5"><MenuLoading /></main>;
  if (!cafe) {
    return (
      <div className="p-10">
        Café not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fff8e9]">

      <header className="bg-[#fffdf7] border-b px-5 lg:px-10 py-5">

        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-gray-500"
        >
          <ArrowLeft size={18} />
          Back
        </Link>

      </header>

      <main className="max-w-7xl mx-auto p-5 lg:p-10">

        <section className="bg-[#185c3a] text-white rounded-[28px] overflow-hidden">

          <div className="grid md:grid-cols-2">

            <img
              src={cafe.image}
              alt={`${cafe.name} poster`}
              className="h-72 md:h-full w-full bg-[#fffdf7] object-contain"
            />

            <div className="p-8 lg:p-12">

              <span className="text-green-300 font-bold">
                ● {cafe.status}
              </span>

              <h1 className="text-4xl font-black mt-3">
                {cafe.name}
              </h1>

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
            className="w-full bg-[#fffdf7] border border-gray-200 rounded-xl py-3 pl-11 pr-4 outline-none"
          />

        </div>

        {/* CATEGORY */}

        <div className="flex gap-3 mt-6 overflow-x-auto pb-2"><button aria-pressed={offersOnly} onClick={()=>setOffersOnly(value=>!value)} className={`rounded-full border px-5 py-2.5 font-bold whitespace-nowrap ${offersOnly?'border-amber-500 bg-amber-100':'border-amber-200 bg-amber-50'}`}>✦ Offers</button>

          {[
            { id: null, name: "All" },
            ...categories.filter(item => item.canteenId === cafe.databaseId),
          ].map((item) => (

            <button
              key={item.id || "all-categories"}
              onClick={() => setCategory(item.id)}
              className={`px-5 py-2.5 rounded-full font-semibold whitespace-nowrap ${
                category === item.id
                  ? "bg-[#185c3a] text-white"
                  : "bg-[#fffdf7] border border-gray-200"
              }`}
            >
              {item.name}
            </button>

          ))}

        </div>

        {!filteredFoods.length && <p className="mt-8 text-gray-500">No items in this menu yet, or no items match your search.</p>}
        {/* FOOD */}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8 pb-32">

          {filteredFoods.map((food) => (

            <div
              key={food.id}
              className="bg-[#fffdf7] rounded-2xl overflow-hidden shadow-card"
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

                  <span className="text-[#287647] font-black text-xl">
                    <OfferPrice item={food} />
                  </span>

                  <button
                    disabled={!isFoodAvailable(food)}
                    onClick={() =>
                      addToCart(food)
                    }
                    className="bg-[#287647] text-white px-4 py-2 rounded-xl font-bold"
                  >
                    {isFoodAvailable(food) ? (cart.some(item => item.id === food.id) ? `Add more (${cart.find(item => item.id === food.id).quantity})` : "Add to Cart") : "Unavailable"}
                  </button>

                </div>

              </div>

            </div>

          ))}

        </div>

      </main>


    </div>
  );
}
