import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@spoonate/portal/context/AuthContext";

export default function CanteenMembers() {
  const { user, canteenMembers, removeMember, memberError, loadMoreMembers } = useAuth();
  const [error, setError] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [removing, setRemoving] = useState(false);
  const confirmRemoval = async () => {
    setRemoving(true); setError("");
    try { await removeMember(pendingRemoval.id); setPendingRemoval(null); }
    catch (issue) { setError(issue.message); }
    finally { setRemoving(false); }
  };
  return <main className="min-h-screen bg-[#fff8e9] p-5 lg:p-10"><div className="mx-auto max-w-5xl">
    <Link to="/canteen" className="font-bold text-[#185c3a]">← Canteen dashboard</Link>
    <h1 className="my-7 text-3xl font-black">Canteen members</h1>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
          <section id="members" className="rounded-2xl bg-[#fffdf7] p-6 shadow-sm">
            <h2 className="text-xl font-black">Member access</h2>
            {memberError && <p role="alert" className="mt-3 text-red-700">{memberError}</p>}
            <ul className="mt-5 divide-y divide-gray-100">{canteenMembers.map((member) => <li key={member.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div><p className="break-all font-bold">{member.name || 'Member'}{member.userId === user.id ? " (you)" : ""}</p><p className="mt-1 text-sm text-gray-500">{member.status === "REVOKED" ? "Access removed" : `${member.sessionCount} signed-in sessions`}</p></div>
              {member.status === "ACTIVE" && <button onClick={() => setPendingRemoval(member)} className="rounded-xl border border-red-200 px-4 py-2 font-bold text-red-700">Remove access</button>}
            </li>)}</ul>
            {loadMoreMembers && <button onClick={loadMoreMembers} className="mt-4 rounded-xl border px-4 py-2 font-bold">Load more members</button>}
            {pendingRemoval && <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4"><p className="break-all font-bold">Remove access for {pendingRemoval.name || 'this member'}?</p><p className="mt-2 text-sm">Their sessions will end and this member name will no longer be allowed to sign in to this canteen.</p><div className="mt-3 flex gap-3"><button disabled={removing} onClick={confirmRemoval} className="rounded-xl bg-red-700 px-4 py-2 font-bold text-white">{removing ? "Removing…" : "Confirm removal"}</button><button disabled={removing} onClick={() => setPendingRemoval(null)} className="rounded-xl border px-4 py-2 font-bold">Keep member</button></div></div>}
          </section>
  </div></main>;
}
