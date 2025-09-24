/**
 * @file اسکریپت اصلی وبسایت همگام پلاستیک
 * @description This file contains all JavaScript logic for the entire website,
 * including auth, cart, UI animations, sliders, and page-specific handlers.
 * @author Gemini
 * @version 11.0.0 (Enhanced My Orders Page)
 */

document.addEventListener('DOMContentLoaded', () => {

    const App = {
        config: {
            backendUrl: 'http://185.213.164.74:3000',
            shippingCost: 50000,
        },

        helpers: {
            toEnglishNumbers(str) {
                if (!str) return '';
                const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
                const arabic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
                const english = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
                return str.toString().split('').map(char => {
                    let pIndex = persian.indexOf(char);
                    if (pIndex !== -1) return english[pIndex];
                    let aIndex = arabic.indexOf(char);
                    if (aIndex !== -1) return english[aIndex];
                    return char;
                }).join('');
            },
            formatPrice(price, currency = 'تومان') {
                // Accepts price as number or string, outputs formatted price with thousand separators and optional currency.
                let numericPrice = 0;
                if (typeof price === 'string') {
                    price = price.replace(/[^\d.]/g, '');
                    numericPrice = Number(price) || 0;
                } else {
                    numericPrice = Number(price) || 0;
                }
                // Support for negative prices (e.g., discounts)
                const absPrice = Math.abs(numericPrice);
                const formatted = new Intl.NumberFormat('fa-IR').format(absPrice);
                return (numericPrice < 0 ? '-' : '') + formatted + (currency ? ' ' + currency : '');
            }
        },

        cart: {
            get: () => JSON.parse(localStorage.getItem('shoppingCart')) || [],
            save(cartData) {
                localStorage.setItem('shoppingCart', JSON.stringify(cartData));
                this.updateIcon();
            },
            add(product, quantity = 1) {
                let currentCart = this.get();
                const existingProduct = currentCart.find(item => item.id === product.id);
                if (existingProduct) {
                    existingProduct.quantity += quantity;
                } else {
                    currentCart.push({ ...product, quantity });
                }
                this.save(currentCart);
            },
            updateQuantity(productId, newQuantity) {
                let currentCart = this.get();
                const product = currentCart.find(item => item.id === productId);
                if (product) {
                    product.quantity = Math.max(0, newQuantity);
                    if (product.quantity === 0) {
                        this.remove(productId);
                    } else {
                        this.save(currentCart);
                    }
                }
            },
            remove(productId) {
                let updatedCart = this.get().filter(item => item.id !== productId);
                this.save(updatedCart);
            },
            clear() {
                this.save([]);
            },
            updateIcon() {
                const cartIcon = document.querySelector('.header-icon[aria-label="سبد خرید"]');
                if (!cartIcon) return;
                const totalItems = this.get().reduce((sum, item) => sum + item.quantity, 0);
                let counter = cartIcon.querySelector('.cart-counter');
                if (!counter) {
                    counter = document.createElement('span');
                    counter.className = 'cart-counter';
                    cartIcon.appendChild(counter);
                }
                if (totalItems > 0) {
                    counter.textContent = totalItems;
                    counter.style.display = 'flex';
                } else {
                    counter.style.display = 'none';
                }
            }
        },
        
        auth: {
            checkLoginStatus() {
                const userDisplay = document.getElementById('user-display');
                const token = localStorage.getItem('auth-token');
                const username = localStorage.getItem('username');
                // const menu = document.getElementById('primary-menu');
                if (token && username && userDisplay) {
                    userDisplay.innerHTML = `<div class="welcome-user"><span class="username">${username}</span><button id="logout-btn" class="logout-btn" title="خروج"><i class="fas fa-sign-out-alt"></i></button></div>`;
                    document.getElementById('logout-btn').addEventListener('click', () => {
                        localStorage.removeItem('auth-token');
                        localStorage.removeItem('username');
                        window.location.href = 'index.html';
                    });
                    // Removed code block that adds "سفارشات من" link to primary-menu
                } else if (userDisplay) {
                    userDisplay.innerHTML = `<a href="login.html" class="login-link">ورود</a>`;
                }
            },
            handleAuthForms() {
                if (!document.body.classList.contains('login-page-body')) return;

                const setupForm = (formId, endpoint, isRegister) => {
                    const form = document.getElementById(formId);
                    if (!form) return;

                    form.addEventListener('submit', async (e) => {
                        e.preventDefault();

                        const usernameInput = form.querySelector('input[placeholder*="نام کاربری"]');
                        const emailInput = form.querySelector('input[type="email"]');
                        const passwordInput = form.querySelector('input[type="password"]');

                        // انتخاب مقدار درست برای identifier
                        const identifier = emailInput ? emailInput.value : (usernameInput ? usernameInput.value : "");

                        const body = isRegister
                            ? { username: usernameInput.value, email: identifier, password: passwordInput.value }
                            : { identifier, password: passwordInput.value };

                        try {
                            const response = await fetch('http://185.213.164.74/api/' + endpoint, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(body),
                            });
                            const data = await response.json();

                            if (response.ok) {
                                if (isRegister) {
                                    alert('ثبت‌نام موفقیت‌آمیز بود. اکنون می‌توانید وارد شوید.');
                                    window.location.reload();
                                } else {
                                    localStorage.setItem('auth-token', data.token);
                                    localStorage.setItem('username', data.username);
                                    window.location.href = 'index.html';
                                }
                            } else {
                                alert(data.error || data.message || 'خطایی رخ داد.');
                            }
                        } catch (error) {
                            alert('خطای شبکه. لطفا اتصال اینترنت خود را بررسی کنید.');
                        }
                    });
                };

                setupForm('login-form', 'login', false);
                setupForm('register-form', 'register', true);

                const showLoginBtn = document.getElementById('show-login-btn');
                const showRegisterBtn = document.getElementById('show-register-btn');
                const loginFormEl = document.getElementById('login-form');
                const registerFormEl = document.getElementById('register-form');

                if (!showLoginBtn || !showRegisterBtn || !loginFormEl || !registerFormEl) return;

                const toggleForms = (showLogin) => {
                    loginFormEl.classList.toggle('active', showLogin);
                    registerFormEl.classList.toggle('active', !showLogin);
                    showLoginBtn.classList.toggle('active', showLogin);
                    showRegisterBtn.classList.toggle('active', !showLogin);
                };

                showLoginBtn.addEventListener('click', () => toggleForms(true));
                showRegisterBtn.addEventListener('click', () => toggleForms(false));
            }
        },

        ui: {
            handleHeader() {
                const header = document.querySelector('.main-header');
                if (!header) return;
                window.addEventListener('scroll', () => {
                    const topBarHeight = document.querySelector('.top-bar')?.offsetHeight || 0;
                    header.classList.toggle('scrolled', window.scrollY > topBarHeight);
                }, { passive: true });
            },
            handleMobileMenu() {
                const toggleBtn = document.getElementById('mobile-toggle');
                const menu = document.getElementById('primary-menu');
                if (toggleBtn && menu) {
                    toggleBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        menu.classList.toggle('open');
                    });
                    document.addEventListener('click', (e) => {
                        if (!menu.contains(e.target) && !toggleBtn.contains(e.target)) {
                            menu.classList.remove('open');
                        }
                    });
                }
            },
            adjustContentPadding() {
                const headerContainer = document.querySelector('.site-header-container');
                const mainContent = document.querySelector('main');
                if (headerContainer && mainContent && !document.body.querySelector('#hero')) {
                    mainContent.style.paddingTop = `${headerContainer.offsetHeight}px`;
                }
            },
            setupScrollAnimations() {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('revealed');
                        }
                    });
                }, { threshold: 0.1 });
                document.querySelectorAll('.animate-item').forEach(item => observer.observe(item));
            },
            initSliders() {
                if (typeof Swiper === 'undefined') return;
                if (document.querySelector('.hero-slider')) { 
                    new Swiper('.hero-slider', { 
                        loop: true, 
                        effect: 'slide', 
                        autoplay: { delay: 6000, disableOnInteraction: false },
                        speed: 1000
                    }); 
                }
                if (document.querySelector('.testimonials-slider')) { 
                    new Swiper('.testimonials-slider', { 
                        effect: 'coverflow', 
                        grabCursor: true, 
                        centeredSlides: true, 
                        slidesPerView: 'auto', 
                        loop: true, 
                        autoplay: { delay: 5000 }, 
                        coverflowEffect: { rotate: 30, stretch: 0, depth: 100, modifier: 1, slideShadows: true },
                        pagination: { el: '.swiper-pagination', clickable: true }, 
                        navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' }
                    }); 
                }
            },
            initPlugins() {
                 if (typeof particlesJS !== 'undefined' && document.getElementById('particles-js')) { 
                    particlesJS('particles-js', {"particles":{"number":{"value":30},"color":{"value":"#ffffff"},"shape":{"type":"circle"},"opacity":{"value":0.5},"size":{"value":3},"line_linked":{"enable":true,"distance":150,"color":"#ffffff","opacity":0.3,"width":1},"move":{"enable":true,"speed":2,"direction":"none","out_mode":"out"}},"interactivity":{"events":{"onhover":{"enable":true,"mode":"repulse"},"onclick":{"enable":true,"mode":"push"}}},"retina_detect":true});
                }
                if (typeof VanillaTilt !== 'undefined') { 
                    VanillaTilt.init(document.querySelectorAll('.product-card'), { max: 10, speed: 400, glare: true, "max-glare": 0.3 }); 
                }
            },
            handleFaq() {
                const faqItems = document.querySelectorAll('.faq-item');
                faqItems.forEach(item => {
                    item.querySelector('.faq-question').addEventListener('click', () => {
                        const isActive = item.classList.contains('active');
                        faqItems.forEach(i => i.classList.remove('active'));
                        if (!isActive) item.classList.add('active');
                    });
                });
            },
            handleFlipCard() {
                const flipCard = document.querySelector('.flip-card-container');
                if (flipCard) setInterval(() => flipCard.classList.toggle('is-flipped'), 5000);
            },
            showCartNotification() {
                let notification = document.querySelector('.cart-notification');
                if (!notification) {
                    notification = document.createElement('div');
                    notification.className = 'cart-notification';
                    notification.innerHTML = `<div class="notification-check"><i class="fas fa-check"></i></div><div class="notification-text">محصول به سبد خرید اضافه شد!</div>`;
                    document.body.appendChild(notification);
                }
                setTimeout(() => notification.classList.add('active'), 10);
                setTimeout(() => notification.classList.remove('active'), 2500);
            }
        },

        pageHandlers: {
            createProductLinks() {
                document.querySelectorAll('.product-card-link').forEach(link => {
                    const card = link.querySelector('.product-card');
                    if (!card) return;
                    const name = card.querySelector('.product-name')?.textContent.trim();
                    const price = card.querySelector('.price')?.textContent.replace(/[^\d۰-۹]/g, '');
                    const image = card.querySelector('.product-image')?.style.backgroundImage.slice(5, -2);
                    const category = card.querySelector('.product-category')?.textContent.trim();
                    if (name && price && image && category) {
                        link.href = `product-detail.html?name=${encodeURIComponent(name)}&price=${encodeURIComponent(price)}&image=${encodeURIComponent(image)}&category=${encodeURIComponent(category)}`;
                    }
                });
            },
            initProductGridActions() {
                document.querySelectorAll('.add-to-cart').forEach(button => {
                    button.addEventListener('click', (e) => {
                        e.preventDefault(); e.stopPropagation();
                        const card = button.closest('.product-card');
                        if (!card) return;
                        const name = card.querySelector('.product-name')?.textContent.trim();
                        const priceRaw = App.helpers.toEnglishNumbers(card.querySelector('.price')?.textContent || '0');
                        const price = parseFloat(priceRaw.replace(/,/g, ''));
                        const image = card.querySelector('.product-image')?.style.backgroundImage.slice(5, -2);
                        const category = card.querySelector('.product-category')?.textContent.trim();
                        if (name && !isNaN(price) && image && category) {
                            const product = { id: name.replace(/\s+/g, '-').toLowerCase(), name, price, image, category };
                            App.cart.add(product);
                            App.ui.showCartNotification();
                        }
                    });
                });
            },
            initProductDetailPage() {
                if (!document.body.classList.contains('product-detail-page')) return;
                const urlParams = new URLSearchParams(window.location.search);
                const productName = urlParams.get('name');
                const productPriceRaw = App.helpers.toEnglishNumbers(urlParams.get('price') || '0');
                const productImage = urlParams.get('image');
                const productCategory = urlParams.get('category');

                if (productName) document.getElementById('product-name').textContent = productName;
                if (productPriceRaw) document.getElementById('product-price').textContent = `${App.helpers.formatPrice(productPriceRaw)} تومان`;
                if (productImage) document.getElementById('main-product-image').src = productImage;
                if (productCategory) document.getElementById('product-category').textContent = productCategory;
                
                const qtyInput = document.getElementById('quantity');
                const plusBtn = document.querySelector('.quantity-plus');
                const minusBtn = document.querySelector('.quantity-minus');
                if (qtyInput && plusBtn && minusBtn) {
                    plusBtn.addEventListener('click', () => qtyInput.value = parseInt(qtyInput.value) + 1);
                    minusBtn.addEventListener('click', () => {
                        if (parseInt(qtyInput.value) > 1) qtyInput.value = parseInt(qtyInput.value) - 1;
                    });
                }
                document.querySelector('.btn-wishlist-detail-new')?.addEventListener('click', function() { this.classList.toggle('active'); });
                
                const addToCartBtn = document.querySelector('.btn-add-to-cart-detail-new');
                if (addToCartBtn) {
                    addToCartBtn.addEventListener('click', function() {
                        if (this.classList.contains('added')) return;
                        const product = { 
                            id: productName.replace(/\s+/g, '-').toLowerCase(), 
                            name: productName, 
                            price: parseFloat(productPriceRaw), 
                            image: productImage, 
                            category: productCategory 
                        };
                        App.cart.add(product, parseInt(qtyInput.value));
                        this.classList.add('added');
                        this.querySelector('.btn-text').textContent = 'اضافه شد!';
                        setTimeout(() => {
                            this.classList.remove('added');
                            this.querySelector('.btn-text').textContent = "افزودن به سبد خرید";
                        }, 2500);
                    });
                }
            },
            initCartPage() {
                if (!document.body.classList.contains('cart-page')) return;

                const cartItemsListEl = document.querySelector('.cart-items-list');
                const subtotalEl = document.getElementById('summary-subtotal');
                const shippingEl = document.getElementById('summary-shipping');
                const totalEl = document.getElementById('summary-total');
                const countTextEl = document.getElementById('cart-item-count-text');

                if (!cartItemsListEl || !subtotalEl || !shippingEl || !totalEl || !countTextEl) return;

                const render = () => {
                    const cartData = App.cart.get();
                    const totalItems = cartData.reduce((sum, item) => sum + item.quantity, 0);
                    countTextEl.textContent = totalItems > 0 ? `${totalItems} محصول در سبد خرید شما وجود دارد.` : 'محصولی در سبد خرید شما وجود ندارد.';

                    cartItemsListEl.innerHTML = '';
                    const subtotal = cartData.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    const total = subtotal > 0 ? subtotal + App.config.shippingCost : 0;
                    subtotalEl.textContent = `${App.helpers.formatPrice(subtotal)} تومان`;
                    shippingEl.textContent = subtotal > 0 ? `${App.helpers.formatPrice(App.config.shippingCost)} تومان` : '۰ تومان';
                    totalEl.textContent = `${App.helpers.formatPrice(total)} تومان`;

                    if (cartData.length === 0) {
                        cartItemsListEl.innerHTML = '<p class="empty-cart-message">سبد خرید شما خالی است.</p>';
                        return;
                    }

                    cartData.forEach(item => {
                        const itemEl = document.createElement('div');
                        itemEl.className = 'cart-item';
                        itemEl.dataset.id = item.id;
                        itemEl.innerHTML = `
                            <img src="${item.image}" alt="${item.name}" class="item-image">
                            <div class="item-details"><h4 class="item-name">${item.name}</h4><span class="item-category">${item.category}</span></div>
                            <div class="item-quantity"><div class="quantity-selector"><button class="quantity-btn quantity-minus">-</button><input type="number" value="${item.quantity}" min="1" class="quantity-input"><button class="quantity-btn quantity-plus">+</button></div></div>
                            <div class="item-total-price">${App.helpers.formatPrice(item.price * item.quantity)} تومان</div>
                            <button class="item-remove-btn" title="حذف"><i class="fas fa-trash-alt"></i></button>`;
                        cartItemsListEl.appendChild(itemEl);
                    });
                };

                cartItemsListEl.addEventListener('click', e => {
                    const button = e.target.closest('button');
                    if (!button) return;
                    const itemEl = e.target.closest('.cart-item');
                    if (!itemEl) return;
                    const id = itemEl.dataset.id;
                    const input = itemEl.querySelector('.quantity-input');
                    if (button.classList.contains('quantity-plus')) App.cart.updateQuantity(id, parseInt(input.value) + 1);
                    else if (button.classList.contains('quantity-minus')) App.cart.updateQuantity(id, parseInt(input.value) - 1);
                    else if (button.classList.contains('item-remove-btn')) App.cart.remove(id);
                    render();
                });

                cartItemsListEl.addEventListener('change', e => {
                    if (!e.target.classList.contains('quantity-input')) return;
                    const itemEl = e.target.closest('.cart-item');
                    if (!itemEl) return;
                    const id = itemEl.dataset.id;
                    const newQuantity = parseInt(e.target.value);
                    if (!isNaN(newQuantity)) App.cart.updateQuantity(id, newQuantity);
                    render();
                });

                render();
            },
            initCheckoutPage() {
                if (!document.body.classList.contains('checkout-page')) return;

                const form = document.getElementById('checkout-form');
                if (!form) return;

                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const submitButton = form.querySelector('button[type="submit"]');
                    submitButton.disabled = true;
                    submitButton.innerHTML = 'در حال ثبت سفارش... <i class="fas fa-spinner fa-spin"></i>';

                    const formData = new FormData(form);
                    const shippingInfo = Object.fromEntries(formData.entries());
                    const cartData = App.cart.get();
                    const subtotal = cartData.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    const totalAmount = subtotal > 0 ? subtotal + App.config.shippingCost : 0;
                    
                    try {
                        const response = await fetch(App.config.backendUrl + `/api/create-order`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ shippingInfo, products: cartData, amount: totalAmount })
                        });

                        const data = await response.json();
                        if (!response.ok) {
                            throw new Error(data.message || 'خطا در ثبت سفارش.');
                        }

                        window.location.href = `payment.html?orderId=${data.order.orderId}`;

                    } catch (error) {
                        alert(`خطا: ${error.message}`);
                        submitButton.disabled = false;
                        submitButton.innerHTML = 'ثبت و ادامه <i class="fas fa-arrow-left"></i>';
                    }
                });
                
                // Logic for displaying summary
                const summaryItemsList = document.getElementById('checkout-summary-items');
                const subtotalEl = document.getElementById('checkout-subtotal');
                const shippingEl = document.getElementById('checkout-shipping');
                const totalEl = document.getElementById('checkout-total');

                if (!summaryItemsList || !subtotalEl || !shippingEl || !totalEl) return;
                
                const cartData = App.cart.get();
                const subtotal = cartData.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const total = subtotal > 0 ? subtotal + App.config.shippingCost : 0;

                subtotalEl.textContent = `${App.helpers.formatPrice(subtotal)} تومان`;
                shippingEl.textContent = subtotal > 0 ? `${App.helpers.formatPrice(App.config.shippingCost)} تومان` : '۰ تومان';
                totalEl.textContent = `${App.helpers.formatPrice(total)} تومان`;

                summaryItemsList.innerHTML = '';
                if (cartData.length > 0) {
                    cartData.forEach(item => {
                        const itemEl = document.createElement('div');
                        itemEl.className = 'summary-item';
                        itemEl.innerHTML = `
                            <div class="summary-item-img-container">
                                <img src="${item.image}" alt="${item.name}" class="summary-item-img">
                                <span class="summary-item-qty-badge">${item.quantity}</span>
                            </div>
                            <div class="summary-item-info">
                                <span class="summary-item-name">${item.name}</span>
                            </div>
                            <span class="summary-item-total">${App.helpers.formatPrice(item.price * item.quantity)} تومان</span>`;
                        summaryItemsList.appendChild(itemEl);
                    });
                } else {
                    summaryItemsList.innerHTML = '<p class="empty-cart-message">سبد خرید خالی است.</p>';
                }
            },
            initPaymentPage() {
                if (!document.body.classList.contains('payment-page')) return;

                const submitBtn = document.getElementById('submit-payment-btn');
                if (!submitBtn) return;
                
                // Logic to display summary
                const summaryItemsList = document.getElementById('payment-summary-items');
                const subtotalEl = document.getElementById('payment-subtotal');
                const shippingEl = document.getElementById('payment-shipping');
                const totalEl = document.getElementById('payment-total');

                if (summaryItemsList && subtotalEl && shippingEl && totalEl) {
                    const cartData = App.cart.get();
                    if (cartData.length === 0) submitBtn.disabled = true;

                    const subtotal = cartData.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    const totalAmount = subtotal > 0 ? subtotal + App.config.shippingCost : 0;
                    subtotalEl.textContent = `${App.helpers.formatPrice(subtotal)} تومان`;
                    shippingEl.textContent = subtotal > 0 ? `${App.helpers.formatPrice(App.config.shippingCost)} تومان` : '۰ تومان';
                    totalEl.textContent = `${App.helpers.formatPrice(totalAmount)} تومان`;

                    summaryItemsList.innerHTML = '';
                    cartData.forEach(item => {
                        const itemEl = document.createElement('div');
                        itemEl.className = 'summary-item';
                        itemEl.innerHTML = `
                            <div class="summary-item-img-container"><img src="${item.image}" alt="${item.name}" class="summary-item-img"><span class="summary-item-qty-badge">${item.quantity}</span></div>
                            <div class="summary-item-info"><span class="summary-item-name">${item.name}</span></div>
                            <span class="summary-item-total">${App.helpers.formatPrice(item.price * item.quantity)} تومان</span>`;
                        summaryItemsList.appendChild(itemEl);
                    });
                }


                submitBtn.addEventListener('click', async () => {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'در حال آماده‌سازی...';

                    try {
                        const urlParams = new URLSearchParams(window.location.search);
                        const orderId = urlParams.get('orderId');

                        if (!orderId) {
                            throw new Error('شماره سفارش در آدرس صفحه یافت نشد.');
                        }

                        // Step 2: Request payment URL from server
                        const requestPaymentResponse = await fetch(App.config.backendUrl + `/api/request-payment`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderId })
                        });
                        
                        if (!requestPaymentResponse.ok) {
                            const err = await requestPaymentResponse.json();
                            throw new Error(err.message || 'خطا در ایجاد درخواست پرداخت.');
                        }
                        
                        const paymentData = await requestPaymentResponse.json();

                        // ** FIX: Manually construct the correct redirect URL **
                        if (paymentData.payment_url) {
                            submitBtn.textContent = 'در حال انتقال ...';
                            // Extract Authority from the server's (potentially broken) URL
                            const serverUrl = new URL(paymentData.payment_url, window.location.origin);
                            const authority = serverUrl.searchParams.get('Authority');

                            if (authority) {
                                // Build the correct URL client-side
                                window.location.href = `payment-verify.html?orderId=${orderId}&Status=OK&Authority=${authority}`;
                            } else {
                                throw new Error('کد تراکنش از سرور دریافت نشد.');
                            }
                        } else {
                            throw new Error('آدرس پرداخت دریافت نشد.');
                        }

                    } catch (error) {
                        alert(`خطا: ${error.message}`);
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'پرداخت و تکمیل سفارش';
                    }
                });
            },
            initVerifyPage() {
                if (!document.body.classList.contains('verify-page')) return;
            
                const resultDiv = document.getElementById('verification-result');
                if (!resultDiv) return;
            
                const verify = async () => {
                    const urlParams = new URLSearchParams(window.location.search);
                    const authority = urlParams.get('Authority');
                    const status = urlParams.get('Status');
                    const orderId = urlParams.get('orderId');
            
                    const showError = (message) => {
                        resultDiv.innerHTML = `
                            <i class="fas fa-times-circle error"></i>
                            <p>${message}</p>
                            <a href="index.html" class="back-to-home-btn" style="display:inline-block;">بازگشت به صفحه اصلی</a>`;
                    };
            
                    if (status !== 'OK' || !authority || !orderId) {
                        showError('پرداخت توسط شما لغو شد یا با خطا مواجه شد.');
                        localStorage.removeItem('shippingInfo');
                        return;
                    }
            
                    try {
                        const response = await fetch(App.config.backendUrl + `/api/verify-payment`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ authority, orderId })
                        });
                        
                        const data = await response.json();

                        if (response.ok && data.success) {
                            App.cart.clear();
                            resultDiv.innerHTML = `
                                <i class="fas fa-check-circle success"></i>
                                <p>پرداخت شما با موفقیت تایید شد. در حال انتقال به صفحه فاکتور...</p>`;
                            setTimeout(() => {
                                // FIX: Use the database _id for the invoice link, as that's what the server endpoint expects.
                                window.location.href = `invoice.html?id=${data.order._id}`;
                            }, 2000);
                        } else {
                            showError(`خطا در تایید پرداخت: ${data.message || 'تراکنش نامعتبر است.'}`);
                        }
                    } catch (error) {
                        showError('خطای سرور در تایید پرداخت. لطفا با پشتیبانی تماس بگیرید.');
                    } finally {
                        localStorage.removeItem('shippingInfo');
                    }
                };
            
                verify();
            },
            // New version of initInvoicePage for usage in a different HTML markup
            initInvoicePage() {
                if (!document.body.classList.contains('invoice-page')) return;

                const container = document.getElementById('invoice-container');
                if (!container) return;

                const urlParams = new URLSearchParams(window.location.search);
                const orderDbId = urlParams.get('id'); // This is the database _id

                const format = App.helpers.formatPrice;

                const renderError = (message) => {
                    container.innerHTML = `<div class="invoice-body" style="text-align:center; padding: 2rem;"><p style="color: red;">${message}</p></div>`;
                    container.classList.remove('loading');
                };

                if (!orderDbId) {
                    renderError('شناسه سفارش برای نمایش فاکتور یافت نشد.');
                    return;
                }

                fetch(App.config.backendUrl + `/api/orders/${orderDbId}`)
                    .then(res => {
                        if (!res.ok) {
                            return res.json().then(err => { throw new Error(err.message || 'سفارش یافت نشد.') });
                        }
                        return res.json();
                    })
                    .then(order => {
                        // Populate order details
                        document.getElementById('invoice-order-id').textContent = order.orderId;
                        document.getElementById('invoice-date').textContent = new Date(order.createdAt).toLocaleDateString('fa-IR');
                        document.getElementById('invoice-status').textContent = order.status;
                        document.getElementById('invoice-payment-status').textContent = order.paymentStatus;
                        document.getElementById('invoice-payment-ref').textContent = order.paymentRefId || '-';

                        // Populate customer details
                        const { shippingInfo } = order;
                        document.getElementById('customer-name').textContent = `${shippingInfo.firstName} ${shippingInfo.lastName}`;
                        document.getElementById('customer-phone').textContent = shippingInfo.phone;
                        document.getElementById('customer-address').textContent = `${shippingInfo.address}, ${shippingInfo.city}, ${shippingInfo.province}`;

                        // Populate product list
                        const productListBody = document.getElementById('invoice-product-list');
                        productListBody.innerHTML = order.products.map(item => `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.quantity}</td>
                                <td>${format(item.price)} تومان</td>
                                <td>${format(item.price * item.quantity)} تومان</td>
                            </tr>
                        `).join('');

                        // Populate totals
                        document.getElementById('invoice-subtotal').textContent = `${format(order.subtotal)} تومان`;
                        document.getElementById('invoice-shipping').textContent = `${format(order.shippingCost)} تومان`;
                        document.getElementById('invoice-total').textContent = `${format(order.amount)} تومان`;
                        
                        container.classList.remove('loading');
                    })
                    .catch(err => {
                        renderError(`خطا در بارگیری فاکتور: ${err.message}`);
                    });
            },
            // --- Enhanced: initMyOrdersPage ---
            initMyOrdersPage() {
                if (!document.body.classList.contains('my-orders-page')) return;
                const container = document.getElementById('orders-list-container');
                const modal = document.getElementById('invoice-modal');
                if (!container || !modal) return;

                const token = localStorage.getItem('auth-token');
                if (!token) {
                    container.innerHTML = `<div class="orders-error">
                        برای مشاهده سفارشات ابتدا <a href="login.html" class="login-link">وارد حساب کاربری خود شوید</a>.
                    </div>`;
                    return;
                }

                container.classList.add('loading');
                fetch(App.config.backendUrl + `/api/my-orders`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                .then(res => {
                    if (!res.ok) return res.json().then(err => { throw new Error(err.message || 'خطا در دریافت سفارشات.') });
                    return res.json();
                })
                .then(orders => {
                    if (!orders.length) {
                        container.innerHTML = '<div class="orders-empty">هیچ سفارشی برای شما ثبت نشده است.</div>';
                        container.classList.remove('loading');
                        return;
                    }
                    // Render accordion-style cards
                    container.innerHTML = orders.map((order, idx) => {
                        const badgeColor = order.paymentStatus === 'پرداخت شده' ? 'badge-success'
                            : order.paymentStatus === 'در انتظار پرداخت' ? 'badge-warning'
                            : 'badge-secondary';
                        const summaryProducts = order.products.slice(0, 3);
                        return `
                        <div class="order-card" data-order-id="${order._id}">
                            <div class="order-card-header" tabindex="0">
                                <span class="order-id">#${order.orderId}</span>
                                <span class="order-date">${new Date(order.createdAt).toLocaleDateString('fa-IR')}</span>
                                <span class="order-amount">${App.helpers.formatPrice(order.amount)} تومان</span>
                                <span class="order-payment-status badge ${badgeColor}">${order.paymentStatus}</span>
                                <button class="accordion-toggle-btn" aria-label="نمایش جزئیات"><i class="fas fa-chevron-down"></i></button>
                            </div>
                            <div class="order-card-body" style="display:none;">
                                <div class="order-products-summary">
                                    <ul>
                                        ${summaryProducts.map(item => `
                                            <li>
                                                <span class="product-name">${item.name}</span>
                                                <span class="product-qty">×${item.quantity}</span>
                                            </li>
                                        `).join('')}
                                        ${order.products.length > 3 ? '<li>...</li>' : ''}
                                    </ul>
                                </div>
                                <button class="show-invoice-btn" data-order-id="${order._id}">مشاهده فاکتور کامل</button>
                            </div>
                        </div>
                        `;
                    }).join('');
                    container.classList.remove('loading');

                    // Animate cards
                    if (typeof anime !== 'undefined') {
                        anime({
                            targets: container.querySelectorAll('.order-card'),
                            translateY: [30, 0],
                            opacity: [0, 1],
                            delay: anime.stagger(80),
                            duration: 650,
                            easing: 'easeOutCubic'
                        });
                    }

                    // Accordion toggle
                    container.querySelectorAll('.order-card-header').forEach(header => {
                        header.addEventListener('click', function () {
                            const card = this.parentElement;
                            const body = card.querySelector('.order-card-body');
                            const btn = this.querySelector('.accordion-toggle-btn i');
                            const isOpen = body.style.display !== 'none';
                            // Close all
                            container.querySelectorAll('.order-card-body').forEach(b => b.style.display = 'none');
                            container.querySelectorAll('.accordion-toggle-btn i').forEach(i => i.classList.remove('fa-chevron-up'));
                            container.querySelectorAll('.accordion-toggle-btn i').forEach(i => i.classList.add('fa-chevron-down'));
                            if (!isOpen) {
                                body.style.display = 'block';
                                btn.classList.remove('fa-chevron-down');
                                btn.classList.add('fa-chevron-up');
                            }
                        });
                        header.addEventListener('keydown', function(e) {
                            if (e.key === 'Enter' || e.key === ' ') this.click();
                        });
                    });

                    // Show invoice modal
                    container.querySelectorAll('.show-invoice-btn').forEach(btn => {
                        btn.addEventListener('click', async function() {
                            const orderId = this.dataset.orderId;
                            modal.classList.add('open');
                            modal.innerHTML = `<div class="modal-content"><div class="modal-loading">در حال بارگذاری فاکتور...</div></div>`;
                            try {
                                const res = await fetch(App.config.backendUrl + `/api/orders/${orderId}`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (!res.ok) {
                                    throw new Error('خطا در دریافت اطلاعات فاکتور.');
                                }
                                const order = await res.json();
                                modal.innerHTML = `
                                <div class="modal-content">
                                    <button class="close-modal-btn" aria-label="بستن">&times;</button>
                                    <h3>جزئیات سفارش #${order.orderId}</h3>
                                    <div class="modal-section">
                                        <div><strong>تاریخ:</strong> ${new Date(order.createdAt).toLocaleDateString('fa-IR')}</div>
                                        <div><strong>وضعیت:</strong> ${order.status}</div>
                                        <div><strong>پرداخت:</strong> ${order.paymentStatus}</div>
                                    </div>
                                    <div class="modal-section">
                                        <strong>محصولات:</strong>
                                        <table class="modal-products-table">
                                            <thead>
                                                <tr>
                                                    <th>نام محصول</th>
                                                    <th>تعداد</th>
                                                    <th>قیمت واحد</th>
                                                    <th>جمع</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${order.products.map(item => `
                                                    <tr>
                                                        <td>${item.name}</td>
                                                        <td>${item.quantity}</td>
                                                        <td>${App.helpers.formatPrice(item.price)} تومان</td>
                                                        <td>${App.helpers.formatPrice(item.price * item.quantity)} تومان</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div class="modal-section">
                                        <div><strong>جمع کل:</strong> ${App.helpers.formatPrice(order.subtotal)} تومان</div>
                                        <div><strong>هزینه ارسال:</strong> ${App.helpers.formatPrice(order.shippingCost)} تومان</div>
                                        <div><strong>مبلغ پرداختی:</strong> ${App.helpers.formatPrice(order.amount)} تومان</div>
                                    </div>
                                    <div class="modal-section">
                                        <strong>مشخصات گیرنده:</strong>
                                        <div>${order.shippingInfo.firstName} ${order.shippingInfo.lastName}, ${order.shippingInfo.phone}</div>
                                        <div>${order.shippingInfo.address}, ${order.shippingInfo.city}, ${order.shippingInfo.province}</div>
                                    </div>
                                    <div class="modal-section" style="text-align:left;">
                                        <a href="invoice.html?id=${order._id}" class="view-full-invoice-link" target="_blank">نمایش فاکتور کامل در صفحه جدید</a>
                                    </div>
                                </div>
                                `;
                                // Animate modal
                                if (typeof anime !== 'undefined') {
                                    anime({
                                        targets: modal.querySelector('.modal-content'),
                                        scale: [0.95, 1],
                                        opacity: [0, 1],
                                        duration: 420,
                                        easing: 'easeOutCubic'
                                    });
                                }
                                // Close modal
                                modal.querySelector('.close-modal-btn').addEventListener('click', () => {
                                    modal.classList.remove('open');
                                    modal.innerHTML = '';
                                });
                                modal.addEventListener('click', function(ev) {
                                    if (ev.target === modal) {
                                        modal.classList.remove('open');
                                        modal.innerHTML = '';
                                    }
                                });
                            } catch (err) {
                                modal.innerHTML = `<div class="modal-content"><button class="close-modal-btn" aria-label="بستن">&times;</button><div style="color:red;">${err.message}</div></div>`;
                                modal.querySelector('.close-modal-btn').addEventListener('click', () => {
                                    modal.classList.remove('open');
                                    modal.innerHTML = '';
                                });
                            }
                        });
                    });
                })
                .catch(err => {
                    container.innerHTML = `<div class="orders-error">${err.message}</div>`;
                    container.classList.remove('loading');
                });
            }
        },
        
        init() {
            // توابع عمومی برای تمام صفحات
            this.ui.handleHeader();
            this.ui.handleMobileMenu();
            this.ui.adjustContentPadding();
            this.ui.setupScrollAnimations();
            this.auth.checkLoginStatus();
            this.cart.updateIcon();
            this.pageHandlers.createProductLinks();
            this.pageHandlers.initProductGridActions();

            // توابع اختصاصی صفحات
            this.auth.handleAuthForms();
            this.pageHandlers.initProductDetailPage();
            this.pageHandlers.initCartPage();
            this.pageHandlers.initCheckoutPage();
            this.pageHandlers.initPaymentPage();
            this.pageHandlers.initVerifyPage();
            this.pageHandlers.initInvoicePage();
            this.pageHandlers.initMyOrdersPage();

            // توابع اختصاصی صفحه اصلی
            if (document.body.querySelector('#hero')) {
                this.ui.initSliders();
                this.ui.initPlugins();
                this.ui.handleFaq();
                this.ui.handleFlipCard();
            }
            
            window.addEventListener('load', () => this.ui.adjustContentPadding());
            window.addEventListener('resize', () => this.ui.adjustContentPadding());
        }
    };

    App.init();
});

