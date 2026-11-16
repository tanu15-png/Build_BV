import { useLoadingAnimation } from '@spoonate/portal/hooks/useLoadingAnimation';
import { MenuLoading } from '@spoonate/portal/components/Brand';
import { Link, useParams } from 'react-router-dom';
import { useBanners } from '@spoonate/portal/hooks/useBanners';
import { bannerImageSrc } from '@spoonate/portal/services/promotions';
import { PromotionMenuItems } from '@spoonate/portal/components/Promotions';

export default function SpecialMenu() {
  const {id}=useParams(),{banners,loading,error,load}=useBanners();
  const animation = useLoadingAnimation(loading);
  const banner=banners.find(item=>item.id===id);
  return <main className="mx-auto min-h-screen max-w-6xl bg-[#fff8e9] px-5 py-6 pb-28 lg:p-10"><Link to="/dashboard" className="font-bold text-[#185c3a]">← Back to dashboard</Link>{animation.pending?<MenuLoading onComplete={animation.complete} />:error?<p role="alert" className="mt-6">{error} <button onClick={()=>load(true)}>Retry</button></p>:!banner?<p className="mt-6">This special menu is no longer available. <Link to="/dashboard#cafes" className="underline">Browse the full menu</Link></p>:<><img src={bannerImageSrc(banner.imageRef)} alt={banner.title} className="mt-6 h-auto w-full rounded-2xl object-contain" /><h1 className="mt-6 text-3xl font-black">{banner.title}</h1><p className="mb-6 mt-2 text-gray-500">{banner.description}</p><PromotionMenuItems itemIds={banner.items.map(item=>item.menuItemId)} /></>}</main>;
}
