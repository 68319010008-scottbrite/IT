/**
 * ===================================================================
 *  PokéCenter Inventory System (ระบบคลังสินค้า PokéCenter)
 *  ไฟล์เดียวจบ (single-file) — Node.js + Express
 * ===================================================================
 *  ฟีเจอร์:
 *   1. เข้าสู่ระบบ (Login) ด้วย session
 *   2. แสดงรายการสินค้า (การ์ด, เสื้อผ้า, ตุ๊กตา, เครื่องเกม)
 *   3. เพิ่มสินค้าใหม่
 *   4. ตัดสต็อกสินค้าเมื่อขายออก
 *
 *  หมายเหตุ: ข้อมูลทั้งหมดเก็บใน "หน่วยความจำ" (in-memory array)
 *  เพื่อความง่ายในการเรียนรู้ — ถ้าปิดเซิร์ฟเวอร์ ข้อมูลจะหายไป
 *  (ของจริงควรต่อฐานข้อมูล เช่น MongoDB / PostgreSQL / SQLite)
 * ===================================================================
 */

require('dotenv').config(); // โหลดค่าลับจากไฟล์ .env เข้ามาใน process.env

const express = require('express');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000; // อ่านค่าจาก .env ถ้าไม่มีใช้ 3000

// ------------------------------------------------------------------
// Middleware พื้นฐาน
// ------------------------------------------------------------------
app.use(express.urlencoded({ extended: true })); // อ่านข้อมูลจากฟอร์ม (HTML form POST)
app.use(express.json());                          // อ่านข้อมูล JSON (เผื่อเรียกผ่าน API)

app.use(session({
  secret: process.env.SESSION_SECRET || 'pokecenter-secret-key-change-me', // ควรตั้งค่าใน .env
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 } // อายุ session 1 ชั่วโมง
}));

// ------------------------------------------------------------------
// "ฐานข้อมูลจำลอง" เก็บในหน่วยความจำ
// ------------------------------------------------------------------

// ผู้ใช้สำหรับเข้าสู่ระบบ (username: admin, password: 1234)
const USERS = [
  { username: 'admin', password: '1234' }
];

// หมวดหมู่สินค้าที่อนุญาต
const CATEGORIES = ['การ์ด', 'เสื้อผ้า', 'ตุ๊กตา', 'เครื่องเกม'];

// สินค้าตั้งต้น (seed data) — อัปเดตให้มีการ์ดชุดล่าสุดปี 2026 ด้วย
let products = [
  // การ์ด
  { id: 1, name: 'การ์ด Pikachu VMAX', category: 'การ์ด', price: 250, stock: 15 },
  { id: 2, name: 'ซองการ์ดชุดเสริม "เงามืดคุกคาม"', category: 'การ์ด', price: 150, stock: 40 },
  { id: 3, name: 'กล่องการ์ด "วิวัฒนาการเมก้า แท็กติกเด็ค"', category: 'การ์ด', price: 890, stock: 12 },
  { id: 4, name: 'ซองการ์ดที่ระลึก 30th Celebration', category: 'การ์ด', price: 320, stock: 20 },
  // เสื้อผ้า
  { id: 5, name: 'เสื้อยืด Pokémon Center', category: 'เสื้อผ้า', price: 590, stock: 8 },
  { id: 6, name: 'หมวก Pikachu ลาย 30th Anniversary', category: 'เสื้อผ้า', price: 690, stock: 10 },
  // ตุ๊กตา
  { id: 7, name: 'ตุ๊กตา Eevee ตัวใหญ่', category: 'ตุ๊กตา', price: 990, stock: 5 },
  { id: 8, name: 'ตุ๊กตา Pikachu รุ่นฉลอง 30 ปี', category: 'ตุ๊กตา', price: 1290, stock: 6 },
  // เครื่องเกม
  { id: 9, name: 'Nintendo Switch Joy-Con สี Pikachu', category: 'เครื่องเกม', price: 2490, stock: 3 },
  { id: 10, name: 'เคส Nintendo Switch ลาย Eevee', category: 'เครื่องเกม', price: 590, stock: 14 }
];
let nextId = 11;

// ------------------------------------------------------------------
// ฟังก์ชันช่วยเหลือ: สร้าง HTML หน้าเว็บ (layout กลาง)
// ------------------------------------------------------------------
function renderPage({ title, body, message, error }) {
  return `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | PokéCenter Inventory</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, sans-serif;
      background: #f4f6fb;
      margin: 0;
      padding: 0;
      color: #2b2b2b;
    }
    header {
      background: linear-gradient(90deg, #e3350d, #ff5b3c);
      color: white;
      padding: 18px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }
    header h1 { margin: 0; font-size: 22px; }
    header a { color: white; text-decoration: none; font-weight: bold; }
    header a:hover { text-decoration: underline; }
    .container {
      max-width: 900px;
      margin: 30px auto;
      padding: 0 16px;
    }
    .card {
      background: white;
      border-radius: 10px;
      padding: 20px 24px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    h2 { margin-top: 0; color: #e3350d; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid #eee;
      font-size: 14px;
    }
    th { background: #fafafa; color: #555; }
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      background: #ffe3dc;
      color: #e3350d;
    }
    .stock-low { color: #d32f2f; font-weight: bold; }
    input, select, button {
      padding: 9px 10px;
      border-radius: 6px;
      border: 1px solid #ccc;
      font-size: 14px;
    }
    button {
      background: #e3350d;
      color: white;
      border: none;
      cursor: pointer;
      font-weight: bold;
    }
    button:hover { background: #c92c0a; }
    form.inline { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .msg { padding: 10px 14px; border-radius: 6px; margin-bottom: 16px; font-size: 14px; }
    .msg.success { background: #e2f7e6; color: #1a7d33; border: 1px solid #b6e6c1; }
    .msg.error { background: #fdecea; color: #c0392b; border: 1px solid #f5c6c0; }
    .login-box {
      max-width: 360px;
      margin: 60px auto;
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
    }
    .login-box h2 { text-align: center; }
    .login-box input { width: 100%; margin-bottom: 12px; }
    .login-box button { width: 100%; }
    .sell-form { display: flex; gap: 6px; align-items: center; }
    .sell-form input[type=number] { width: 70px; }
  </style>
</head>
<body>
  <header>
    <h1>⚡ PokéCenter Inventory</h1>
    ${title !== 'เข้าสู่ระบบ' ? '<a href="/logout">ออกจากระบบ</a>' : ''}
  </header>
  <div class="container">
    ${message ? `<div class="msg success">${message}</div>` : ''}
    ${error ? `<div class="msg error">${error}</div>` : ''}
    ${body}
  </div>
</body>
</html>
  `;
}

// ------------------------------------------------------------------
// Middleware ตรวจสอบว่า login แล้วหรือยัง
// ------------------------------------------------------------------
function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) {
    return next();
  }
  return res.redirect('/login');
}

// ------------------------------------------------------------------
// Route: หน้าแรก -> ถ้า login แล้วไปหน้าสินค้า ถ้ายังไปหน้า login
// ------------------------------------------------------------------
app.get('/', (req, res) => {
  if (req.session && req.session.loggedIn) {
    return res.redirect('/products');
  }
  return res.redirect('/login');
});

// ------------------------------------------------------------------
// Route: หน้า Login (GET แสดงฟอร์ม, POST ตรวจสอบสิทธิ์)
// ------------------------------------------------------------------
app.get('/login', (req, res) => {
  if (req.session && req.session.loggedIn) {
    return res.redirect('/products');
  }
  const err = req.query.error ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' : null;
  const body = `
    <div class="login-box">
      <h2>เข้าสู่ระบบ</h2>
      <form method="POST" action="/login">
        <input type="text" name="username" placeholder="ชื่อผู้ใช้ (username)" required>
        <input type="password" name="password" placeholder="รหัสผ่าน (password)" required>
        <button type="submit">เข้าสู่ระบบ</button>
      </form>
      <p style="text-align:center; color:#999; font-size:13px; margin-top:14px;">
        ทดลองใช้: admin / 1234
      </p>
    </div>
  `;
  res.send(renderPage({ title: 'เข้าสู่ระบบ', body, error: err }));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.redirect('/login?error=1');
  }
  req.session.loggedIn = true;
  req.session.username = username;
  res.redirect('/products');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// ------------------------------------------------------------------
// Route: แสดงรายการสินค้า + ฟอร์มเพิ่มสินค้า + ฟอร์มขาย/ตัดสต็อก
// ------------------------------------------------------------------
app.get('/products', requireLogin, (req, res) => {
  const msg = req.query.msg || null;
  const err = req.query.err || null;

  const rows = products.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${p.name}</td>
      <td><span class="badge">${p.category}</span></td>
      <td>${p.price.toLocaleString()} บาท</td>
      <td class="${p.stock <= 3 ? 'stock-low' : ''}">${p.stock}</td>
      <td>
        <form class="sell-form" method="POST" action="/products/${p.id}/sell">
          <input type="number" name="quantity" min="1" max="${p.stock}" value="1" ${p.stock === 0 ? 'disabled' : ''} required>
          <button type="submit" ${p.stock === 0 ? 'disabled' : ''}>ขาย/ตัดสต็อก</button>
        </form>
      </td>
    </tr>
  `).join('');

  const categoryOptions = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');

  const body = `
    <div class="card">
      <h2>รายการสินค้าในคลัง</h2>
      <table>
        <thead>
          <tr>
            <th>รหัส</th><th>ชื่อสินค้า</th><th>หมวดหมู่</th><th>ราคา</th><th>คงเหลือ</th><th>ขาย</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="6">ยังไม่มีสินค้าในคลัง</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>เพิ่มสินค้าใหม่</h2>
      <form class="inline" method="POST" action="/products/add">
        <input type="text" name="name" placeholder="ชื่อสินค้า" required>
        <select name="category" required>
          <option value="" disabled selected>เลือกหมวดหมู่</option>
          ${categoryOptions}
        </select>
        <input type="number" name="price" placeholder="ราคา (บาท)" min="0" step="1" required>
        <input type="number" name="stock" placeholder="จำนวนเริ่มต้น" min="0" step="1" required>
        <button type="submit">เพิ่มสินค้า</button>
      </form>
    </div>
  `;

  res.send(renderPage({ title: 'รายการสินค้า', body, message: msg, error: err }));
});

// ------------------------------------------------------------------
// Route: เพิ่มสินค้าใหม่
// ------------------------------------------------------------------
app.post('/products/add', requireLogin, (req, res) => {
  const { name, category, price, stock } = req.body;

  if (!name || !category || price === undefined || stock === undefined) {
    return res.redirect('/products?err=' + encodeURIComponent('กรุณากรอกข้อมูลให้ครบถ้วน'));
  }
  if (!CATEGORIES.includes(category)) {
    return res.redirect('/products?err=' + encodeURIComponent('หมวดหมู่ไม่ถูกต้อง'));
  }
  const priceNum = Number(price);
  const stockNum = Number(stock);
  if (isNaN(priceNum) || priceNum < 0 || isNaN(stockNum) || stockNum < 0) {
    return res.redirect('/products?err=' + encodeURIComponent('ราคาหรือจำนวนไม่ถูกต้อง'));
  }

  products.push({
    id: nextId++,
    name: name.trim(),
    category,
    price: priceNum,
    stock: stockNum
  });

  res.redirect('/products?msg=' + encodeURIComponent(`เพิ่มสินค้า "${name}" เรียบร้อยแล้ว`));
});

// ------------------------------------------------------------------
// Route: ขายสินค้า / ตัดสต็อก
// ------------------------------------------------------------------
app.post('/products/:id/sell', requireLogin, (req, res) => {
  const id = Number(req.params.id);
  const quantity = Number(req.body.quantity);

  const product = products.find(p => p.id === id);
  if (!product) {
    return res.redirect('/products?err=' + encodeURIComponent('ไม่พบสินค้านี้'));
  }
  if (isNaN(quantity) || quantity <= 0) {
    return res.redirect('/products?err=' + encodeURIComponent('จำนวนที่ขายไม่ถูกต้อง'));
  }
  if (quantity > product.stock) {
    return res.redirect('/products?err=' + encodeURIComponent('สต็อกไม่พอสำหรับการขายนี้'));
  }

  product.stock -= quantity;

  res.redirect('/products?msg=' + encodeURIComponent(`ขาย "${product.name}" จำนวน ${quantity} ชิ้น สำเร็จ (คงเหลือ ${product.stock})`));
});

// ------------------------------------------------------------------
// เริ่มรันเซิร์ฟเวอร์
// ------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ PokéCenter Inventory กำลังทำงานที่ http://localhost:${PORT}`);
  console.log(`   Login ทดสอบ: username = admin, password = 1234`);
});
