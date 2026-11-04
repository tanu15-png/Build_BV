import { User, Mail } from "lucide-react";
import { useAuth } from "@spoonate/portal/context/AuthContext";

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#f8faf9] p-5 lg:p-10">

      <div className="max-w-3xl mx-auto">

        <h1 className="text-4xl font-black">
          Profile
        </h1>

        <div className="bg-white rounded-2xl shadow-card p-8 mt-8">

          <div className="w-24 h-24 rounded-full bg-[#d9f4ec] text-[#075d50] flex items-center justify-center text-3xl font-black">
            {user?.name?.split(" ").map((part) => part[0]).slice(0, 2).join("")}
          </div>

          <h2 className="text-2xl font-black mt-5">
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

            <Info
              icon={<User />}
              label="Account type"
              value="Personal account"
            />

          </div>

        </div>

      </div>

    </div>
  );
}

function Info({ icon, label, value }) {
  return (
    <div className="flex items-center gap-4">

      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
        {icon}
      </div>

      <div>
        <p className="text-sm text-gray-500">
          {label}
        </p>

        <p className="font-bold">
          {value || "Demo"}
        </p>
      </div>

    </div>
  );
}