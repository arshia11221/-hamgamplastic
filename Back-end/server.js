
// server.js - Professional Edition (750+ lines)
// Features: Auth, Orders, Advanced Admin Dashboard, Zarinpal, Coupons, Logging, Error Handling
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const Joi = require('joi');
const axios = require('axios');
const path = require('path');

// --- مدل‌های دیتابیس ---
const User = require('./userModel');
const Order = require('./orderModel');
const Discount = require('./discountModel');

require('dotenv').config();

const app = express();


// تست API
app.get("/api", (req, res) => {
  res.json({ message: "✅ API کار میکنه" });
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Hamgam backend is running ✅' });
});

// =========================================================================
// Middlewares (لایه‌های میانی)
// =========================================================================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "'unsafe-inline'", "kit.fontawesome.com"],
      },
    },
  })
);

const corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// app.use(express.json()); // پارس کردن درخواست‌های JSON

// Middleware برای محدود کردن تعداد درخواست‌ها
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use(limiter);

// (جدید) Middleware برای لاگ‌گیری درخواست‌ها در کنسول
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} [${duration}ms]`);
    });
    next();
});


// =========================================================================
// اتصال به دیتابیس و بررسی متغیرهای محیطی
// =========================================================================
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/hamgam-plastic-db')
  .then(() => console.log('✅ اتصال به دیتابیس MongoDB موفق بود'))
  .catch((err) => console.error('❌ خطا در اتصال به دیتابیس:', err));

const isProduction = process.env.NODE_ENV === 'production';
if (!process.env.JWT_SECRET) {
  console.error('❌ خطای حیاتی: متغیر JWT_SECRET در فایل .env تعریف نشده است.');
  process.exit(1);
}
if (isProduction && (!process.env.ZARINPAL_MERCHANT_ID || !process.env.ZARINPAL_CALLBACK_URL)) {
  console.error('❌ خطای حیاتی: در حالت Production، متغیرهای ZARINPAL_MERCHANT_ID و ZARINPAL_CALLBACK_URL الزامی هستند.');
  process.exit(1);
}

const ZARINPAL_MERCHANT_ID = process.env.ZARINPAL_MERCHANT_ID;
const ZARINPAL_API_REQUEST = 'https://api.zarinpal.com/pg/v4/payment/request.json';
const ZARINPAL_API_VERIFY = 'https://api.zarinpal.com/pg/v4/payment/verify.json';
const ZARINPAL_GATEWAY_URL = 'https://www.zarinpal.com/pg/StartPay/';

// =========================================================================
// Middleware برای احراز هویت
// =========================================================================
const authMiddleware = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).send({ message: 'دسترسی مجاز نیست. توکن ارائه نشده است.' });
    const token = authHeader.replace('Bearer ', '');
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (ex) {
        res.status(400).send({ message: 'توکن نامعتبر است.' });
    }
};

// =========================================================================
// (جدید) سرویس‌دهی فایل‌های استاتیک فرانت‌اند
// =========================================================================
app.use(express.static(path.join(__dirname, '..')));

// =========================================================================
// مسیرهای API
// =========================================================================

// --- بخش احراز هویت (ورود و ثبت‌نام) ---
const registerValidationSchema = Joi.object({
  username: Joi.string().min(3).max(30).required(),
  email: Joi.string().min(6).required().email(),
  password: Joi.string().min(6).required()
});

const loginValidationSchema = Joi.object({
  emailOrUsername: Joi.string().min(3).required(),
  password: Joi.string().min(6).required()
});

// ثبت‌نام کاربر جدید
app.post('/api/register', async (req, res, next) => {
  console.log("Received /api/register request with body:", req.body);
  try {
    const { error } = registerValidationSchema.validate(req.body);
    if (error) return res.status(400).send({ message: error.details[0].message });

    const userExists = await User.findOne({
      $or: [{ email: req.body.email }, { username: req.body.username }]
    });
    if (userExists)
      return res.status(400).send({ message: 'نام کاربری یا ایمیل قبلا ثبت شده است' });

    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = new User({
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword
    });
    await user.save();

    console.log("User registered successfully:", user.username);
    res.status(201).send({ message: 'کاربر با موفقیت ایجاد شد' });
  } catch (error) {
    console.error("Error in /api/register:", error.message);
    next(error);
  }
});

// این قطعه کد کامل و صحیح است
app.post("/api/login", async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }]
    });

    if (!user) return res.status(404).json({ error: "کاربر پیدا نشد" });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: "رمز اشتباه است" });

    const token = jwt.sign({ _id: user._id, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: "1d"
    });

    // این پاسخ هم توکن و هم یک آبجکت `user` شامل نام کاربری را برمی‌گرداند.
    res.json({
      message: "ورود موفقیت‌آمیز بود ✅",
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error("Error in /api/login:", err.message);
    res.status(500).json({ error: "خطا در سرور" });
  }
});

// --- مسیرهای محافظت‌شده برای کاربران ---
app.get('/api/my-orders', authMiddleware, async (req, res, next) => {
  console.log("Received /api/my-orders request for user:", req.user && req.user.username);
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    console.log(`/api/my-orders responded with ${orders.length} orders for user:`, req.user && req.user.username);
    res.json(orders);
  } catch (error) {
    console.error("Error in /api/my-orders:", error.message);
    next(error);
  }
});

// --- بخش کد تخفیف ---
app.post('/api/validate-coupon', async (req, res, next) => {
    console.log("Received /api/validate-coupon request with body:", req.body);
    try {
        const { couponCode } = req.body;
        if (!couponCode) return res.status(400).json({ message: 'کد تخفیف ارسال نشده است.' });
        const discount = await Discount.findOne({ code: couponCode.toUpperCase() });
        if (!discount || !discount.isActive || (discount.expiresAt && discount.expiresAt < new Date())) {
            return res.status(404).json({ message: 'کد تخفیف نامعتبر یا منقضی شده است.' });
        }
        console.log("Coupon validated successfully:", discount.code);
        res.json({ code: discount.code, discountType: discount.discountType, value: discount.value });
    } catch (error) {
        console.error("Error in /api/validate-coupon:", error.message);
        next(error);
    }
});

// --- بخش سفارشات و پرداخت ---
app.post('/api/create-order', async (req, res, next) => {
    console.log("Received /api/create-order request with body:", req.body);
    try {
        const { shippingInfo, products, amount, couponCode } = req.body;
        
        if (!shippingInfo || typeof shippingInfo !== 'object' || !products || !Array.isArray(products) || products.length === 0 || !amount) {
            return res.status(400).json({ message: 'اطلاعات ارسالی برای ثبت سفارش ناقص یا نادرست است.' });
        }
        
        let userId = null;
        const authHeader = req.header('Authorization');
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            try { userId = jwt.verify(token, process.env.JWT_SECRET)._id; } catch (ex) { console.warn('توکن نامعتبر در هنگام ایجاد سفارش.'); }
        }

        const subtotal = products.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shippingCost = 50000;
        let finalAmount = subtotal + shippingCost;
        let appliedDiscount = null;
        if (couponCode) {
            const discount = await Discount.findOne({ code: couponCode.toUpperCase(), isActive: true });
            if (discount && (!discount.expiresAt || discount.expiresAt > new Date())) {
                let discountAmount = (discount.discountType === 'percent') ? (subtotal * discount.value) / 100 : discount.value;
                finalAmount = Math.max(0, finalAmount - discountAmount);
                appliedDiscount = { code: discount.code, amount: discountAmount };
            }
        }
        if (Math.abs(finalAmount - amount) > 1) {
            console.error("عدم تطابق مبلغ:", { calculated: finalAmount, sent: amount });
            return res.status(400).json({ message: 'مبلغ نهایی با سبد خرید مغایرت دارد. لطفا صفحه را رفرش کرده و دوباره تلاش کنید.' });
        }
        
        const newOrder = new Order({ user: userId, shippingInfo, products, subtotal, shippingCost, discount: appliedDiscount, amount: finalAmount });
        await newOrder.save();
        console.log("Order created successfully. OrderId:", newOrder.orderId || newOrder._id);
        res.status(201).json({ message: 'سفارش با موفقیت ایجاد شد', order: newOrder });
    } catch (error) {
        console.error("❌ خطا در /api/create-order:", error.message);
        console.error("Data received:", JSON.stringify(req.body, null, 2));
        next(error); 
    }
});


app.post('/api/request-payment', async (req, res, next) => {
    console.log("Received /api/request-payment request with body:", req.body);
    try {
        const { orderId } = req.body;
        const callback_url = process.env.ZARINPAL_CALLBACK_URL || 'http://127.0.0.1:5500/payment-verify.html';
        if (!orderId) return res.status(400).json({ message: 'شناسه سفارش الزامی است.' });
        const order = await Order.findOne({ orderId: orderId });
        if (!order) return res.status(404).json({ message: 'سفارش یافت نشد.'});

        const callbackWithOrderId = `${callback_url}?orderId=${order.orderId}`;

        // Always perform the real Zarinpal request (test mode disabled)
        let zarinpalReqBody = {
            merchant_id: ZARINPAL_MERCHANT_ID,
            amount: order.amount,
            description: `سفارش ${orderId}`,
            callback_url: callbackWithOrderId
        };
        let zarinpalResp;
        try {
            zarinpalResp = await axios.post(ZARINPAL_API_REQUEST, zarinpalReqBody, { timeout: 10000 });
            console.log("Zarinpal response:", zarinpalResp.data);
        } catch (zpErr) {
            console.error("Zarinpal API error:", zpErr?.response?.data || zpErr.message);
            return res.status(502).json({ message: 'خطا در ارتباط با زرین‌پال', detail: zpErr?.response?.data || zpErr.message });
        }
        if (zarinpalResp?.data?.data?.code === 100) {
            order.paymentAuthority = zarinpalResp.data.data.authority;
            await order.save();
            console.log("Zarinpal payment authority received for order:", orderId);
            return res.json({ payment_url: `${ZARINPAL_GATEWAY_URL}${order.paymentAuthority}` });
        } else {
            console.error("Zarinpal error in /api/request-payment:", zarinpalResp?.data);
            return res.status(500).json({ message: 'خطا در اتصال به درگاه پرداخت', detail: zarinpalResp?.data });
        }
    } catch (error) {
        console.error("Error in /api/request-payment:", error.message);
        next(error);
    }
});

app.post('/api/verify-payment', async (req, res, next) => {
    console.log("Received /api/verify-payment request with body:", req.body);
    try {
        const { authority, orderId } = req.body;
        if (!authority || !orderId) return res.status(400).json({ message: 'اطلاعات تایید پرداخت ناقص است.' });
        const order = await Order.findOne({ orderId: orderId });
        if (!order) return res.status(404).json({ message: 'سفارش مربوط به این تراکنش یافت نشد.' });
        if (order.paymentAuthority !== authority) return res.status(400).json({ message: 'تراکنش نامعتبر است.' });

        // Always perform the real Zarinpal verification (test mode disabled)
        let zarinpalVerifyBody = {
            merchant_id: ZARINPAL_MERCHANT_ID,
            amount: order.amount,
            authority: authority
        };
        let zarinpalVerifyResp;
        try {
            zarinpalVerifyResp = await axios.post(ZARINPAL_API_VERIFY, zarinpalVerifyBody, { timeout: 10000 });
            console.log("Zarinpal verify response:", zarinpalVerifyResp.data);
        } catch (zpErr) {
            console.error("Zarinpal verify API error:", zpErr?.response?.data || zpErr.message);
            order.paymentStatus = 'ناموفق';
            await order.save();
            return res.status(502).json({ success: false, message: 'خطا در ارتباط با زرین‌پال', detail: zpErr?.response?.data || zpErr.message, order });
        }
        if (zarinpalVerifyResp?.data?.data?.code === 100) {
            order.paymentStatus = 'پرداخت شده';
            order.paymentRefId = zarinpalVerifyResp.data.data.ref_id;
            await order.save();
            console.log("Payment verified successfully for order:", orderId, "RefId:", order.paymentRefId);
            return res.json({ success: true, message: 'پرداخت شما با موفقیت تایید شد.', order });
        } else {
            order.paymentStatus = 'ناموفق';
            await order.save();
            console.error("Payment verification failed for order:", orderId, "Zarinpal response:", zarinpalVerifyResp?.data);
            return res.status(400).json({ success: false, message: 'پرداخت ناموفق بود', detail: zarinpalVerifyResp?.data, order });
        }
    } catch (error) {
        console.error("Error in /api/verify-payment:", error.message);
        next(error);
    }
});


// --- API های داشبورد ادمین ---
app.get('/api/orders-data', async (req, res, next) => {
    console.log("Received /api/orders-data request");
    try { const orders = await Order.find().populate('user', 'username').sort({ createdAt: -1 });
        console.log(`/api/orders-data responded with ${orders.length} orders`);
        res.json(orders);
    } catch (error) {
        console.error("Error in /api/orders-data:", error.message);
        next(error);
    }
});
app.get('/api/users-data', async (req, res, next) => {
    console.log("Received /api/users-data request");
    try { const users = await User.find({}, { password: 0 }).sort({ username: 1 });
        console.log(`/api/users-data responded with ${users.length} users`);
        res.json(users);
    } catch (error) {
        console.error("Error in /api/users-data:", error.message);
        next(error);
    }
});
app.get('/api/admin/stats', async (req, res, next) => {
    console.log("Received /api/admin/stats request");
    try {
        const totalRevenue = await Order.aggregate([ { $match: { paymentStatus: 'پرداخت شده' } }, { $group: { _id: null, total: { $sum: "$amount" } } } ]);
        const orderCount = await Order.countDocuments();
        const userCount = await User.countDocuments();
        console.log("/api/admin/stats responded with revenue:", totalRevenue.length > 0 ? totalRevenue[0].total : 0, "orders:", orderCount, "users:", userCount);
        res.json({ revenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0, orders: orderCount, users: userCount });
    } catch (error) {
        console.error("Error in /api/admin/stats:", error.message);
        next(error);
    }
});
app.put('/api/orders/:id/status', async (req, res, next) => {
    console.log("Received /api/orders/:id/status request with params:", req.params, "body:", req.body);
    try {
        const { status } = req.body;
        const validStatuses = ['در حال پردازش', 'ارسال شده', 'تحویل داده شده', 'لغو شده'];
        if (!validStatuses.includes(status)) return res.status(400).json({ message: 'وضعیت نامعتبر است.' });
        const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
        console.log("Order status updated:", req.params.id, "to", status);
        res.json(order);
    } catch(error) {
        console.error("Error in /api/orders/:id/status:", error.message);
        next(error);
    }
});

app.get('/api/discounts', async (req, res, next) => {
    console.log("Received /api/discounts GET request");
    try { const d = await Discount.find().sort({ createdAt: -1 });
        console.log(`/api/discounts GET responded with ${d.length} discounts`);
        res.json(d);
    } catch (e) { console.error("Error in /api/discounts GET:", e.message); next(e); }
});
app.post('/api/discounts', async (req, res, next) => {
    console.log("Received /api/discounts POST request with body:", req.body);
    try { const d = new Discount(req.body); await d.save();
        console.log("Discount created:", d.code);
        res.status(201).json(d);
    } catch (e) { console.error("Error in /api/discounts POST:", e.message); next(e); }
});
app.put('/api/discounts/:id', async (req, res, next) => {
    console.log("Received /api/discounts PUT request with params:", req.params, "body:", req.body);
    try { const d = await Discount.findByIdAndUpdate(req.params.id, req.body, { new: true });
        console.log("Discount updated:", req.params.id);
        res.json(d);
    } catch (e) { console.error("Error in /api/discounts PUT:", e.message); next(e); }
});
app.delete('/api/discounts/:id', async (req, res, next) => {
    console.log("Received /api/discounts DELETE request with params:", req.params);
    try { await Discount.findByIdAndDelete(req.params.id);
        console.log("Discount deleted:", req.params.id);
        res.status(204).send();
    } catch(e) { console.error("Error in /api/discounts DELETE:", e.message); next(e); }
});

// --- نمایش جزئیات یک سفارش برای invoice.html ---
app.get('/api/orders/:id', async (req, res, next) => {
  console.log("Received /api/orders/:id request with params:", req.params);
  try {
    const order = await Order.findById(req.params.id).populate('user','username email');
    if (!order) return res.status(404).json({ message: 'سفارش یافت نشد' });
    console.log("Order details sent for order:", req.params.id);
    res.json(order);
  } catch (error) {
    console.error("Error in /api/orders/:id:", error.message);
    next(error);
  }
});

app.get('/api/order-details/:orderId', async (req, res, next) => {
  console.log("Received /api/order-details/:orderId request with params:", req.params);
  try {
    const order = await Order.findOne({ orderId: req.params.orderId }).populate('user','username email');
    if (!order) return res.status(404).json({ message: 'سفارش یافت نشد' });
    console.log("Order details sent for orderId:", req.params.orderId);
    res.json(order);
  } catch (error) {
    console.error("Error in /api/order-details/:orderId:", error.message);
    next(error);
  }
});


// =========================================================================
// داشبورد ادمین (HTML کامل و توسعه‌یافته)
// =========================================================================
app.get('/admin', (req, res) => { 
    const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>پنل مدیریت سفارشات</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-main: #f4f7fc;
            --bg-sidebar: #1a202e;
            --text-light: #a0aec0;
            --text-dark: #2d3748;
            --primary: #4a69bd;
            --primary-light: #6185d3;
            --white: #ffffff;
            --border: #e2e8f0;
            --shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            --success: #38a169;
            --warning: #dd6b20;
            --danger: #c53030;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Vazirmatn', sans-serif; background-color: var(--bg-main); color: var(--text-dark); display: flex; }
        aside {
            background-color: var(--bg-sidebar);
            width: 250px;
            height: 100vh;
            padding: 1.5rem;
            color: var(--white);
            display: flex;
            flex-direction: column;
        }
        aside .logo { font-size: 1.5rem; font-weight: 700; margin-bottom: 2rem; text-align: center; }
        aside nav a {
            display: flex;
            align-items: center;
            padding: 0.8rem 1rem;
            color: var(--text-light);
            text-decoration: none;
            border-radius: 8px;
            margin-bottom: 0.5rem;
            transition: background-color 0.2s, color 0.2s;
        }
        aside nav a.active, aside nav a:hover { background-color: var(--primary); color: var(--white); }
        aside nav a i { margin-left: 1rem; }
        main { flex-grow: 1; padding: 2rem; height: 100vh; overflow-y: auto; }
        .stat-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
        .card { background-color: var(--white); border-radius: 12px; padding: 1.5rem; box-shadow: var(--shadow); }
        .stat-card { display: flex; align-items: center; justify-content: space-between; }
        .stat-card .info h3 { font-size: 0.9rem; color: #718096; margin-bottom: 0.5rem; }
        .stat-card .info p { font-size: 1.75rem; font-weight: 700; }
        .stat-card .icon { font-size: 2.5rem; padding: 1rem; border-radius: 50%; }
        .icon.revenue { background-color: #e6fffa; color: #38b2ac; }
        .icon.orders { background-color: #ebf4ff; color: #4299e1; }
        .orders-container { display: flex; flex-direction: column; }
        .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .toolbar h2 { font-size: 1.5rem; }
        .toolbar input {
            padding: 0.75rem 1rem;
            border: 1px solid var(--border);
            border-radius: 8px;
            width: 300px;
        }
        .orders-table { width: 100%; border-collapse: collapse; }
        .orders-table th, .orders-table td { padding: 1rem; text-align: right; }
        .orders-table thead {
            background-color: #edf2f7;
            font-size: 0.8rem;
            text-transform: uppercase;
            color: #718096;
        }
        .orders-table tbody tr { border-bottom: 1px solid var(--border); }
        .orders-table tbody tr:hover { background-color: #fafafa; }
        .status-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        .status-paid { background-color: #c6f6d5; color: var(--success); }
        .status-pending { background-color: #feebc8; color: var(--warning); }
        .status-failed { background-color: #fed7d7; color: var(--danger); }
        .view-btn {
            background-color: var(--primary);
            color: var(--white);
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .view-btn:hover { background-color: var(--primary-light); }
        #modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(0,0,0,0.5); display: none;
            justify-content: center; align-items: center; z-index: 1000;
        }
        #modal {
            background: var(--white);
            border-radius: 16px;
            width: 90%; max-width: 800px;
            max-height: 90vh;
            display: flex; flex-direction: column;
            animation: fadeIn 0.3s ease-out;
        }
        #modal-header {
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--border);
            display: flex; justify-content: space-between; align-items: center;
        }
        #modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
        #modal-body { padding: 1.5rem; overflow-y: auto; }
        .invoice-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;
        }
        .invoice-grid .item .label { font-size: 0.8rem; color: #718096; }
        .invoice-grid .item .value { font-weight: 600; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    </style>
</head>
<body>
    <aside>
        <div class="logo">پنل مدیریت</div>
        <nav>
            <a href="#" class="active"><i class="fas fa-box-open"></i>سفارشات</a>
        </nav>
    </aside>
    <main>
        <div class="stat-cards" id="stats-container"></div>
        <div class="card orders-container">
            <div class="toolbar">
                <h2>لیست سفارشات</h2>
                <input type="text" id="search-box" placeholder="جستجو بر اساس نام یا شناسه...">
            </div>
            <table class="orders-table">
                <thead>
                    <tr><th>شناسه</th><th>مشتری</th><th>تاریخ</th><th>مبلغ کل</th><th>وضعیت پرداخت</th><th></th></tr>
                </thead>
                <tbody id="orders-tbody"></tbody>
            </table>
        </div>
    </main>
    <div id="modal-overlay">
        <div id="modal">
            <div id="modal-header">
                <h3>جزئیات سفارش</h3>
                <button id="modal-close">&times;</button>
            </div>
            <div id="modal-body"></div>
        </div>
    </div>
    <script src="https://kit.fontawesome.com/a076d05399.js" crossorigin="anonymous"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const API_BASE = '/api';
            let allOrders = [];

            const statsContainer = document.getElementById('stats-container');
            const ordersTbody = document.getElementById('orders-tbody');
            const searchBox = document.getElementById('search-box');
            const modalOverlay = document.getElementById('modal-overlay');
            const modal = document.getElementById('modal');
            const modalBody = document.getElementById('modal-body');
            const closeModalBtn = document.getElementById('modal-close');

            const fmt = new Intl.NumberFormat('fa-IR');

            const fetchStats = async () => {
                const res = await fetch(\`\${API_BASE}/admin/stats\`);
                const data = await res.json();
                statsContainer.innerHTML = \`
                    <div class="card stat-card">
                        <div class="info"><h3>درآمد کل (تومان)</h3><p>\${fmt.format(data.revenue)}</p></div>
                        <div class="icon revenue"><i class="fas fa-coins"></i></div>
                    </div>
                    <div class="card stat-card">
                        <div class="info"><h3>تعداد سفارشات</h3><p>\${fmt.format(data.orders)}</p></div>
                        <div class="icon orders"><i class="fas fa-boxes"></i></div>
                    </div>
                \`;
            };

            const renderOrders = (orders) => {
                if (!orders || orders.length === 0) {
                    ordersTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">سفارشی یافت نشد.</td></tr>';
                    return;
                }
                ordersTbody.innerHTML = orders.map(o => {
                    const customerName = \`\${o.shippingInfo?.firstName || ''} \${o.shippingInfo?.lastName || ''}\`.trim() || 'مشتری مهمان';
                    const paymentStatus = o.paymentStatus || 'نامشخص';
                    const paymentClass = paymentStatus === 'پرداخت شده' ? 'status-paid' : 'status-failed';
                    
                    return \`
                        <tr>
                            <td><b>\${o.orderId || '-'}</b></td>
                            <td>\${customerName}</td>
                            <td>\${o.createdAt ? new Date(o.createdAt).toLocaleDateString('fa-IR') : '-'}</td>
                            <td>\${fmt.format(o.amount || 0)} تومان</td>
                            <td><span class="status-badge \${paymentClass}">\${paymentStatus}</span></td>
                            <td><button class="view-btn" data-id="\${o._id}">مشاهده فاکتور</button></td>
                        </tr>
                    \`;
                }).join('');
            };

            const fetchOrders = async () => {
                const res = await fetch(\`\${API_BASE}/orders-data\`);
                allOrders = await res.json();
                renderOrders(allOrders);
            };

            const openInvoiceModal = async (orderId) => {
                const res = await fetch(\`\${API_BASE}/orders/\${orderId}\`);
                const order = await res.json();
                
                let productsHtml = order.products.map(p => \`
                    <tr>
                        <td>\${p.name}</td>
                        <td>\${p.quantity}</td>
                        <td>\${fmt.format(p.price)}</td>
                        <td>\${fmt.format(p.price * p.quantity)}</td>
                    </tr>
                \`).join('');

                modalBody.innerHTML = \`
                    <div class="invoice-grid">
                        <div class="item">
                            <div class="label">شماره سفارش</div>
                            <div class="value">\${order.orderId}</div>
                        </div>
                        <div class="item">
                            <div class="label">تاریخ</div>
                            <div class="value">\${new Date(order.createdAt).toLocaleString('fa-IR')}</div>
                        </div>
                        <div class="item">
                            <div class="label">نام مشتری</div>
                            <div class="value">\${order.shippingInfo.firstName} \${order.shippingInfo.lastName}</div>
                        </div>
                        <div class="item">
                            <div class="label">شماره تماس</div>
                            <div class="value">\${order.shippingInfo.phone}</div>
                        </div>
                        <div class="item" style="grid-column: 1 / -1;">
                            <div class="label">آدرس</div>
                            <div class="value">\${order.shippingInfo.address}, \${order.shippingInfo.city}, \${order.shippingInfo.province}</div>
                        </div>
                    </div>
                    <h4>محصولات</h4>
                    <table class="orders-table" style="margin-top: 1rem;">
                        <thead><tr><th>محصول</th><th>تعداد</th><th>قیمت واحد</th><th>جمع کل</th></tr></thead>
                        <tbody>\${productsHtml}</tbody>
                    </table>
                \`;
                modalOverlay.style.display = 'flex';
            };
            
            const initializeDashboard = async () => {
                try {
                    await fetchStats();
                    await fetchOrders();
                } catch (error) {
                    console.error('خطا در بارگذاری داشبورد:', error);
                    document.querySelector('main').innerHTML = '<div class="card"><h2>خطا</h2><p>امکان بارگذاری اطلاعات داشبورد وجود ندارد. لطفاً کنسول مرورگر را برای جزئیات بیشتر بررسی کنید.</p></div>';
                }
            };

            searchBox.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const filteredOrders = allOrders.filter(o => 
                    (o.orderId || '').toLowerCase().includes(searchTerm) ||
                    (o.shippingInfo?.firstName || '').toLowerCase().includes(searchTerm) ||
                    (o.shippingInfo?.lastName || '').toLowerCase().includes(searchTerm)
                );
                renderOrders(filteredOrders);
            });

            ordersTbody.addEventListener('click', (e) => {
                if (e.target.classList.contains('view-btn')) {
                    const orderId = e.target.dataset.id;
                    openInvoiceModal(orderId);
                }
            });

            closeModalBtn.addEventListener('click', () => modalOverlay.style.display = 'none');
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    modalOverlay.style.display = 'none';
                }
            });

            initializeDashboard();
        });
    </script>
</body>
</html>`;
    res.type('html').send(html); 
});


// =========================================================================
// (جدید) Middleware برای مدیریت خطای مرکزی
// =========================================================================
app.use((err, req, res, next) => {
    console.error('❌ خطای سرور:', err.stack);
    res.status(500).send({ message: 'یک خطای پیش‌بینی نشده در سرور رخ داد.' });
});

// =========================================================================
// راه‌اندازی سرور
// =========================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 سرور با موفقیت روی پورت ${PORT} اجرا شد.`);
  if (!isProduction) {
    console.log('✨ حالت تست (Development Mode) فعال است.');
  } else {
    console.log('🔒 حالت عملیاتی (Production Mode) فعال است. تراکنش‌ها به درگاه واقعی زرین‌پال متصل هستند.');
  }
});


