/* ---------- নিশিকথা — Service Worker ----------
   এই ফাইলটা প্রতিটা নতুন ডিপ্লয়ে অবশ্যই CACHE_VERSION বদলাতে হবে।
   এই একটা ভ্যালু বদলালেই ব্রাউজার বুঝে যাবে এটা নতুন ভার্সন, পুরনো সব
   ক্যাশ নিজে থেকেই মুছে ফেলবে, এবং সাইটের সর্বশেষ ফাইল সার্ভ করবে।

   >>> নতুন কনটেন্ট আপডেট করে GitHub-এ পুশ করার সময়, নিচের লাইনটার
   >>> সংখ্যাটা প্রতিবার এক করে বাড়িয়ে দিন (v1 -> v2 -> v3 ...)
*/
const CACHE_VERSION = 'nishikotha-v2';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png'
];

// ---------- INSTALL ----------
// নতুন sw.js পাওয়া মাত্র মূল ফাইলগুলো ক্যাশ করে রাখে, এবং সাথে সাথে
// activate ধাপে চলে যায় (পুরনো ট্যাব বন্ধ হওয়ার জন্য অপেক্ষা করে না)।
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch(() => {
        // কোনো একটা ফাইল না পাওয়া গেলেও পুরো ইনস্টল যেন আটকে না যায়
      });
    })
  );
  self.skipWaiting();
});

// ---------- ACTIVATE ----------
// বর্তমান ভার্সন ছাড়া বাকি সব পুরনো ক্যাশ মুছে ফেলে — এখানেই আসল
// সমাধান: নতুন ফাইল আপলোড করা সত্ত্বেও পুরনো ইন্টারফেস দেখানোর কারণ
// সাধারণত এই পুরনো ক্যাশগুলোই।
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ---------- MESSAGE ----------
// পেজ থেকে পাঠানো SKIP_WAITING সিগন্যাল পেলে সাথে সাথে অ্যাক্টিভেট হয়ে
// যায়, ফলে সব ট্যাব বন্ধ করার দরকার হয় না।
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ---------- FETCH ----------
// HTML/নেভিগেশন রিকোয়েস্টের জন্য "network-first": আগে ইন্টারনেট থেকে
// সর্বশেষ ভার্সন আনার চেষ্টা করে, পেলে সেটাই দেখায় এবং ক্যাশ আপডেট করে।
// ইন্টারনেট না থাকলে (অফলাইন) তখনই ক্যাশ থেকে দেখায়।
// অন্য স্ট্যাটিক ফাইলের (css/js/image ইত্যাদি অ্যাসেট) জন্য "cache-first"
// রাখা হয়েছে দ্রুত লোডের জন্য, ব্যাকগ্রাউন্ডে ক্যাশ রিফ্রেশ করে।
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isNavigation = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          const resClone = networkRes.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return networkRes;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req).then((networkRes) => {
        const resClone = networkRes.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
        return networkRes;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
