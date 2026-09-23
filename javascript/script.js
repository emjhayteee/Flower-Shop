/* =====================================================================
   Blossom & Bloom storefront
   1. Helpers   2. Catalog   3. Cart   4. Panels (open/close)
   5. Search    6. Checkout  7. Page behaviour   8. Init
   ===================================================================== */

/* ---------- 1. Helpers ---------- */
const $ = (selector, root = document) => root.querySelector(selector);
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const formatPrice = (amount) => money.format(amount);

function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, (ch) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
}

function todayISO() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
}

const PLACEHOLDER_IMG = 'https://placehold.co/600x750/f2e8e5/855148?text=Blossom+%26+Bloom';


/* ---------- 2. Catalog (read straight from the product cards in the HTML) ---------- */
const catalog = [];

function buildCatalog() {
    document.querySelectorAll('[data-product]').forEach((card) => {
        const name = $('h3', card).textContent.replace(/\s+/g, ' ').trim();
        const description = $('p', card).textContent.replace(/\s+/g, ' ').trim();
        const price = parseFloat($('span.text-xl', card).textContent.replace(/[^0-9.]/g, ''));
        const badgeEl = $('span.absolute', card);
        const badge = badgeEl ? badgeEl.textContent.replace(/\s+/g, ' ').trim() : '';
        const image = $('img', card).getAttribute('src');

        card.id = 'product-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        catalog.push({
            name, description, price, badge, image, el: card,
            searchText: `${name} ${description} ${badge}`.toLowerCase(),
        });
    });
}

const findProduct = (name) => catalog.find((p) => p.name === name);


/* ---------- 3. Cart ---------- */
const CART_KEY = 'blossom-bloom-cart';
const MAX_QTY = 20;
let cart = [];   // [{ name, qty }]  - price and image always come from the catalog

function loadCart() {
    try {
        const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
        if (!Array.isArray(saved)) return [];
        return saved
            .filter((item) => item && findProduct(item.name) && Number.isInteger(item.qty) && item.qty > 0)
            .map((item) => ({ name: item.name, qty: Math.min(item.qty, MAX_QTY) }));
    } catch (err) {
        return [];   // storage blocked or corrupted - start with an empty cart
    }
}

function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (err) { /* ignore */ }
}

const getCartCount = () => cart.reduce((sum, item) => sum + item.qty, 0);
const getCartSubtotal = () => cart.reduce((sum, item) => sum + item.qty * findProduct(item.name).price, 0);

function addToCart(itemName, qty = 1) {
    const product = findProduct(itemName);
    if (!product) {
        showToast('Sorry, that item is unavailable.', 'error');
        return;
    }
    const line = cart.find((item) => item.name === itemName);
    if (line && line.qty >= MAX_QTY) {
        showToast(`Maximum of ${MAX_QTY} per order.`, 'error');
        return;
    }
    if (line) line.qty = Math.min(MAX_QTY, line.qty + qty);
    else cart.push({ name: itemName, qty });

    updateCart();
    bumpBadge();
    showToast(`${itemName} added to your cart!`);
}

function changeQty(itemName, delta) {
    const line = cart.find((item) => item.name === itemName);
    if (!line) return;
    const next = line.qty + delta;
    if (next > MAX_QTY) {
        showToast(`Maximum of ${MAX_QTY} per order.`, 'error');
        return;
    }
    if (next <= 0) removeFromCart(itemName);
    else { line.qty = next; updateCart(); }
}

function removeFromCart(itemName) {
    cart = cart.filter((item) => item.name !== itemName);
    updateCart();
}

function clearCart() {
    cart = [];
    updateCart();
}

function updateCart() {
    saveCart();
    renderCartBadge();
    renderCart();
}

function renderCartBadge() {
    const count = getCartCount();
    $('#cart-count').textContent = count;
    $('#cart-btn').setAttribute('aria-label', `View cart (${count} ${count === 1 ? 'item' : 'items'})`);
}

function bumpBadge() {
    const badge = $('#cart-count');
    badge.classList.remove('bump');
    void badge.offsetWidth;          // restart the animation
    badge.classList.add('bump');
}

function renderCart() {
    const isEmpty = cart.length === 0;
    const count = getCartCount();

    $('#cart-empty').classList.toggle('hidden', !isEmpty);
    $('#cart-items').classList.toggle('hidden', isEmpty);
    $('#cart-footer').classList.toggle('hidden', isEmpty);
    $('#cart-drawer-count').textContent = isEmpty ? '' : `(${count} ${count === 1 ? 'item' : 'items'})`;
    $('#cart-subtotal').textContent = formatPrice(getCartSubtotal());

    $('#cart-items').innerHTML = cart.map((item) => {
        const p = findProduct(item.name);
        const name = escapeHTML(p.name);
        return `
        <li class="flex gap-4 py-5" data-name="${name}">
            <img src="${escapeHTML(p.image)}" alt="${name}"
                class="w-20 h-24 object-cover rounded-xl bg-stone-100 shrink-0"
                onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
            <div class="flex-1 min-w-0 flex flex-col justify-between">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                        <h3 class="font-serif font-bold text-stone-800 leading-snug">${name}</h3>
                        <p class="text-xs text-stone-500 mt-0.5">${escapeHTML(p.description)}</p>
                    </div>
                    <button type="button" data-cart-action="remove" aria-label="Remove ${name} from cart"
                        class="text-stone-400 hover:text-red-500 p-1 transition-colors">
                        <i class="fa-solid fa-trash-can text-sm"></i>
                    </button>
                </div>
                <div class="flex items-center justify-between mt-3">
                    <div class="inline-flex items-center border border-brand-200 rounded-full">
                        <button type="button" data-cart-action="dec" aria-label="Decrease quantity of ${name}"
                            class="w-8 h-8 flex items-center justify-center text-brand-800 hover:text-brand-500">
                            <i class="fa-solid fa-minus text-xs"></i>
                        </button>
                        <span class="w-8 text-center text-sm font-semibold" aria-label="Quantity">${item.qty}</span>
                        <button type="button" data-cart-action="inc" aria-label="Increase quantity of ${name}"
                            class="w-8 h-8 flex items-center justify-center text-brand-800 hover:text-brand-500">
                            <i class="fa-solid fa-plus text-xs"></i>
                        </button>
                    </div>
                    <span class="font-bold text-brand-800">${formatPrice(p.price * item.qty)}</span>
                </div>
            </div>
        </li>`;
    }).join('');
}

function handleCartItemClick(event) {
    const btn = event.target.closest('[data-cart-action]');
    if (!btn) return;
    const name = btn.closest('li').dataset.name;
    const action = btn.dataset.cartAction;

    if (action === 'inc') changeQty(name, 1);
    if (action === 'dec') changeQty(name, -1);
    if (action === 'remove') removeFromCart(name);

    // Keep keyboard focus on the same control after the list re-renders
    if (action === 'inc' || action === 'dec') {
        const li = [...$('#cart-items').children].find((row) => row.dataset.name === name);
        const again = li && $(`[data-cart-action="${action}"]`, li);
        if (again) again.focus();
    }
}


/* ---------- 4. Panels: cart drawer, search, checkout ---------- */
let activeLayer = null;   // id of the panel that is currently open
let lastFocus = null;     // element to hand focus back to on close

function openLayer(id) {
    const el = document.getElementById(id);
    if (!el || activeLayer === id) return;

    if (activeLayer) hideLayer(activeLayer);          // switching panels (e.g. cart -> checkout)
    else lastFocus = document.activeElement;

    setMobileMenu(false);
    activeLayer = id;
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    $('#overlay').classList.add('is-open');
    document.body.classList.add('overflow-hidden');

    setTimeout(() => {
        const target = $('[data-autofocus]', el) || el;
        target.focus({ preventScroll: true });
    }, 60);
}

function hideLayer(id) {
    const el = document.getElementById(id);
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
}

function closeLayer() {
    if (!activeLayer) return;
    hideLayer(activeLayer);
    activeLayer = null;
    $('#overlay').classList.remove('is-open');
    document.body.classList.remove('overflow-hidden');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
}

// Keep Tab inside the open panel
function trapFocus(event) {
    const panel = document.getElementById(activeLayer);
    const focusable = [...panel.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])'
    )].filter((n) => n.getClientRects().length > 0);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

const openCart = () => { renderCart(); openLayer('cart-drawer'); };


/* ---------- 5. Search ---------- */
function searchProducts(query) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return catalog;
    return catalog.filter((p) => terms.every((term) => p.searchText.includes(term)));
}

function renderSearchResults(query) {
    const q = query.trim();
    const results = searchProducts(q);
    const list = $('#search-results');

    $('#search-status').textContent = q
        ? `${results.length} ${results.length === 1 ? 'result' : 'results'}`
        : 'All arrangements';

    if (!results.length) {
        list.innerHTML = `<li class="px-4 py-10 text-center text-sm text-stone-500">
            Nothing matches "${escapeHTML(q)}". Try a word like "rose" or "orchid".</li>`;
        return;
    }

    list.innerHTML = results.map((p) => `
        <li data-name="${escapeHTML(p.name)}">
            <div class="flex items-center gap-3 p-2 rounded-xl hover:bg-blush transition-colors">
                <button type="button" data-search-action="view"
                    class="flex items-center gap-4 flex-1 min-w-0 text-left">
                    <img src="${escapeHTML(p.image)}" alt="" class="w-14 h-16 object-cover rounded-lg bg-stone-100 shrink-0"
                        onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
                    <span class="min-w-0">
                        <span class="block font-serif font-bold text-stone-800 truncate">${escapeHTML(p.name)}</span>
                        <span class="block text-xs text-stone-500 truncate">${escapeHTML(p.description)}</span>
                        <span class="block text-sm font-bold text-brand-800 mt-0.5">${formatPrice(p.price)}</span>
                    </span>
                </button>
                <button type="button" data-search-action="add" aria-label="Add ${escapeHTML(p.name)} to cart"
                    class="px-4 py-2 bg-brand-100 hover:bg-brand-500 hover:text-white text-brand-800 text-sm font-semibold rounded-full transition-all shrink-0">
                    <i class="fa-solid fa-plus text-xs"></i> Add
                </button>
            </div>
        </li>`).join('');
}

function openSearch() {
    $('#search-input').value = '';
    renderSearchResults('');
    openLayer('search-modal');
}

function goToProduct(name) {
    const product = findProduct(name);
    if (!product) return;
    closeLayer();
    requestAnimationFrame(() => {
        product.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        product.el.classList.remove('highlight-pulse');
        void product.el.offsetWidth;
        product.el.classList.add('highlight-pulse');
        setTimeout(() => product.el.classList.remove('highlight-pulse'), 2200);
    });
}

function handleSearchClick(event) {
    const btn = event.target.closest('[data-search-action]');
    if (!btn) return;
    const name = btn.closest('li').dataset.name;
    if (btn.dataset.searchAction === 'add') addToCart(name);
    else goToProduct(name);
}


/* ---------- 6. Checkout ---------- */
const CHECKOUT_FIELDS = ['name', 'phone', 'address', 'date'];

function openCheckout() {
    if (!cart.length) {
        showToast('Your cart is empty.', 'error');
        return;
    }
    $('#checkout-form-view').classList.remove('hidden');
    $('#checkout-success-view').classList.add('hidden');
    $('#co-date').min = todayISO();
    renderCheckoutSummary();
    showCheckoutErrors({});
    openLayer('checkout-modal');
}

function renderCheckoutSummary() {
    const lines = cart.map((item) => {
        const p = findProduct(item.name);
        return `<div class="flex justify-between gap-4">
            <span class="text-stone-600">${escapeHTML(p.name)} <span class="text-stone-400">x ${item.qty}</span></span>
            <span class="font-medium text-stone-800">${formatPrice(p.price * item.qty)}</span>
        </div>`;
    }).join('');
    $('#checkout-summary').innerHTML = lines + `
        <div class="flex justify-between pt-2 mt-1 border-t border-brand-200 font-bold text-brand-800">
            <span>Total</span><span>${formatPrice(getCartSubtotal())}</span>
        </div>`;
}

function validateCheckout(values) {
    const errors = {};

    if (values.name.trim().length < 2) errors.name = 'Please enter your full name.';

    const digits = values.phone.replace(/\D/g, '');
    if (!/^[+()\d\s.-]+$/.test(values.phone.trim()) || digits.length < 7 || digits.length > 15) {
        errors.phone = 'Please enter a valid phone number.';
    }

    if (values.address.trim().length < 8) errors.address = 'Please enter a complete delivery address.';

    if (!values.date) {
        errors.date = 'Please choose a delivery date.';
    } else if (values.date < todayISO()) {
        errors.date = 'That date has already passed.';
    } else if (new Date(values.date + 'T00:00:00').getDay() === 0) {
        errors.date = "We're closed on Sundays. Please pick another day.";
    }
    return errors;
}

function showCheckoutErrors(errors) {
    CHECKOUT_FIELDS.forEach((field) => {
        const input = $('#co-' + field);
        const msg = $('#err-' + field);
        const hasError = Boolean(errors[field]);
        msg.textContent = errors[field] || '';
        msg.classList.toggle('hidden', !hasError);
        input.classList.toggle('border-red-400', hasError);
        input.classList.toggle('border-brand-200', !hasError);
        input.setAttribute('aria-invalid', String(hasError));
    });
}

function generateOrderId() {
    return 'BB-' + Date.now().toString(36).slice(-4).toUpperCase()
        + Math.random().toString(36).slice(2, 5).toUpperCase();
}

function placeOrder(event) {
    event.preventDefault();
    if (!cart.length) {
        showToast('Your cart is empty.', 'error');
        return;
    }

    const values = {
        name: $('#co-name').value,
        phone: $('#co-phone').value,
        address: $('#co-address').value,
        date: $('#co-date').value,
        message: $('#co-message').value.trim(),
    };

    const errors = validateCheckout(values);
    showCheckoutErrors(errors);
    const firstInvalid = CHECKOUT_FIELDS.find((field) => errors[field]);
    if (firstInvalid) {
        $('#co-' + firstInvalid).focus();
        return;
    }

    const order = {
        id: generateOrderId(),
        placedAt: new Date().toISOString(),
        customer: values,
        items: cart.map((item) => ({ ...item, price: findProduct(item.name).price })),
        total: getCartSubtotal(),
    };

    // TODO: send `order` to your server / payment provider here.
    // Right now the order stays in the browser only.
    console.info('Order placed:', order);

    showOrderConfirmation(order);
    clearCart();
    $('#checkout-form').reset();
}

function showOrderConfirmation(order) {
    const when = new Date(order.customer.date + 'T00:00:00')
        .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const firstName = order.customer.name.trim().split(/\s+/)[0];

    $('#order-message').textContent =
        `Thanks, ${firstName}! Order ${order.id} is placed for delivery on ${when}.`;
    $('#order-lines').innerHTML = order.items.map((item) => `
        <li class="flex justify-between gap-4">
            <span class="text-stone-600">${escapeHTML(item.name)} <span class="text-stone-400">x ${item.qty}</span></span>
            <span class="font-medium text-stone-800">${formatPrice(item.price * item.qty)}</span>
        </li>`).join('') + `
        <li class="flex justify-between pt-2 mt-1 border-t border-brand-200 font-bold text-brand-800">
            <span>Total</span><span>${formatPrice(order.total)}</span>
        </li>`;

    $('#checkout-form-view').classList.add('hidden');
    $('#checkout-success-view').classList.remove('hidden');
    $('#order-heading').focus();
}


/* ---------- 7. Page behaviour ---------- */

// Toast notification (one timer, so rapid clicks don't hide it early)
let toastTimer;
function showToast(message, type = 'success') {
    const toast = $('#toast');
    const icon = $('#toast-icon');

    $('#toast-msg').textContent = message;
    icon.className = type === 'error'
        ? 'fa-solid fa-circle-exclamation text-amber-400 text-lg'
        : 'fa-solid fa-circle-check text-emerald-400 text-lg';
    toast.classList.remove('translate-y-20', 'opacity-0');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
}

// Mobile menu
const menuBtn = $('#mobile-menu-btn');
const mobileMenu = $('#mobile-menu');

function setMobileMenu(open) {
    mobileMenu.classList.toggle('hidden', !open);
    menuBtn.setAttribute('aria-expanded', String(open));
    const icon = $('i', menuBtn);
    icon.classList.toggle('fa-bars', !open);
    icon.classList.toggle('fa-xmark', open);
}

// Header shadow + highlight the nav link for the section you're reading
const spySections = ['hero', 'catalog', 'about', 'reviews', 'contact']
    .map((id) => document.getElementById(id)).filter(Boolean);
let scrollQueued = false;

function onScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
        scrollQueued = false;
        $('header').classList.toggle('shadow-md', window.scrollY > 10);

        const probe = window.scrollY + 120;
        let current = spySections[0].id;
        spySections.forEach((s) => {
            if (s.getBoundingClientRect().top + window.scrollY <= probe) current = s.id;
        });
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = 'contact';

        document.querySelectorAll('header nav a').forEach((link) => {
            const active = link.getAttribute('href') === '#' + current;
            link.classList.toggle('is-active', active);
            if (active) link.setAttribute('aria-current', 'true');
            else link.removeAttribute('aria-current');
        });
    });
}


/* ---------- 8. Init ---------- */
function init() {
    buildCatalog();
    cart = loadCart();
    updateCart();

    // Header buttons
    $('#cart-btn').addEventListener('click', openCart);
    $('#search-btn').addEventListener('click', openSearch);

    // Cart drawer
    $('#cart-close').addEventListener('click', closeLayer);
    $('#cart-continue').addEventListener('click', () => {
        closeLayer();
        document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
    });
    $('#cart-items').addEventListener('click', handleCartItemClick);
    $('#clear-cart-btn').addEventListener('click', () => { clearCart(); showToast('Cart cleared.'); });
    $('#checkout-btn').addEventListener('click', openCheckout);

    // Search
    $('#search-close').addEventListener('click', closeLayer);
    $('#search-input').addEventListener('input', (e) => renderSearchResults(e.target.value));
    $('#search-input').addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const [first] = searchProducts(e.target.value);
        if (first) goToProduct(first.name);
    });
    $('#search-results').addEventListener('click', handleSearchClick);

    // Checkout
    $('#checkout-close').addEventListener('click', closeLayer);
    $('#checkout-form').addEventListener('submit', placeOrder);
    $('#order-done').addEventListener('click', closeLayer);

    // Clicking the dimmed backdrop closes whatever is open
    $('#overlay').addEventListener('click', closeLayer);
    ['search-modal', 'checkout-modal'].forEach((id) => {
        document.getElementById(id).addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeLayer();
        });
    });

    // Keyboard: Esc closes, Tab stays inside the open panel
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (activeLayer) closeLayer();
            else setMobileMenu(false);
        } else if (e.key === 'Tab' && activeLayer) {
            trapFocus(e);
        }
    });

    // Mobile menu
    menuBtn.addEventListener('click', () => setMobileMenu(mobileMenu.classList.contains('hidden')));
    document.querySelectorAll('#mobile-menu a').forEach((link) => {
        link.addEventListener('click', () => setMobileMenu(false));
    });

    // Scroll behaviour
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
}

init();
