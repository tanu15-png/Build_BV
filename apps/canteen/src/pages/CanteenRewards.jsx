import { Link } from 'react-router-dom';
import { RewardManagement } from '@spoonate/portal/components/RewardsAndCombos';

export default function CanteenRewards() {
  return <main className="min-h-screen bg-[#fff8e9] p-5 lg:p-10"><div className="mx-auto max-w-5xl"><Link to="/canteen" className="mb-6 inline-block font-bold text-[#185c3a]">← Dashboard</Link><RewardManagement /></div></main>;
}
