const fs = require('fs/promises');
const path = require('path');
const usersPath = path.join(__dirname, '../storage/users.json');
const ordersPath = path.join(__dirname, '../storage/orders.json');

// Прочитати JSON-файл і повернути масив
async function readJson(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return []; // якщо файлу немає або він порожній
  }
}

// Записати масив у JSON-файл (з гарними відступами)
async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Наступний вільний id: останній id + 1
function nextId(items) {
  return items.length > 0 ? items[items.length - 1].id + 1 : 1;
}

module.exports = {
  getUsers: () => readJson(usersPath),
  saveUsers: (users) => writeJson(usersPath, users),
  getOrders: () => readJson(ordersPath),
  saveOrders: (orders) => writeJson(ordersPath, orders),
  nextId,
  async findUserByUsername(username) {
    const users = await readJson(usersPath);
    return users.find(u => u.username === username);
  },
  async findUserById(id) {
    const users = await readJson(usersPath);
    const user = users.find(u => u.id === Number(id));
    if (!user) return null;
    const orders = await readJson(ordersPath);
    const { passwordHash, ...safeUser } = user; // прибираємо пароль
    return { ...safeUser, orders: orders.filter(o => o.userId === user.id) };
  }
};