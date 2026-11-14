let loading;
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.async = true;
    const timer = setTimeout(() => { script.remove(); loading = null; reject(new Error('Razorpay did not load. Check your connection and retry.')); }, 20000);
    script.onload = () => { clearTimeout(timer); if (window.Razorpay) resolve(window.Razorpay); else { loading = null; script.remove(); reject(new Error('Unable to open Razorpay. Please retry.')); } };
    script.onerror = () => { clearTimeout(timer); loading = null; script.remove(); reject(new Error('Unable to load Razorpay. Check your connection.')); };
    document.head.appendChild(script);
  });
  return loading;
}
