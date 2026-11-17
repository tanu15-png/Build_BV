import { User, Mail } from "lucide-react";
import { useAuth } from "@spoonate/portal/context/AuthContext";

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#fff8e9] p-5 lg:p-10">

      <div className="mx-auto w-full min-w-0 max-w-3xl">

        <h1 className="text-4xl font-black">
          Profile
        </h1>

        <div className="mt-8 min-w-0 rounded-2xl bg-[#fffdf7] p-5 shadow-card sm:p-8">

          <div className="w-24 h-24 rounded-full bg-[#e5eedb] text-[#185c3a] flex items-center justify-center text-3xl font-black">
            {user?.name?.split(" ").map((part) => part[0]).slice(0, 2).join("")}
          </div>

          <h2 className="mt-5 text-2xl font-black [overflow-wrap:anywhere]">
            {user?.name}
          </h2>

          <div className="mt-8 space-y-5">

            <Info
              icon={<Mail />}
              label="Email"
              value={user?.email}
            />

            <Info
              icon={<User />}
              label="Campus"
              value="Banasthali Vidyapith"
            />



          </div>

        </div>

      </div>

    </div>
  );
}

function Info({ icon, label, value }) {
  return (
    <div className="flex min-w-0 items-start gap-3 sm:gap-4">

      <div className="w-10 h-10 shrink-0 rounded-xl bg-gray-100 flex items-center justify-center">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-500">
          {label}
        </p>

        <p className="font-bold [overflow-wrap:anywhere]">
          {value || "Demo"}
        </p>
      </div>

    </div>
  );
}