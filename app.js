require('dotenv').config({ quiet: true });
const express = require('express');
const storage = require('./dto/storage');
const app = express();
const PORT = process.env.PORT || 3111;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// ========== 1. MIDDLEWARE ==========
// Дозволяє читати JSON з тіла запиту (req.body)
app.use(express.json());

// Логер: друкує в терміналі кожен запит
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next(); // передаємо запит далі
});

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Немає доступу (відсутній токен)' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Недійсний або прострочений токен' });
  }
}
// ========== 2. МАРШРУТИ ==========
app.get('/', (req, res) => {
  res.json({ message: 'Сервер працює!' });
});

app.get('/users', authMiddleware, async (req, res) => {
  const users = await storage.getUsers();
  const safeUsers = users.map(({ passwordHash, ...u }) => u);
  res.json(safeUsers);
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  
  if (!username || !password) {
    return res.status(400).json({ error: "Введіть username та password" });
  }
  
  const user = await storage.findUserByUsername(username);
  if (!user) {
    return res.status(401).json({ error: "Невірний логін або пароль" });
  }
  
  // Порівнюємо введений пароль із хешем у базі
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: "Невірний логін або пароль" });
  }
  
  // Генеруємо JWT токен
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  
    res.json({ message: "Успішний вхід", token });
    
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Немає доступу (відсутній токен)' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // зберігаємо розшифровані дані (userId, role) для використання в самому маршруті
    next(); // пропускаємо запит далі
  } catch (err) {
    return res.status(403).json({ error: 'Недійсний або прострочений токен' });
  }
}
});

app.post('/users', async (req, res) => {
  const { username, password, name, role } = req.body || {};
  
  if (!username || !password) {
    return res.status(400).json({ error: "Поля username та password є обов'язковими" });
  }
  
  const existingUser = await storage.findUserByUsername(username);
  if (existingUser) {
    return res.status(400).json({ error: 'Користувач з таким username вже існує' });
  }
  
  // Хешуємо пароль перед збереженням
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  
  const users = await storage.getUsers();
  const newUser = {
    id: storage.nextId(users),
    username,
    passwordHash, // зберігаємо хеш замість відкритого пароля
    name: name || username,
    role: role || 'user'
  };
  users.push(newUser);
  await storage.saveUsers(users);
  
  // Повертаємо користувача без поля passwordHash
  const { passwordHash: _, ...safeUser } = newUser;
  res.status(201).json({ message: 'Користувача створено', user: safeUser });
});

app.get('/users/:id', async (req, res) => {
  const userData = await storage.findUserById(req.params.id);
  if (!userData) {
    return res.status(404).json({ error: 'Користувача не знайдено' });
  }
  res.json(userData);
});

app.post('/orders', authMiddleware, async (req, res) => {
  const { product, amount } = req.body || {};
  const userId = req.user.userId; // Отримуємо ID власника токена

  if (!product || !amount) {
    return res.status(400).json({ error: "Поля product та amount є обов'язковими" });
  }

  const orders = await storage.getOrders();
  const newOrder = {
    id: storage.nextId(orders),
    userId,
    product,
    amount: Number(amount)
  };
  
  orders.push(newOrder);
  await storage.saveOrders(orders);
  res.status(201).json({ message: 'Замовлення успішно створено', order: newOrder });
});

app.get('/orders', authMiddleware, async (req, res) => {
  const userId = req.user.userId; // Дістаємо ID поточного користувача з токена
  const orders = await storage.getOrders();
  
  // Залишаємо лише ті замовлення, де userId збігається з ID авторизованого користувача
  const userOrders = orders.filter(order => order.userId === userId);
  
  res.json(userOrders);
});

app.get('/admin/orders', authMiddleware, async (req, res) => {
  // 1. Перевіряємо роль. req.user береться з токена, який ми розшифрували в authMiddleware
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ заборонено. Потрібні права адміністратора.' });
  }
  
  // 2. Якщо перевірка пройдена (це адмін), дістаємо всі замовлення з бази
  const orders = await storage.getOrders();
  res.json(orders);
});

// ========== 3. ОБРОБКА ПОМИЛОК ==========

// ========== 4. ЗАПУСК СЕРВЕРА ==========
app.listen(PORT, () => {
  console.log(`Server is running at http://127.0.0.1:${PORT}`);
});