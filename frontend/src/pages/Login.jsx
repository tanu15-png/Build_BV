import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { cafes } from "../data/mockData";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("student");
  const [register, setRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cafeId, setCafeId] = useState("");
  const [secretCode, setSecretCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const handleSubmit = (event) => {
  event.preventDefault();
    setError("");
    setSuccess("");
    try {
    const user = login({
      role,
      email,
      name,
      register,
      cafeId,
      secretCode,
      password
    });

    // Student signup: create account but DO NOT log in automatically
    if (role === "student" && register) {
      setError("");
      setRegister(false);
      setName("");
      setEmail("");
      setPassword("");
      setSuccess("Your account has been created. Please log in to continue.");
      return;
    }

    // Only successful login should navigate to the dashboard
    navigate(`/${user.role}`, { replace: true });
    } catch (issue) {
    setError(issue.message);
    }
  };
  const inputStyle = "mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#0f8f73]";
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#075d50] px-5 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl lg:grid-cols-2">
        <section className="flex flex-col justify-between bg-[#064e43] p-8 text-white lg:p-12">
          <p className="text-2xl font-black">Spoon<span className="text-[#facc15]">Ate</span></p>
          <div className="my-12"><p className="font-bold text-[#facc15]">BANASTHALI VIDYAPITH</p><h1 className="mt-4 text-4xl font-black">Order ahead.<br />Collect when ready.</h1><p className="mt-5 text-white/70">Choose your canteen, schedule your pickup, and track your order until it is ready.</p></div>
          <p className="flex items-center gap-2 text-sm text-white/70"><ShieldCheck size={18} /> A campus food ordering experience</p>
        </section>
        <section className="p-8 lg:p-12">
          <h2 className="text-3xl font-black">{role === "student" && register ? "Create your account" : "Welcome back"}</h2>
          <div className="mt-6 flex gap-2" aria-label="Account role">
            {["student", "canteen", "admin"].map((item) => <button key={item} type="button" aria-pressed={role === item} onClick={() => { setRole(item); setError(""); setSuccess(""); setEmail(""); setPassword(""); setSecretCode(""); }} className={`flex-1 rounded-xl px-3 py-3 text-sm font-bold capitalize ${role === item ? "bg-[#075d50] text-white" : "bg-gray-100 text-gray-600"}`}>{item}</button>)}
          </div>
          {role === "student" && <div className="mt-6 flex gap-5 text-sm font-bold">
            <button type="button" onClick={() => { setRegister(false); setError(""); setSuccess(""); }} className={!register ? "text-[#0f8f73] underline" : "text-gray-500"}>Login</button>
            <button type="button" onClick={() => { setRegister(true); setError(""); setSuccess(""); }} className={register ? "text-[#0f8f73] underline" : "text-gray-500"}>Sign up</button>
          </div>}
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {role === "student" && register && <label className="block text-sm font-bold">Your name<input autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} className={inputStyle} /></label>}
            <label className="block text-sm font-bold">{role === "student" ? "Banasthali email" : "Email"}<input type="email" autoComplete="email" required value={email} placeholder={role === "student" ? "yourname@banasthali.in" : "Enter your email"} onChange={(event) => setEmail(event.target.value)} className={inputStyle} /></label>
            {role === "student" && (
            <label className="block text-sm font-bold">
            Password
            <input
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            className={inputStyle}
            />
            </label>
            )}
            {role === "student" && <p className="text-sm text-gray-500">{register ? "Register with your name and an email ending in @banasthali.in." : "Log in using your registered @banasthali.in email and password."}</p>}
            {role === "canteen" && <>
              <label className="block text-sm font-bold">Your canteen<select required value={cafeId} onChange={(event) => { setCafeId(event.target.value); setSecretCode(""); }} className={inputStyle}><option value="">Select the canteen you represent</option>{cafes.map((cafe) => <option key={cafe.id} value={cafe.id}>{cafe.name}</option>)}</select></label>
              <label className="block text-sm font-bold">Member access code<input type="password" required autoComplete="off" value={secretCode} onChange={(event) => setSecretCode(event.target.value)} className={inputStyle} /></label>
            </>}
            {role === "admin" && <label className="block text-sm font-bold">Password<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputStyle} /></label>}
            {success && (<p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{success}</p>)}
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button className="w-full rounded-xl bg-[#0f8f73] py-3 font-black text-white">{role === "student" && register ? "Sign up" : "Login"}</button>
          </form>
        </section>
      </div>
    </div>
  );
}
