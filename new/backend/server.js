

// 1. require()
const express = require("express");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dbModule = require("./database");
const db = dbModule.db;

const JWT_SECRET = process.env.JWT_SECRET || 'vendora-default-secret-change-this';
const JWT_EXPIRES_IN = '8h';

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function authenticateToken(req, res, next) {
  if (req.path === '/auth/login' || req.path === '/auth/register') {
    return next();
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authorization token missing' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}

// 2. create app
const app = express();

// 3. middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  if (req.path === '/auth/login' || req.path === '/auth/register') return next();
  if (req.path.startsWith('/auth')) return authenticateToken(req, res, next);
  return authenticateToken(req, res, next);
});

app.post('/auth/login', (req, res) => {
  const username = (req.body.username || '').toString().trim().toLowerCase();
  const password = (req.body.password || '').toString();

  if (!username || !password) {
    return res.status(400).send({ error: 'Username and password are required' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).send({ error: err.message });
    if (!user) return res.status(401).send({ error: 'Invalid username or password' });

    bcrypt.compare(password, user.passwordHash, (compareErr, isValid) => {
      if (compareErr) return res.status(500).send({ error: compareErr.message });
      if (!isValid) return res.status(401).send({ error: 'Invalid username or password' });

      const token = generateToken(user);
      res.send({ token, user: { id: user.id, username: user.username, role: user.role } });
    });
  });
});

app.post('/auth/register', (req, res) => {
  const username = (req.body.username || '').toString().trim().toLowerCase();
  const password = (req.body.password || '').toString();
  const role = (req.body.role || 'user').toString().trim();

  if (!username || !password) {
    return res.status(400).send({ error: 'Username and password are required' });
  }

  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err) return res.status(500).send({ error: err.message });
    const userCount = (row && row.count) ? Number(row.count) : 0;

    const createUser = () => {
      const finalRole = userCount === 0 ? 'admin' : role || 'user';
      bcrypt.hash(password, 10, (hashErr, passwordHash) => {
        if (hashErr) return res.status(500).send({ error: hashErr.message });
        db.run('INSERT INTO users (username, passwordHash, role) VALUES (?, ?, ?)', [username, passwordHash, finalRole], function(insertErr) {
          if (insertErr) {
            if (insertErr.message && insertErr.message.includes('UNIQUE')) {
              return res.status(409).send({ error: 'Username already exists' });
            }
            return res.status(500).send({ error: insertErr.message });
          }
          res.send({ success: true, id: this.lastID, role: finalRole });
        });
      });
    };

    if (userCount === 0) {
      return createUser();
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(403).send({ error: 'Registration is closed after initial setup' });
    }

    jwt.verify(token, JWT_SECRET, (verifyErr, decoded) => {
      if (verifyErr) return res.status(401).send({ error: 'Invalid authorization token' });
      if (decoded.role !== 'admin') return res.status(403).send({ error: 'Admin privileges required to register new users' });
      return createUser();
    });
  });
});

app.get('/auth/me', (req, res) => {
  if (!req.user || !req.user.id) return res.status(401).send({ error: 'Unauthorized' });
  db.get('SELECT id, username, role, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) return res.status(500).send({ error: err.message });
    if (!user) return res.status(404).send({ error: 'User not found' });
    res.send({ user });
  });
});

// Add item
app.post("/item", (req, res) => {
  const { name, pricePerKg, mrp, costPerKg, quantity, type, sku, description, reorderThreshold, reorderQuantity, category, baseQuantity, supplierId, batchNo, expiryDate } = req.body;

  db.run(
    "INSERT INTO items (name, pricePerKg, mrp, category, costPerKg, quantity, baseQuantity, supplierId, batchNo, expiryDate, type, sku, description, reorderThreshold, reorderQuantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [name, pricePerKg || 0, mrp || 0, category || null, costPerKg || 0, quantity || 0, baseQuantity || null, supplierId || null, batchNo || null, expiryDate || null, type || 'loose', sku || null, description || '', reorderThreshold || 5, reorderQuantity || 10],
    function(err) {
      if (err) return res.status(500).send({ error: err.message });
      res.send({ success: true, id: this.lastID });
    }
  );
});

// Edit item
app.put("/item/:id", (req, res) => {
  const id = req.params.id;
  const { name, pricePerKg, mrp, costPerKg, quantity, type, sku, description, reorderThreshold, reorderQuantity, category, baseQuantity, supplierId, batchNo, expiryDate } = req.body;

  db.run(
    "UPDATE items SET name=?, pricePerKg=?, mrp=?, category=?, costPerKg=?, quantity=?, baseQuantity=?, supplierId=?, batchNo=?, expiryDate=?, type=?, sku=?, description=?, reorderThreshold=?, reorderQuantity=? WHERE id=?",
    [name || '', pricePerKg || 0, mrp || 0, category || null, costPerKg || 0, quantity || 0, baseQuantity || null, supplierId || null, batchNo || null, expiryDate || null, type || 'loose', sku || null, description || '', reorderThreshold || 5, reorderQuantity || 10, id],
    (err) => {
      if (err) return res.status(500).send({ error: err.message });
      res.send({ success: true });
    }
  );
});

// Delete item
app.delete("/item/:id", (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM items WHERE id=?", [id], (err) => {
    if (err) return res.status(500).send({ error: err.message });
    res.send({ success: true });
  });
});

// Sales heatmap: totals grouped by day-of-week (0=Sun..6=Sat) and hour (00-23)
app.get('/reports/sales-heatmap', (req, res) => {
  try {
    const start = req.query.start ? new Date(req.query.start) : null;
    const end = req.query.end ? new Date(req.query.end) : null;
    const now = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(now.getDate() - 30); // last 30 days
    const startIso = (start && !isNaN(start)) ? start.toISOString() : defaultStart.toISOString();
    const endIso = (end && !isNaN(end)) ? end.toISOString() : new Date(now.getTime() + 24*60*60*1000).toISOString();

    db.all(
      `SELECT STRFTIME('%w', created_at) as dow, STRFTIME('%H', created_at) as hour, SUM(total) as total
       FROM sales
       WHERE created_at >= ? AND created_at <= ?
       GROUP BY dow, hour`,
      [startIso, endIso],
      (err, rows) => {
        if (err) return res.status(500).send({ error: err.message });

        // build matrix day(0-6) -> hour(0-23)
        const matrix = {};
        let max = 0;
        for (let d = 0; d <= 6; d++) {
          matrix[d] = {};
          for (let h = 0; h < 24; h++) matrix[d][h] = 0;
        }

        (rows || []).forEach(r => {
          const d = Number(r.dow);
          const h = Number(r.hour);
          const t = Number(r.total || 0);
          if (!isNaN(d) && !isNaN(h)) {
            matrix[d][h] = t;
            if (t > max) max = t;
          }
        });

        res.send({ start: startIso, end: endIso, max, matrix });
      }
    );
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

// Profit margins per product and per category
app.get('/reports/profit-margins', (req, res) => {
  try {
    // Aggregate by product
    db.all(
      `SELECT i.id as itemId, i.name as itemName, i.category as category,
              SUM(s.total) as revenue,
              SUM(s.weight * s.costPerKg) as cost
       FROM sales s
       LEFT JOIN items i ON s.itemId = i.id
       GROUP BY i.id
       ORDER BY revenue DESC`,
      [],
      (err, prodRows) => {
        if (err) return res.status(500).send({ error: err.message });

        const products = (prodRows || []).map(r => {
          const revenue = Number(r.revenue || 0);
          const cost = Number(r.cost || 0);
          const profit = revenue - cost;
          const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
          return { itemId: r.itemId, itemName: r.itemName, category: r.category || 'Uncategorized', revenue, cost, profit, margin };
        });

        // Aggregate by category
        db.all(
          `SELECT COALESCE(i.category, 'Uncategorized') as category, SUM(s.total) as revenue, SUM(s.weight * s.costPerKg) as cost
           FROM sales s
           LEFT JOIN items i ON s.itemId = i.id
           GROUP BY category
           ORDER BY revenue DESC`,
          [],
          (cErr, catRows) => {
            if (cErr) return res.status(500).send({ error: cErr.message });
            const categories = (catRows || []).map(r => {
              const revenue = Number(r.revenue || 0);
              const cost = Number(r.cost || 0);
              const profit = revenue - cost;
              const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
              return { category: r.category, revenue, cost, profit, margin };
            });

            res.send({ products, categories });
          }
        );
      }
    );
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

// Search items
app.get("/search", (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.send([]);
  
  // First, try exact barcode/SKU match
  db.get(
    "SELECT * FROM items WHERE sku = ?",
    [q],
    (err, exactMatch) => {
      if (!err && exactMatch) {
        // Barcode found - return it first
        return res.send([exactMatch]);
      }
      
      // No exact match - search by name, description, or partial barcode
      db.all(
        "SELECT * FROM items WHERE name LIKE ? OR sku LIKE ? OR description LIKE ? ORDER BY name ASC LIMIT 20",
        [`%${q}%`, `%${q}%`, `%${q}%`],
        (err, rows) => {
          if (err) return res.status(500).send({ error: err.message });
          res.send(rows || []);
        }
      );
    }
  );
});

// List items
app.get("/items", (req, res) => {
  db.all("SELECT * FROM items", (err, rows) => {
    if (err) return res.status(500).send({ error: err.message });
    res.send(rows);
  });
});

// Get item by SKU/barcode
app.get('/item/by-sku/:sku', (req, res) => {
  const sku = req.params.sku;
  db.get('SELECT * FROM items WHERE sku = ?', [sku], (err, row) => {
    if (err) return res.status(500).send({ error: err.message });
    res.send(row || null);
  });
});

// Record a sale: decrement stock, insert into sales
app.post('/sale', (req, res) => {
  const { itemId, weight } = req.body;
  if (!itemId || !weight) return res.status(400).send({ error: 'itemId and weight required' });

  db.get('SELECT * FROM items WHERE id = ?', [itemId], (err, item) => {
    if (err) return res.status(500).send({ error: err.message });
    if (!item) return res.status(404).send({ error: 'Item not found' });

    const pricePerKg = item.pricePerKg || 0;
    const costPerKg = item.costPerKg || 0;
    const total = pricePerKg * weight;

    db.run(
      'INSERT INTO sales (itemId, weight, pricePerKg, costPerKg, total) VALUES (?, ?, ?, ?, ?)',
      [itemId, weight, pricePerKg, costPerKg, total],
      function (err) {
        if (err) return res.status(500).send({ error: err.message });

        // decrement quantity (assume quantity stored in same units as weight)
        db.run('UPDATE items SET quantity = quantity - ? WHERE id = ?', [weight, itemId], (uErr) => {
          if (uErr) console.error('Failed to update quantity', uErr.message);
          res.send({ success: true, saleId: this.lastID, total });
        });
      }
    );
  });
});

// Set/get daily sales target
app.post('/target', (req, res) => {
  const { target } = req.body;
  if (target === undefined) return res.status(400).send({ error: 'target required' });
  db.run("INSERT INTO settings(key,value) VALUES('dailyTarget',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [String(target)], (err) => {
    if (err) return res.status(500).send({ error: err.message });
    res.send({ success: true });
  });
});

app.get('/target', (req, res) => {
  db.get("SELECT value FROM settings WHERE key='dailyTarget'", (err, row) => {
    if (err) return res.status(500).send({ error: err.message });
    res.send({ target: row ? Number(row.value) : 0 });
  });
});

// Dashboard endpoint: now supports startDate, endDate, category filters
app.get('/dashboard', async (req, res) => {
  try {
    const { startDate, endDate, paymentMethod, category, staffName } = req.query;

    let salesQuery = "FROM sales s";
    const params = [];
    const whereClauses = [];

    // Category filter requires a join
    if (category) {
        salesQuery += " JOIN items i ON s.itemId = i.id";
        whereClauses.push("i.category = ?");
        params.push(category);
    }

    if (startDate) {
        whereClauses.push("s.created_at >= ?");
        params.push(new Date(startDate).toISOString());
    }
    if (endDate) {
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1); // To include the whole day
        whereClauses.push("s.created_at <= ?");
        params.push(end.toISOString());
    }
    
    // NOTE: paymentMethod and staffName filtering is not yet supported by the database schema.

    if (whereClauses.length > 0) {
        salesQuery += " WHERE " + whereClauses.join(" AND ");
    }

    const revenueAndProfitQuery = "SELECT SUM(s.total) as revenue, SUM((s.pricePerKg - s.costPerKg) * s.weight) as profit " + salesQuery;

    db.get(revenueAndProfitQuery, params, (err, sums) => {
      if (err) {
        console.error("DB ERROR (/dashboard):", err);
        return res.status(500).send({ error: err.message });
      }
      const revenue = Number(sums.revenue || 0);
      const profit = Number(sums.profit || 0);

      const billQueryBase = "FROM bills";
      const billParams = [];
      const billWhereClauses = [];

      if (!startDate && !endDate) {
        billWhereClauses.push("DATE(created_at) = ?");
        billParams.push(new Date().toISOString().split('T')[0]);
      } else if (startDate && !endDate) {
        billWhereClauses.push("DATE(created_at) = ?");
        billParams.push(startDate);
      } else if (startDate && endDate) {
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        billWhereClauses.push("created_at >= ? AND created_at <= ?");
        billParams.push(new Date(startDate).toISOString(), end.toISOString());
      }

      const customerCountQuery = "SELECT COUNT(DISTINCT customerId) as customerCount, COUNT(*) as transactionCount, SUM(total) as totalBillAmount " + billQueryBase +
        (billWhereClauses.length ? " WHERE " + billWhereClauses.join(" AND ") : "");

      db.get(customerCountQuery, billParams, (cErr, counts) => {
        if (cErr) {
          console.error("DB ERROR (/dashboard customer counts):", cErr);
        }
        const customerCount = Number(counts?.customerCount || 0);
        const transactionCount = Number(counts?.transactionCount || 0);
        const avgTicket = transactionCount > 0 ? Number(counts?.totalBillAmount || 0) / transactionCount : 0;

        // Calculate daily sales (sales for today or the specified date range)
        let dailySalesQuery = "SELECT SUM(s.total) as dailySales FROM sales s";
        let dailyParams = [];
        
        // If no date filters, default to today
        if (!startDate && !endDate) {
          const today = new Date().toISOString().split('T')[0];
          dailySalesQuery += " WHERE DATE(s.created_at) = ?";
          dailyParams.push(today);
        } else if (startDate && !endDate) {
          // If only startDate, get that day's sales
          dailySalesQuery += " WHERE DATE(s.created_at) = ?";
          dailyParams.push(startDate);
        } else if (startDate && endDate) {
          // Use the same date range as main query
          const end = new Date(endDate);
          end.setDate(end.getDate() + 1);
          dailySalesQuery += " WHERE s.created_at >= ? AND s.created_at <= ?";
          dailyParams.push(new Date(startDate).toISOString(), end.toISOString());
        }

        db.get(dailySalesQuery, dailyParams, (dErr, dailySum) => {
          const dailySales = dErr ? 0 : Number(dailySum?.dailySales || 0);

          // stock info and low stock alerts (these are not filtered by date)
          db.all('SELECT id, name, quantity, costPerKg, expiryDate, reorderThreshold, reorderQuantity FROM items ORDER BY quantity ASC', (iErr, items) => {
            if (iErr) {
              console.error("DB ERROR (/dashboard items):", iErr);
              return res.status(500).send({ error: iErr.message });
            }
            const stockLow = items.filter(it => Number(it.quantity) <= 5);
            const stockValue = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.costPerKg || 0)), 0);
            const expiryAlertsCount = items.filter(it => {
              if (!it.expiryDate) return false;
              const expiry = new Date(it.expiryDate);
              if (isNaN(expiry)) return false;
              const now = new Date();
              const horizon = new Date();
              horizon.setDate(now.getDate() + 1);
              return expiry <= horizon;
            }).length;

            // For simplicity, insight is not recalculated with filters for now.
            const insight = 'Advanced insights for custom date ranges are coming soon!';

            res.send({
              revenue,
              profit,
              dailySales,
              customerCount,
              transactionCount,
              avgTicket,
              items,
              stockLow,
              stockValue,
              expiryAlertsCount,
              reorderAlertsCount: stockLow.length,
              insight
            });
          });
        });
      });
    });
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

// Get staff for filter dropdown
app.get('/staff', (req, res) => {
  // NOTE: This is placeholder data. A real implementation would require a staff table.
  res.send([{ id: 1, name: 'Admin' }]);
});

// Get categories for filter dropdown
app.get('/categories', (req, res) => {
  db.all("SELECT DISTINCT category FROM items WHERE category IS NOT NULL AND category != '' ORDER BY category", (err, rows) => {
    if (err) {
      console.error("DB ERROR (/categories):", err);
      return res.status(500).send({ error: err.message });
    }
    res.send(rows);
  });
});

// Billing estimate (get price × weight) — moved to /bill/estimate to avoid conflict with full bill creation
app.post('/bill/estimate', (req, res) => {
  const { itemId, weight } = req.body;

  db.get('SELECT * FROM items WHERE id = ?', [itemId], (err, item) => {
    if (err || !item) return res.status(404).send({ error: 'Item not found' });

    const unitPrice = item.pricePerKg || 0;
    const total = unitPrice * weight;
    res.send({ total });
  });
});

// ===== CUSTOMER & LOYALTY ENDPOINTS =====

// Add/update customer
app.post('/customer', (req, res) => {
  const { phone, name, email } = req.body;
  if (!phone || !name) return res.status(400).send({ error: 'phone and name required' });
  
  db.run(
    "INSERT INTO customers (phone, name, email) VALUES (?, ?, ?) ON CONFLICT(phone) DO UPDATE SET name=excluded.name, email=excluded.email",
    [phone, name, email || null],
    function(err) {
      if (err) return res.status(500).send({ error: err.message });
      res.send({ success: true, id: this.lastID });
    }
  );
});

// Get customer by phone
app.get('/customer/:phone', (req, res) => {
  db.get('SELECT * FROM customers WHERE phone = ?', [req.params.phone], (err, row) => {
    if (err) return res.status(500).send({ error: err.message });
    res.send(row || null);
  });
});

// Get customer points by id
app.get('/customer/points/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT id, name, phone, loyalty_points FROM customers WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).send({ error: err.message });
    if (!row) return res.status(404).send({ error: 'Customer not found' });
    res.send({ id: row.id, name: row.name, phone: row.phone, loyalty_points: Number(row.loyalty_points || 0) });
  });
});

// Redeem points endpoint (deducts points and returns value)
app.post('/customer/:id/redeem', (req, res) => {
  const id = req.params.id;
  let points = Number(req.body.points || 0);
  if (points <= 0) return res.status(400).send({ error: 'points required' });

  const POINT_VALUE = 1; // ₹1 per point
  db.get('SELECT loyalty_points FROM customers WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).send({ error: err.message });
    const available = Number((row && row.loyalty_points) || 0);
    if (available <= 0) return res.status(400).send({ error: 'No points available' });
    if (points > available) points = Math.floor(available);

    db.run('UPDATE customers SET loyalty_points = loyalty_points - ? WHERE id = ?', [points, id], function(uErr) {
      if (uErr) return res.status(500).send({ error: uErr.message });
      const value = points * POINT_VALUE;
      res.send({ success: true, redeemedPoints: points, value });
    });
  });
});

// Get customer balance (credit/debt)
app.get('/customer/:id/balance', (req, res) => {
  const id = req.params.id;
  db.get(
    'SELECT id, customerId, balance, notes, updated_at FROM customer_balance WHERE customerId = ?',
    [id],
    (err, row) => {
      if (err) return res.status(500).send({ error: err.message });
      if (!row) {
        // If no record exists, initialize with 0 balance
        return res.send({ customerId: id, balance: 0, notes: '', updated_at: new Date().toISOString() });
      }
      res.send(row);
    }
  );
});

// Update customer balance (add/subtract for credit/debt)
app.post('/customer/:id/balance/adjust', (req, res) => {
  const id = req.params.id;
  const amount = Number(req.body.amount || 0);
  const reason = req.body.reason || '';
  
  if (!amount) return res.status(400).send({ error: 'amount required' });

  // First ensure balance record exists
  db.run(
    'INSERT OR IGNORE INTO customer_balance (customerId, balance, notes, updated_at) VALUES (?, ?, ?, ?)',
    [id, 0, '', new Date().toISOString()],
    (initErr) => {
      if (initErr) return res.status(500).send({ error: initErr.message });

      // Then update the balance
      db.run(
        'UPDATE customer_balance SET balance = balance + ?, notes = ?, updated_at = ? WHERE customerId = ?',
        [amount, reason || '', new Date().toISOString(), id],
        function(err) {
          if (err) return res.status(500).send({ error: err.message });

          // Return updated balance
          db.get(
            'SELECT id, customerId, balance, notes, updated_at FROM customer_balance WHERE customerId = ?',
            [id],
            (getErr, row) => {
              if (getErr) return res.status(500).send({ error: getErr.message });
              res.send({ success: true, ...row });
            }
          );
        }
      );
    }
  );
});

// Get customer credits/dues (partial payments linked to bills)
app.get('/customer/:id/credits', (req, res) => {
  const id = req.params.id;
  db.all(
    `SELECT cc.id, cc.billId, cc.dueAmount, cc.paidAmount, cc.note, cc.created_at, cc.updated_at,
            b.id as bill_id, b.total as bill_total, b.created_at as bill_date
     FROM customer_credit cc
     LEFT JOIN bills b ON cc.billId = b.id
     WHERE cc.customerId = ?
     ORDER BY cc.created_at DESC`,
    [id],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      const credits = (rows || []).map(r => ({
        id: r.id,
        billId: r.billId,
        dueAmount: Number(r.dueAmount || 0),
        paidAmount: Number(r.paidAmount || 0),
        note: r.note || '',
        created_at: r.created_at,
        updated_at: r.updated_at,
        billTotal: Number(r.bill_total || 0),
        billDate: r.bill_date
      }));
      res.send(credits);
    }
  );
});

// Get all pending dues (unpaid customer credits) - for Pending Dues report
app.get('/pending-dues', (req, res) => {
  db.all(
      `SELECT cc.id, cc.customerId, cc.billId, cc.dueAmount, cc.paidAmount, cc.created_at,
        COALESCE(cc.customerName, c.name) as customerName, COALESCE(cc.customerPhone, c.phone) as customerPhone,
        b.total as billTotal, b.created_at as billDate
       FROM customer_credit cc
       LEFT JOIN customers c ON cc.customerId = c.id
       LEFT JOIN bills b ON cc.billId = b.id
       WHERE cc.dueAmount > 0
       ORDER BY cc.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      const dues = (rows || []).map(r => ({
        id: r.id,
        customerId: r.customerId,
        customerName: r.customerName || 'Walk-in',
        customerPhone: r.customerPhone || '',
        billId: r.billId,
        billTotal: Number(r.billTotal || 0),
        billDate: r.billDate,
        dueAmount: Number(r.dueAmount || 0),
        paidAmount: Number(r.paidAmount || 0),
        recordedDate: r.created_at
      }));
      res.send(dues);
    }
  );
});

// Create bill with items
app.post('/bill', (req, res) => {
  const { customerId, customerName, items, subtotal, discount, tax, paymentMethod, notes, usedPoints, paid } = req.body;
  const paidNum = Number(paid || 0);
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).send({ error: 'items array required' });
  }

  // Loyalty config: value per point (₹1 per point)
  const POINT_VALUE = 1;

  // compute discount from usedPoints if provided (server-authoritative)
  let pointsToRedeem = Number(usedPoints || 0);
  if (pointsToRedeem < 0) pointsToRedeem = 0;

  const subtotalNum = Number(subtotal || 0);
  const taxNum = Number(tax || 0);
  let discountValue = Number(discount || 0);

  const finalizeBill = (customerIdVal) => {
    const total = subtotalNum - discountValue + taxNum;
    const itemsJson = JSON.stringify(items);

    db.run(
      "INSERT INTO bills (customerId, customerName, subtotal, discount, tax, total, payment_method, items_json, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [customerIdVal || null, customerName || '', subtotalNum || 0, discountValue || 0, taxNum || 0, total, paymentMethod || 'cash', itemsJson, notes || ''],
      function(err) {
        if (err) return res.status(500).send({ error: err.message });

        const billId = this.lastID;

        // For each billed item: insert a sales row (using unitPrice / MRP) and decrement stock
        const promises = items.map(item => {
          return new Promise((resolve) => {
            // Fetch current item to read costPerKg (for profit calculations)
            db.get('SELECT costPerKg FROM items WHERE id = ?', [item.itemId], (gErr, row) => {
              const costPerKg = (row && row.costPerKg) ? Number(row.costPerKg) : 0;
              const unitPrice = Number(item.unitPrice || 0);
              const weight = Number(item.quantity || 0);
              const totalLine = unitPrice * weight;

              // Insert into sales table (snapshot of sale)
              db.run('INSERT INTO sales (itemId, weight, pricePerKg, costPerKg, total) VALUES (?, ?, ?, ?, ?)',
                [item.itemId, weight, unitPrice, costPerKg, totalLine], function(sErr) {
                  if (sErr) console.error('Failed to insert sale for item', item.itemId, sErr.message);

                  // Decrement item stock regardless of sales insert success
                  db.run('UPDATE items SET quantity = quantity - ? WHERE id = ?', [weight, item.itemId], (uErr) => {
                    if (uErr) console.error('Stock update failed for item', item.itemId, uErr.message);
                    resolve();
                  });
              });
            });
          });
        });

        // Update customer loyalty points if exists
        Promise.all(promises).then(() => {
          const finalTotal = subtotalNum - discountValue + taxNum;
          const pointsGained = Math.floor(finalTotal / 10); // 1 point per ₹10

          const respondWith = (extra) => {
            const due = Number(Math.max(0, total - paidNum));
            res.send(Object.assign({ success: true, billId, total, due, redeemedPoints: pointsToRedeem }, extra || {}));
          };

          // If partial payment, insert a customer_credit record
          if (paidNum < total) {
            db.run(
              'INSERT INTO customer_credit (customerId, billId, dueAmount, paidAmount, customerName, customerPhone, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [customerIdVal || null, billId, Number((total - paidNum).toFixed(2)), paidNum, customerName || '', (req.body.customerPhone || ''), notes || '', new Date().toISOString()],
              function(ccErr) {
                if (ccErr) console.error('Failed to insert customer_credit', ccErr.message);
                // proceed to award points and respond
                if (customerIdVal) {
                  db.run('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?', [pointsGained, customerIdVal], () => respondWith({ pointsGained }));
                } else {
                  respondWith();
                }
              }
            );
          } else {
            // fully paid: no credit record
            if (customerIdVal) {
              db.run('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?', [pointsGained, customerIdVal], () => respondWith({ pointsGained }));
            } else {
              respondWith();
            }
          }

        }).catch((e) => {
          console.error('Error processing bill items', e);
          res.send({ success: true, billId, total });
        });
      }
    );
  };

  // If redeeming points, fetch customer to validate and deduct
  if (customerId && pointsToRedeem > 0) {
    db.get('SELECT loyalty_points FROM customers WHERE id = ?', [customerId], (cErr, crow) => {
      if (cErr) return res.status(500).send({ error: cErr.message });
      const available = Number((crow && crow.loyalty_points) || 0);
      if (available <= 0) {
        pointsToRedeem = 0;
      } else if (pointsToRedeem > available) {
        pointsToRedeem = Math.floor(available);
      }
      discountValue = pointsToRedeem * POINT_VALUE;

      // Deduct redeemed points
      if (pointsToRedeem > 0) {
        db.run('UPDATE customers SET loyalty_points = loyalty_points - ? WHERE id = ?', [pointsToRedeem, customerId], (dErr) => {
          if (dErr) console.error('Failed to deduct redeemed points', dErr.message);
          finalizeBill(customerId);
        });
      } else {
        finalizeBill(customerId);
      }
    });
  } else {
    // No redemption requested
    finalizeBill(customerId);
  }
});

// Get bill by ID
app.get('/bill/:id', (req, res) => {
  db.get(
    `SELECT b.*, c.phone, c.name, c.email FROM bills b 
     LEFT JOIN customers c ON b.customerId = c.id 
     WHERE b.id = ?`,
    [req.params.id],
    (err, bill) => {
      if (err) return res.status(500).send({ error: err.message });
      if (!bill) return res.status(404).send({ error: 'Bill not found' });
      
      bill.items = JSON.parse(bill.items_json || '[]');
      // Attach profile (store) info and any customer_credit info (due/paid) related to this bill
      db.get('SELECT store_name, store_address, phone, owner_name FROM profile ORDER BY id DESC LIMIT 1', (pErr, profileRow) => {
        if (pErr) console.error('Failed to fetch profile for bill header', pErr.message);
        if (profileRow) {
          bill.store = {
            name: profileRow.store_name || '',
            address: profileRow.store_address || '',
            phone: profileRow.phone || '',
            owner: profileRow.owner_name || ''
          };
        } else {
          bill.store = { name: '', address: '', phone: '', owner: '' };
        }

        db.get('SELECT dueAmount, paidAmount FROM customer_credit WHERE billId = ?', [bill.id], (ccErr, ccRow) => {
          if (ccErr) {
            console.error('Failed to fetch customer_credit for bill', bill.id, ccErr.message);
            // return bill with store info but without credit info
            return res.send(bill);
          }
          if (ccRow) {
            // Prefer recorded dueAmount, but compute fallback from paidAmount if missing
            const paidAmt = Number(ccRow.paidAmount || 0);
            const recordedDue = typeof ccRow.dueAmount !== 'undefined' && ccRow.dueAmount !== null ? Number(ccRow.dueAmount) : null;
            bill.paidAmount = paidAmt;
            bill.dueAmount = recordedDue !== null ? recordedDue : Math.max(0, Number(bill.total || 0) - paidAmt);
          } else {
            bill.dueAmount = 0;
            bill.paidAmount = 0;
          }
          res.send(bill);
        });
      });
    }
  );
});

  // Shareable message for a bill (returns text + quick links)
  app.get('/share/bill/:id', (req, res) => {
    const id = req.params.id;
    db.get(
      `SELECT b.*, c.name as customerName, c.phone as customerPhone FROM bills b LEFT JOIN customers c ON b.customerId = c.id WHERE b.id = ?`,
      [id],
      (err, bill) => {
        if (err) return res.status(500).send({ error: err.message });
        if (!bill) return res.status(404).send({ error: 'Bill not found' });
        // fetch profile (store) info to include in shared message
        db.get('SELECT store_name, store_address, phone FROM profile ORDER BY id DESC LIMIT 1', (pErr, profile) => {
          if (pErr) console.error('Failed to fetch profile for share message', pErr.message);

          const items = JSON.parse(bill.items_json || '[]');
        const lines = items.map(i => `${i.name} x${i.quantity} @ ₹${Number(i.unitPrice||0).toFixed(2)} = ₹${(i.quantity * (i.unitPrice||0)).toFixed(2)}`);
        const totalSaved = items.reduce((s, i) => {
          const unit = Number(i.unitPrice || 0);
          const mrp = i.mrp ? Number(i.mrp) : null;
          return s + (mrp && mrp > unit ? (mrp - unit) * i.quantity : 0);
        }, 0);

        const msgLines = [];
          // Prepend store info when available
          if (profile && (profile.store_name || profile.store_address || profile.phone)) {
            if (profile.store_name) msgLines.push(profile.store_name);
            if (profile.store_address) msgLines.push(profile.store_address);
            if (profile.phone) msgLines.push('Phone: ' + profile.phone);
            msgLines.push(''); // empty line
          }

          msgLines.push(`Thank you for your purchase${bill.customerName ? ' ' + bill.customerName : ''}!`);
          msgLines.push(`Bill #: ${bill.id}`);
          msgLines.push(`Date: ${new Date(bill.created_at).toLocaleString()}`);
        msgLines.push('Items:');
        msgLines.push(...lines);
        msgLines.push(`Subtotal: ₹${Number(bill.subtotal||0).toFixed(2)}`);
        msgLines.push(`Discount: -₹${Number(bill.discount||0).toFixed(2)}`);
        msgLines.push(`Total: ₹${Number(bill.total||0).toFixed(2)}`);
        if (totalSaved > 0) msgLines.push(`You saved: ₹${Number(totalSaved).toFixed(2)} (vs MRP)`);
          msgLines.push('Visit us again — Thank you!');

          const text = msgLines.join('\n');
        // WhatsApp URL (international neutral; recipient optional on client)
        const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
        const sms = `sms:?body=${encodeURIComponent(text)}`;

          res.send({ text, whatsappUrl: wa, smsUrl: sms, billId: bill.id, store: profile || {} });
        });
      }
    );
  });

  // Shareable stock alert message for an item
  app.get('/share/stock-alert/:itemId', (req, res) => {
    const itemId = req.params.itemId;
    db.get('SELECT id, name, quantity, reorderThreshold FROM items WHERE id = ?', [itemId], (err, item) => {
      if (err) return res.status(500).send({ error: err.message });
      if (!item) return res.status(404).send({ error: 'Item not found' });

      const msg = `Stock Alert: ${item.name} is low on stock. Remaining: ${Number(item.quantity||0).toFixed(2)} units. Reorder threshold: ${Number(item.reorderThreshold||0)}.`;
      const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      const sms = `sms:?body=${encodeURIComponent(msg)}`;
      res.send({ text: msg, whatsappUrl: wa, smsUrl: sms, itemId: item.id });
    });
  });

// Get recent bills
app.get('/bills', (req, res) => {
  const limit = req.query.limit || 10;
  db.all(
    `SELECT b.*, c.phone, c.name FROM bills b 
     LEFT JOIN customers c ON b.customerId = c.id 
     ORDER BY b.created_at DESC LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      res.send(rows || []);
    }
  );
});

// Reorder Predictions: items below threshold + simple ETA
app.get('/predictions', (req, res) => {
  db.all(
    'SELECT id, name, quantity, type, reorderThreshold, reorderQuantity FROM items WHERE quantity <= reorderThreshold ORDER BY quantity ASC',
    (err, lowStockItems) => {
      if (err) return res.status(500).send({ error: err.message });
      
      // compute simple ETA: avg daily sales from past 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoIso = sevenDaysAgo.toISOString();
      const nowIso = new Date().toISOString();
      
      db.get(
        'SELECT SUM(weight) as totalSold FROM sales WHERE created_at >= ? AND created_at <= ?',
        [sevenDaysAgoIso, nowIso],
        (sErr, sRow) => {
          const totalSold = Number((sRow && sRow.totalSold) || 0);
          const avgDailySales = totalSold / 7;
          
          const predictions = lowStockItems.map(item => {
            const days = avgDailySales > 0 ? Math.ceil(item.quantity / avgDailySales) : 999;
            return {
              ...item,
              avgDailySales: Number(avgDailySales).toFixed(2),
              daysUntilStockout: days,
              suggestedReorder: item.reorderQuantity
            };
          });
          
          res.send(predictions);
        }
      );
    }
  );
});

// ==================== SUPPLIERS ====================

// Get all suppliers
app.get("/suppliers", (req, res) => {
  db.all("SELECT * FROM suppliers ORDER BY name", (err, rows) => {
    if (err) return res.status(500).send({ error: err.message });
    res.send(rows || []);
  });
});

// Add supplier
app.post("/supplier", (req, res) => {
  const { name, phone, email, address, notes } = req.body;
  
  db.run(
    "INSERT INTO suppliers (name, phone, email, address, notes) VALUES (?, ?, ?, ?, ?)",
    [name || '', phone || '', email || '', address || '', notes || ''],
    function(err) {
      if (err) return res.status(500).send({ error: err.message });
      res.send({ success: true, id: this.lastID });
    }
  );
});

// Update supplier
app.put("/supplier/:id", (req, res) => {
  const id = req.params.id;
  const { name, phone, email, address, notes } = req.body;
  
  db.run(
    "UPDATE suppliers SET name=?, phone=?, email=?, address=?, notes=? WHERE id=?",
    [name || '', phone || '', email || '', address || '', notes || '', id],
    (err) => {
      if (err) return res.status(500).send({ error: err.message });
      res.send({ success: true });
    }
  );
});

// Delete supplier
app.delete("/supplier/:id", (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM suppliers WHERE id=?", [id], (err) => {
    if (err) return res.status(500).send({ error: err.message });
    res.send({ success: true });
  });
});

// ==================== PURCHASES ====================

// Record a purchase: insert into purchases + increment item stock + update cost
app.post("/purchase", (req, res) => {
  const { itemId, supplierId, quantity, costPerUnit, purchaseDate, notes } = req.body;
  
  if (!itemId || !supplierId || !quantity || !costPerUnit) {
    return res.status(400).send({ error: "Missing required fields: itemId, supplierId, quantity, costPerUnit" });
  }
  
  const totalCost = quantity * costPerUnit;
  
  // Start transaction: insert purchase, then update item stock and cost
  db.run("BEGIN TRANSACTION", (beginErr) => {
    if (beginErr) return res.status(500).send({ error: beginErr.message });
    
    // Insert purchase record
    db.run(
      "INSERT INTO purchases (itemId, supplierId, quantity, costPerUnit, totalCost, purchaseDate, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [itemId, supplierId, quantity, costPerUnit, totalCost, purchaseDate || new Date().toISOString(), notes || ''],
      function(insertErr) {
        if (insertErr) {
          db.run("ROLLBACK");
          return res.status(500).send({ error: insertErr.message });
        }
        
        const purchaseId = this.lastID;
        
        // Update item: increment quantity and update costPerKg (weighted average)
        db.get("SELECT quantity, costPerKg FROM items WHERE id=?", [itemId], (getErr, item) => {
          if (getErr) {
            db.run("ROLLBACK");
            return res.status(500).send({ error: getErr.message });
          }
          
          if (!item) {
            db.run("ROLLBACK");
            return res.status(404).send({ error: "Item not found" });
          }
          
          const oldQty = Number(item.quantity || 0);
          const oldCost = Number(item.costPerKg || 0);
          const newQty = oldQty + quantity;
          
          // Weighted average cost: (oldQty * oldCost + newQty * costPerUnit) / newQty
          const newCost = (oldQty * oldCost + quantity * costPerUnit) / newQty;
          
          db.run(
            "UPDATE items SET quantity=?, costPerKg=? WHERE id=?",
            [newQty, newCost, itemId],
            (updateErr) => {
              if (updateErr) {
                db.run("ROLLBACK");
                return res.status(500).send({ error: updateErr.message });
              }
              
              // Commit transaction
              db.run("COMMIT", (commitErr) => {
                if (commitErr) {
                  db.run("ROLLBACK");
                  return res.status(500).send({ error: commitErr.message });
                }
                
                res.send({
                  success: true,
                  id: purchaseId,
                  message: `Added ${quantity} units. New stock: ${newQty}, Updated cost: ₹${newCost.toFixed(2)}/kg`
                });
              });
            }
          );
        });
      }
    );
  });
});

// Get all purchases (with optional item filter)
app.get("/purchases", (req, res) => {
  const itemId = req.query.itemId;
  
  if (itemId) {
    db.all(
      `SELECT p.*, i.name as itemName, s.name as supplierName 
       FROM purchases p
       LEFT JOIN items i ON p.itemId = i.id
       LEFT JOIN suppliers s ON p.supplierId = s.id
       WHERE p.itemId = ? 
       ORDER BY p.created_at DESC`,
      [itemId],
      (err, rows) => {
        if (err) return res.status(500).send({ error: err.message });
        res.send(rows || []);
      }
    );
  } else {
    db.all(
      `SELECT p.*, i.name as itemName, s.name as supplierName 
       FROM purchases p
       LEFT JOIN items i ON p.itemId = i.id
       LEFT JOIN suppliers s ON p.supplierId = s.id
       ORDER BY p.created_at DESC`,
      (err, rows) => {
        if (err) return res.status(500).send({ error: err.message });
        res.send(rows || []);
      }
    );
  }
});

// Get purchases summary (total spent, items purchased, etc.)
app.get("/purchases/summary/:period", (req, res) => {
  const period = req.params.period; // 'today', 'week', 'month'
  const now = new Date();
  let start;
  
  if (period === 'today') {
    start = new Date(now);
    start.setHours(0,0,0,0);
  } else if (period === 'week') {
    start = new Date(now);
    start.setDate(now.getDate() - 7);
    start.setHours(0,0,0,0);
  } else if (period === 'month') {
    start = new Date(now);
    start.setMonth(now.getMonth() - 1);
    start.setHours(0,0,0,0);
  }
  
  const startIso = start.toISOString();
  const nowIso = now.toISOString();
  
  db.get(
    `SELECT COUNT(*) as purchaseCount, SUM(quantity) as totalQty, SUM(totalCost) as totalSpent
     FROM purchases WHERE created_at >= ? AND created_at <= ?`,
    [startIso, nowIso],
    (err, row) => {
      if (err) return res.status(500).send({ error: err.message });
      res.send({
        period,
        purchaseCount: Number(row.purchaseCount || 0),
        totalQuantity: Number(row.totalQty || 0),
        totalSpent: Number(row.totalSpent || 0)
      });
    }
  );
});

// Audit log retrieval
app.get('/audit', (req, res) => {
  const entity = req.query.entity;
  const entityId = req.query.entityId;
  let sql = 'SELECT * FROM audit_log';
  const params = [];
  if (entity) {
    sql += ' WHERE entity = ?';
    params.push(entity);
    if (entityId) {
      sql += ' AND entityId = ?';
      params.push(entityId);
    }
  }
  sql += ' ORDER BY created_at DESC';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).send({ error: err.message });
    res.send(rows || []);
  });
});

// ==================== REPORTS & ANALYTICS ====================

// Sales trend for last 7 days (returns array of {date, total})
app.get('/reports/sales-trend', (req, res) => {
  // return sales totals per day for last 7 days
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push(d.toISOString().slice(0,10));
  }

  const start = new Date();
  start.setDate(start.getDate() - 6);
  start.setHours(0,0,0,0);
  const startIso = start.toISOString();

  db.all(
    `SELECT DATE(created_at) as d, SUM(total) as total FROM sales WHERE created_at >= ? GROUP BY DATE(created_at)`,
    [startIso],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      const map = {};
      (rows || []).forEach(r => map[r.d] = Number(r.total || 0));
      const out = days.map(dt => ({ date: dt, total: Number(map[dt] || 0) }));
      res.send(out);
    }
  );
});

// Top products: returns top N products by quantity sold in last X days
app.get('/reports/top-products', (req, res) => {
  const limit = parseInt(req.query.limit || '10');
  const days = parseInt(req.query.days || '30');
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startIso = start.toISOString();

  db.all(
    `SELECT s.itemId, i.name as itemName, SUM(s.weight) as qtySold, SUM(s.total) as revenue
     FROM sales s
     LEFT JOIN items i ON s.itemId = i.id
     WHERE s.created_at >= ?
     GROUP BY s.itemId
     ORDER BY qtySold DESC
     LIMIT ?`,
    [startIso, limit],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      res.send(rows || []);
    }
  );
});

// Fast moving products (top sellers by quantity sold)
app.get('/reports/fast-moving-products', (req, res) => {
  const limit = parseInt(req.query.limit || '10');
  const days = parseInt(req.query.days || '30');
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startIso = start.toISOString();

  db.all(
    `SELECT s.itemId, i.name as itemName, SUM(s.weight) as qtySold, SUM(s.total) as revenue
     FROM sales s
     LEFT JOIN items i ON s.itemId = i.id
     WHERE s.created_at >= ?
     GROUP BY s.itemId
     ORDER BY qtySold DESC
     LIMIT ?`,
    [startIso, limit],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      res.send(rows || []);
    }
  );
});

// Slow moving products (least sold items in recent period)
app.get('/reports/slow-moving-products', (req, res) => {
  const limit = parseInt(req.query.limit || '10');
  const days = parseInt(req.query.days || '30');
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startIso = start.toISOString();

  db.all(
    `SELECT i.id as itemId, i.name as itemName,
            COALESCE(SUM(s.weight), 0) as qtySold,
            COALESCE(SUM(s.total), 0) as revenue,
            COALESCE(MAX(s.created_at), '') as lastSale,
            i.quantity
     FROM items i
     LEFT JOIN sales s ON s.itemId = i.id AND s.created_at >= ?
     WHERE i.quantity > 0
     GROUP BY i.id
     ORDER BY qtySold ASC, i.quantity DESC
     LIMIT ?`,
    [startIso, limit],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      const results = (rows || []).map(r => ({
        itemId: r.itemId,
        itemName: r.itemName,
        qtySold: Number(r.qtySold || 0),
        revenue: Number(r.revenue || 0),
        lastSale: r.lastSale,
        quantity: Number(r.quantity || 0)
      }));
      res.send(results);
    }
  );
});

// Reorder alerts: automatic alerts for items below or at reorder threshold
app.get('/reports/reorder-alerts', (req, res) => {
  db.all(
    `SELECT id, name, quantity, reorderThreshold, reorderQuantity, supplierId
     FROM items
     WHERE quantity <= reorderThreshold
     ORDER BY quantity ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      const alerts = (rows || []).map(item => ({
        ...item,
        suggestedReorder: item.reorderQuantity || 0,
        shortage: Number(item.reorderThreshold || 0) - Number(item.quantity || 0)
      }));
      res.send(alerts);
    }
  );
});

// Dead stock report: products with stock but no sales in last 90 days
app.get('/reports/dead-stock', (req, res) => {
  const days = parseInt(req.query.days || '90');
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startIso = start.toISOString();

  db.all(
    `SELECT i.id, i.name, i.category, i.quantity, i.costPerKg, i.supplierId,
            COALESCE(MAX(s.created_at), '') as lastSale,
            COALESCE(SUM(s.weight), 0) as qtySold
     FROM items i
     LEFT JOIN sales s ON s.itemId = i.id
     GROUP BY i.id
     HAVING i.quantity > 0 AND (MAX(s.created_at) IS NULL OR MAX(s.created_at) < ?)
     ORDER BY i.quantity DESC`,
    [startIso],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      res.send(rows || []);
    }
  );
});

// Supplier-wise purchase analysis
app.get('/reports/supplier-purchases', (req, res) => {
  db.all(
    `SELECT s.id as supplierId, s.name as supplierName,
            COUNT(p.id) as purchaseCount,
            COALESCE(SUM(p.quantity), 0) as totalQty,
            COALESCE(SUM(p.totalCost), 0) as totalSpend,
            COALESCE(AVG(p.costPerUnit), 0) as avgCostPerUnit
     FROM purchases p
     LEFT JOIN suppliers s ON p.supplierId = s.id
     GROUP BY s.id
     ORDER BY totalSpend DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      res.send(rows || []);
    }
  );
});

// Expiry tracking alerts: products expiring soon or already expired
app.get('/reports/expiry-alerts', (req, res) => {
  const days = parseInt(req.query.days || '30');
  const now = new Date();
  const horizon = new Date();
  horizon.setDate(now.getDate() + days);
  const nowIso = now.toISOString();
  const horizonIso = horizon.toISOString();

  db.all(
    `SELECT id, name, quantity, expiryDate, supplierId, category
     FROM items
     WHERE expiryDate IS NOT NULL AND expiryDate != '' AND expiryDate <= ?
     ORDER BY expiryDate ASC`,
    [horizonIso],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      res.send((rows || []).map(item => ({
        ...item,
        expired: new Date(item.expiryDate) < now,
        daysUntilExpiry: Math.ceil((new Date(item.expiryDate) - now) / (1000*60*60*24))
      })));
    }
  );
});

// ABC analysis for products based on sales revenue over the last X days
app.get('/reports/abc-analysis', (req, res) => {
  const days = parseInt(req.query.days || '90');
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startIso = start.toISOString();

  db.all(
    `SELECT i.id as itemId, i.name as itemName, COALESCE(SUM(s.total), 0) as revenue
     FROM items i
     LEFT JOIN sales s ON s.itemId = i.id AND s.created_at >= ?
     GROUP BY i.id
     ORDER BY revenue DESC`,
    [startIso],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      const items = (rows || []).map(r => ({ itemId: r.itemId, itemName: r.itemName || 'Unknown', revenue: Number(r.revenue || 0) }));
      const totalRevenue = items.reduce((sum, item) => sum + item.revenue, 0) || 1;
      let cumulative = 0;
      const result = items.map(item => {
        cumulative += item.revenue;
        const share = item.revenue / totalRevenue;
        let abc = 'C';
        if (cumulative <= 0.7 * totalRevenue) abc = 'A';
        else if (cumulative <= 0.9 * totalRevenue) abc = 'B';
        return { ...item, share: Number(share.toFixed(4)), category: abc };
      });

      res.send({ totalRevenue, results: result });
    }
  );
});

// Peak hours (hour of day 0-23) for last N days: returns [{hour, total}]
app.get('/reports/peak-hours', (req, res) => {
  const days = parseInt(req.query.days || '7');
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startIso = start.toISOString();

  db.all(
    `SELECT STRFTIME('%H', created_at) as hour, SUM(total) as total
     FROM sales
     WHERE created_at >= ?
     GROUP BY hour
     ORDER BY hour ASC`,
    [startIso],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      // ensure all 24 hours present
      const out = [];
      const map = {};
      (rows || []).forEach(r => map[Number(r.hour)] = Number(r.total || 0));
      for (let h = 0; h < 24; h++) out.push({ hour: h, total: Number(map[h] || 0) });
      res.send(out);
    }
  );
});

// Recent transactions (bills) - includes customer info and items
app.get('/reports/recent-bills', (req, res) => {
  const limit = parseInt(req.query.limit || '20');
  db.all(
    `SELECT b.id, b.created_at, b.subtotal, b.discount, b.tax, b.total, b.payment_method, b.items_json, c.name as customerName, c.phone as customerPhone
     FROM bills b
     LEFT JOIN customers c ON b.customerId = c.id
     ORDER BY b.created_at DESC
     LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      res.send(rows || []);
    }
  );
});

// ==================== SETTINGS & STORES ====================

// Get profile
app.get('/profile', (req, res) => {
  db.get('SELECT * FROM profile ORDER BY id DESC LIMIT 1', (err, row) => {
    if (err) return res.status(500).send({ error: err.message });
    res.send(row || {});
  });
});

// Save/update profile (single record)
app.post('/profile', (req, res) => {
  const { owner_name, store_name, store_address, phone, email } = req.body;
  // upsert: delete old and insert new for simplicity
  db.run('DELETE FROM profile', (dErr) => {
    if (dErr) return res.status(500).send({ error: dErr.message });
    db.run('INSERT INTO profile (owner_name, store_name, store_address, phone, email) VALUES (?, ?, ?, ?, ?)',
      [owner_name || '', store_name || '', store_address || '', phone || '', email || ''], function(err) {
        if (err) return res.status(500).send({ error: err.message });
        res.send({ success: true, id: this.lastID });
      }
    );
  });
});

// Stores CRUD
app.get('/stores', (req, res) => {
  db.all('SELECT * FROM stores ORDER BY is_primary DESC, name ASC', (err, rows) => {
    if (err) return res.status(500).send({ error: err.message });
    res.send(rows || []);
  });
});

app.post('/store', (req, res) => {
  const { name, address, city, phone, is_primary } = req.body;
  db.run('INSERT INTO stores (name,address,city,phone,is_primary) VALUES (?, ?, ?, ?, ?)',
    [name || '', address || '', city || '', phone || '', is_primary ? 1 : 0], function(err) {
      if (err) return res.status(500).send({ error: err.message });
      res.send({ success: true, id: this.lastID });
    }
  );
});

app.put('/store/:id', (req, res) => {
  const id = req.params.id;
  const { name, address, city, phone, is_primary } = req.body;
  db.run('UPDATE stores SET name=?, address=?, city=?, phone=?, is_primary=? WHERE id=?',
    [name || '', address || '', city || '', phone || '', is_primary ? 1 : 0, id], (err) => {
      if (err) return res.status(500).send({ error: err.message });
      res.send({ success: true });
    }
  );
});

app.delete('/store/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM stores WHERE id=?', [id], (err) => {
    if (err) return res.status(500).send({ error: err.message });
    res.send({ success: true });
  });
});

// Subscription (mock): set plan to 'free' or 'pro'
app.post('/subscribe', (req, res) => {
  const { plan } = req.body; // 'free' or 'pro'
  if (!plan) return res.status(400).send({ error: 'plan required' });
  db.run("INSERT INTO settings(key,value) VALUES('subscriptionPlan',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [plan], (err) => {
    if (err) return res.status(500).send({ error: err.message });
    res.send({ success: true, plan });
  });
});

app.get('/subscription', (req, res) => {
  db.get("SELECT value FROM settings WHERE key='subscriptionPlan'", (err, row) => {
    if (err) return res.status(500).send({ error: err.message });
    res.send({ plan: row ? row.value : 'free' });
  });
});

// ==================== AI SUPPORT ASSISTANT ====================
// Simple chat endpoint: accepts { question: string } and returns { answer: string, data?: any }
app.post('/ai/query', (req, res) => {
  const question = (req.body.question || '').toString().trim();
  if (!question) return res.status(400).send({ error: 'question required' });
  const q = question.toLowerCase();

  // Helper to get sales total between two ISO datetimes
  function salesTotalBetween(startIso, endIso, cb) {
    db.get('SELECT SUM(total) as total FROM sales WHERE created_at >= ? AND created_at <= ?', [startIso, endIso], (err, row) => {
      if (err) return cb(err);
      cb(null, Number((row && row.total) || 0));
    });
  }

  // Check for sales queries
  if (q.includes('total sales') || q.includes('sales today') || q.match(/how much .*sell/)) {
    let period = 'today';
    if (q.includes('week') || q.includes('this week')) period = 'week';
    if (q.includes('month') || q.includes('this month')) period = 'month';

    const now = new Date();
    let start = new Date(now);
    if (period === 'today') {
      start.setHours(0,0,0,0);
    } else if (period === 'week') {
      start.setDate(now.getDate() - 6);
      start.setHours(0,0,0,0);
    } else if (period === 'month') {
      start.setMonth(now.getMonth(), 1);
      start.setHours(0,0,0,0);
    }
    const startIso = start.toISOString();
    const endIso = new Date(now.getTime() + 24*60*60*1000).toISOString();

    return salesTotalBetween(startIso, endIso, (err, total) => {
      if (err) return res.status(500).send({ error: err.message });
      return res.send({ answer: `Total sales for ${period}: ₹${total.toFixed(2)}`, data: { period, total } });
    });
  }

  // Top-seller queries: "which product sold the most this week?", "best selling" etc.
  if (q.includes('sold the most') || q.includes('most sold') || q.includes('best selling') || q.includes('top seller') || q.includes('best seller')) {
    // determine period: default to this week
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now.getTime() + 24*60*60*1000);
    if (q.includes('today')) {
      start.setHours(0,0,0,0);
    } else if (q.includes('week') || q.includes('this week')) {
      start.setDate(now.getDate() - 6);
      start.setHours(0,0,0,0);
    } else if (q.includes('month') || q.includes('this month')) {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0,0,0,0);
    } else if (q.includes('last month')) {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      // fallback to last 7 days
      start.setDate(now.getDate() - 6);
      start.setHours(0,0,0,0);
    }
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    // allow asking for top N: "top 3" etc.
    let topN = 1;
    const topMatch = q.match(/top\s*(\d+)/);
    if (topMatch) topN = Math.max(1, Number(topMatch[1]));

    db.all(
      `SELECT s.itemId, IFNULL(i.name,'Unknown') as name, SUM(s.weight) as qtySold, SUM(s.total) as revenue
       FROM sales s
       LEFT JOIN items i ON s.itemId = i.id
       WHERE s.created_at >= ? AND s.created_at < ?
       GROUP BY s.itemId
       ORDER BY qtySold DESC
       LIMIT ?`,
      [startIso, endIso, topN],
      (err, rows) => {
        if (err) return res.status(500).send({ error: err.message });
        const top = (rows || []).map(r => ({ itemId: r.itemId, name: r.name, qtySold: Number(r.qtySold||0), revenue: Number(r.revenue||0) }));
        if (!top.length) return res.send({ answer: `No sales found for the requested period.`, intent: 'top_seller', data: { period: { start: startIso, end: endIso }, top: [] } });

        const humanList = top.map((t, i) => `${i+1}. ${t.name} — ${t.qtySold} units`).join(', ');
        const answer = topN === 1 ? `Top seller for the period: ${top[0].name} (${top[0].qtySold} units sold).` : `Top ${top.length} sellers: ${humanList}.`;
        return res.send({ answer, intent: 'top_seller', data: { period: { start: startIso, end: endIso }, top } });
      }
    );
    return;
  }

  // Top profitable items requests: "top 3 most profitable items last month"
  if (q.includes('most profitable') || (q.includes('profitable') && q.includes('items'))) {
    // determine period: last month or last 30 days
    const now = new Date();
    let start;
    let end = new Date(now);
    if (q.includes('last month')) {
      // first day of last month
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      // last 30 days
      start = new Date(now.getTime() - 30 * 24*60*60*1000);
    }
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    db.all(
      `SELECT s.itemId, IFNULL(i.name, 'Unknown') as name, SUM(s.total) as revenue, SUM(s.weight * s.costPerKg) as cost, (SUM(s.total) - SUM(s.weight * s.costPerKg)) as profit
       FROM sales s
       LEFT JOIN items i ON s.itemId = i.id
       WHERE s.created_at >= ? AND s.created_at < ?
       GROUP BY s.itemId
       ORDER BY profit DESC
       LIMIT 10`,
      [startIso, endIso],
      (err, rows) => {
        if (err) return res.status(500).send({ error: err.message });
        const top = (rows || []).slice(0, 3).map(r => ({ itemId: r.itemId, name: r.name, revenue: Number(r.revenue||0), cost: Number(r.cost||0), profit: Number(r.profit||0) }));
        const text = top.length ? `Top ${top.length} most profitable items for the period: ` + top.map(t => `${t.name} (profit ₹${t.profit.toFixed(2)})`).join(', ') : 'No profitable items found for the period.';
        return res.send({ answer: text, data: { period: { start: startIso, end: endIso }, top } });
      }
    );
    return;
  }

  // Predict next week's sales based on recent daily totals
  if (q.includes('predict') && q.includes('week') || q.includes('next week') || q.includes('forecast')) {
    // gather daily totals for past N days
    const N = 30; // use last 30 days for trend
    const now = new Date();
    const start = new Date(now.getTime() - N * 24*60*60*1000);
    const startIso = start.toISOString();

    db.all(
      `SELECT DATE(created_at) as d, SUM(total) as total FROM sales WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY DATE(created_at) ASC`,
      [startIso],
      (err, rows) => {
        if (err) return res.status(500).send({ error: err.message });
        const data = (rows || []).map(r => ({ date: r.d, total: Number(r.total||0) }));
        if (data.length < 3) {
          // not enough data, fallback to simple average
          const avg = data.reduce((s, x) => s + x.total, 0) / Math.max(1, data.length);
          const projected = Array.from({length:7}).map((_,i) => ({ date: new Date(now.getTime() + (i+1)*24*60*60*1000).toISOString().slice(0,10), predicted: avg }));
          return res.send({ answer: `Projected next week's sales (simple average): ₹${(avg*7).toFixed(2)}`, data: { projected } });
        }

        // linear regression (least squares) on day index
        const ys = data.map(d => d.total);
        const xs = data.map((d, i) => i); // 0..n-1
        const n = xs.length;
        const sumX = xs.reduce((s,x) => s+x, 0);
        const sumY = ys.reduce((s,y) => s+y, 0);
        const sumXY = xs.reduce((s,x,i) => s + x*ys[i], 0);
        const sumX2 = xs.reduce((s,x) => s + x*x, 0);
        const denom = (n*sumX2 - sumX*sumX) || 1;
        const slope = (n*sumXY - sumX*sumY) / denom;
        const intercept = (sumY - slope*sumX) / n;

        const projected = [];
        for (let k = 1; k <= 7; k++) {
          const xi = n + k - 1;
          const pred = intercept + slope * xi;
          const date = new Date(now.getTime() + k*24*60*60*1000).toISOString().slice(0,10);
          projected.push({ date, predicted: Math.max(0, pred) });
        }
        const totalProjected = projected.reduce((s,p) => s + p.predicted, 0);
        const ans = `Forecast for next 7 days: total ≈ ₹${totalProjected.toFixed(2)} (based on linear trend).`;
        return res.send({ answer: ans, data: { daily: data, projected, slope, intercept, totalProjected } });
      }
    );
    return;
  }

  // Sales strategies / discount suggestions
  if (q.includes('strategy') || q.includes('strategies') || q.includes('suggest') || q.includes('discount suggestion') || q.includes('discounts')) {
    // Gather: top sellers, slow movers, low stock, high margin items
    const thirtyAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString();
    db.all(
      `SELECT i.id, i.name, i.category, SUM(s.weight) as qtySold, SUM(s.total) as revenue, SUM(s.weight * s.costPerKg) as cost
       FROM sales s LEFT JOIN items i ON s.itemId = i.id
       WHERE s.created_at >= ?
       GROUP BY i.id
       ORDER BY qtySold DESC LIMIT 10`,
      [thirtyAgo],
      (err, topRows) => {
        if (err) return res.status(500).send({ error: err.message });
        db.all('SELECT id, name, quantity, reorderThreshold FROM items ORDER BY quantity ASC LIMIT 10', (iErr, lowStock) => {
          if (iErr) return res.status(500).send({ error: iErr.message });

          const topSellers = (topRows || []).map(r => ({ id: r.id, name: r.name, qtySold: Number(r.qtySold||0), revenue: Number(r.revenue||0), cost: Number(r.cost||0), profit: Number((r.revenue||0) - (r.cost||0)) }));
          const lowStockItems = (lowStock || []).map(i => ({ id: i.id, name: i.name, quantity: Number(i.quantity||0), reorderThreshold: Number(i.reorderThreshold||0) }));

          // Build suggestions
          const suggestions = [];
          if (topSellers.length) {
            suggestions.push(`Focus on top sellers: ${topSellers.slice(0,3).map(t => t.name).join(', ')} — ensure sufficient stock and consider bundle offers.`);
          }
          // slow movers: items in inventory with very low sales
          db.all(`SELECT i.id, i.name, i.quantity FROM items i LEFT JOIN (SELECT itemId, SUM(weight) as sold FROM sales WHERE created_at >= ? GROUP BY itemId) s ON i.id = s.itemId WHERE IFNULL(s.sold,0) < 1 ORDER BY i.quantity DESC LIMIT 6`, [thirtyAgo], (sErr, slowRows) => {
            if (!sErr && slowRows && slowRows.length) {
              suggestions.push(`Consider 10-20% discounts or bundle deals on slow-moving items: ${slowRows.map(r => r.name).slice(0,6).join(', ')}.`);
            }

            // margin-based suggestion: promote high-margin items
            const highMargin = topSellers.filter(t => t.revenue > 0).sort((a,b) => ((a.profit/a.revenue)-(b.profit/b.revenue))).slice(0,4).map(h => h.name);
            if (highMargin.length) suggestions.push(`Promote high-margin items: ${highMargin.join(', ')} — cross-sell with complementary products.`);

            suggestions.push('Run a weekday-limited loyalty double-points campaign to boost slow weekdays.');

            const text = suggestions.join(' ');
            return res.send({ answer: text, data: { topSellers, lowStockItems, slowRows } });
          });
        });
      }
    );
    return;
  }

  // Inventory count queries: "how many X do I have" or "how many X left"
  const howManyMatch = q.match(/how many (.+?) (?:do i have|left|remain|are left|remaining)/i) || q.match(/how many (.+)$/i);
  if (howManyMatch) {
    const raw = (howManyMatch[1] || '').trim();
    // Try to match against item names in DB
    db.all('SELECT id, name, quantity, type FROM items', (err, items) => {
      if (err) return res.status(500).send({ error: err.message });
      const lower = raw.toLowerCase();
      const matches = items.filter(it => it.name && it.name.toLowerCase().includes(lower));
      if (matches.length === 0) {
        // fuzzy: try matching any single word from raw
        const tokens = lower.split(/\s+/).filter(Boolean);
        const alt = items.filter(it => tokens.some(t => it.name && it.name.toLowerCase().includes(t)));
        if (alt.length === 0) return res.send({ answer: `I couldn't find any product matching "${raw}".` });
        const out = alt.map(a => `${a.name}: ${Number(a.quantity || 0)} units`).join('; ');
        return res.send({ answer: out, data: alt });
      }
      const out = matches.map(m => `${m.name}: ${Number(m.quantity || 0)} units`).join('; ');
      return res.send({ answer: out, data: matches });
    });
    return;
  }

  // If question mentions a product directly, try to return its quantity
  db.all('SELECT id, name, quantity FROM items', (err, items) => {
    if (err) return res.status(500).send({ error: err.message });
    const matched = items.filter(it => q.includes((it.name || '').toLowerCase()));
    if (matched.length > 0) {
      const out = matched.map(m => `${m.name}: ${Number(m.quantity || 0)} units`).join('; ');
      return res.send({ answer: out, data: matched });
    }

    // Fallback: basic trivia — recent bills count or help
    if (q.includes('recent') && q.includes('bills')) {
      db.get('SELECT COUNT(*) as c FROM bills WHERE created_at >= ?', [new Date(Date.now() - 24*60*60*1000).toISOString()], (e, row) => {
        if (e) return res.status(500).send({ error: e.message });
        return res.send({ answer: `You have ${Number(row.c||0)} bills in the last 24 hours.` });
      });
      return;
    }

    // Unknown question: provide guidance
    return res.send({ answer: `I can answer questions like "Total sales today" or "How many packets of milk do I have left?". Try asking one of those.` });
  });
});

// Update purchase record
app.put("/purchase/:id", (req, res) => {
  const id = req.params.id;
  const { quantity, costPerUnit, purchaseDate, notes } = req.body;
  
  if (!quantity || typeof costPerUnit === 'undefined') return res.status(400).send({ error: 'Missing quantity or costPerUnit' });

  // Edit purchase safely: adjust item quantity and optionally recalculate weighted average cost
  db.run("BEGIN TRANSACTION", (beginErr) => {
    if (beginErr) return res.status(500).send({ error: beginErr.message });

    // Fetch existing purchase
    db.get("SELECT * FROM purchases WHERE id=?", [id], (pErr, existing) => {
      if (pErr) {
        db.run("ROLLBACK");
        return res.status(500).send({ error: pErr.message });
      }
      if (!existing) {
        db.run("ROLLBACK");
        return res.status(404).send({ error: 'Purchase not found' });
      }

      const oldQty = Number(existing.quantity || 0);
      const oldCost = Number(existing.costPerUnit || 0);
      const itemId = existing.itemId;

      // Fetch current item totals
      db.get("SELECT quantity, costPerKg FROM items WHERE id=?", [itemId], (itErr, item) => {
        if (itErr) {
          db.run("ROLLBACK");
          return res.status(500).send({ error: itErr.message });
        }
        if (!item) {
          db.run("ROLLBACK");
          return res.status(404).send({ error: 'Item not found' });
        }

        const currentQty = Number(item.quantity || 0);
        const currentCost = Number(item.costPerKg || 0);

        // Compute totals and remove old purchase contribution
        const totalCostAll = currentCost * currentQty; // sum cost of all units currently
        const subtotalWithoutOld = totalCostAll - (oldQty * oldCost);

        const newQty = Number(quantity);
        const newCost = Number(costPerUnit);
        const newQtyTotal = currentQty - oldQty + newQty;

        const newTotalCostAll = subtotalWithoutOld + (newQty * newCost);
        const newCostPerKg = newQtyTotal > 0 ? (newTotalCostAll / newQtyTotal) : 0;

        // Update purchase record
        db.run(
          "UPDATE purchases SET quantity=?, costPerUnit=?, totalCost=?, purchaseDate=?, notes=? WHERE id=?",
          [newQty, newCost, newQty * newCost, purchaseDate || existing.purchaseDate, notes || existing.notes || '', id],
          (updErr) => {
            if (updErr) {
              db.run("ROLLBACK");
              return res.status(500).send({ error: updErr.message });
            }

            // Update item quantity and cost
            db.run(
              "UPDATE items SET quantity=?, costPerKg=? WHERE id=?",
              [newQtyTotal, newCostPerKg, itemId],
              (itUpdErr) => {
                if (itUpdErr) {
                  db.run("ROLLBACK");
                  return res.status(500).send({ error: itUpdErr.message });
                }

                // Insert audit log
                const oldVal = { quantity: oldQty, costPerUnit: oldCost, purchaseDate: existing.purchaseDate, notes: existing.notes };
                const newVal = { quantity: newQty, costPerUnit: newCost, purchaseDate: purchaseDate || existing.purchaseDate, notes: notes || existing.notes };
                db.run(
                  "INSERT INTO audit_log (entity, entityId, action, old_value, new_value, user) VALUES (?, ?, ?, ?, ?, ?)",
                  ['purchase', id, 'update', JSON.stringify(oldVal), JSON.stringify(newVal), 'system'],
                  (aErr) => {
                    if (aErr) {
                      db.run("ROLLBACK");
                      return res.status(500).send({ error: aErr.message });
                    }

                    db.run("COMMIT", (commitErr) => {
                      if (commitErr) {
                        db.run("ROLLBACK");
                        return res.status(500).send({ error: commitErr.message });
                      }
                      res.send({ success: true, message: 'Purchase updated', newQtyTotal, newCostPerKg });
                    });
                  }
                );
              }
            );
          }
        );
      });
    });
  });
});

// Delete purchase record
app.delete("/purchase/:id", (req, res) => {
  const id = req.params.id;
  
  // First get purchase details to reverse stock update
  db.get("SELECT itemId, quantity FROM purchases WHERE id=?", [id], (getErr, purchase) => {
    if (getErr) return res.status(500).send({ error: getErr.message });
    if (!purchase) return res.status(404).send({ error: "Purchase not found" });
    
    const itemId = purchase.itemId;
    const qty = Number(purchase.quantity || 0);
    
    // Decrement item quantity
    db.run(
      "UPDATE items SET quantity = quantity - ? WHERE id=?",
      [qty, itemId],
      (updateErr) => {
        if (updateErr) return res.status(500).send({ error: updateErr.message });
        
        // Delete purchase
        db.run("DELETE FROM purchases WHERE id=?", [id], (delErr) => {
          if (delErr) return res.status(500).send({ error: delErr.message });
          // write audit log for deletion
          const oldVal = { itemId, quantity: qty };
          db.run("INSERT INTO audit_log (entity, entityId, action, old_value, new_value, user) VALUES (?, ?, ?, ?, ?, ?)",
            ['purchase', id, 'delete', JSON.stringify(oldVal), JSON.stringify({}), 'system'], (aErr) => {
              if (aErr) return res.status(500).send({ error: aErr.message });
              res.send({ success: true, message: `Deleted purchase. Stock reduced by ${qty}.` });
            }
          );
        });
      }
    );
  });
});

// ===== EXPENSES =====
// Add expense
app.post("/expense", (req, res) => {
  const { description, category, amount, expenseDate, notes } = req.body;
  
  if (!description || !category || !amount) {
    return res.status(400).send({ error: "Description, category, and amount are required" });
  }
  
  db.run(
    "INSERT INTO expenses (description, category, amount, expenseDate, notes) VALUES (?, ?, ?, ?, ?)",
    [description, category, Number(amount) || 0, expenseDate || new Date().toISOString().split('T')[0], notes || ''],
    function(err) {
      if (err) {
        console.error('Error inserting expense:', err);
        return res.status(500).send({ error: err.message });
      }
      res.send({ success: true, id: this.lastID, message: "Expense recorded" });
    }
  );
});

// Get all expenses
app.get("/expenses", (req, res) => {
  const { category, search } = req.query;
  let query = "SELECT * FROM expenses WHERE 1=1";
  const params = [];
  
  if (category && category !== '') {
    query += " AND category = ?";
    params.push(category);
  }
  
  if (search && search.trim() !== '') {
    query += " AND (description LIKE ? OR notes LIKE ?)";
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm);
  }
  
  query += " ORDER BY expenseDate DESC, created_at DESC";
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).send({ error: err.message });
    res.send(rows || []);
  });
});

// Get expense by ID
app.get("/expense/:id", (req, res) => {
  const id = req.params.id;
  db.get("SELECT * FROM expenses WHERE id=?", [id], (err, row) => {
    if (err) return res.status(500).send({ error: err.message });
    if (!row) return res.status(404).send({ error: "Expense not found" });
    res.send(row);
  });
});

// Update expense
app.put("/expense/:id", (req, res) => {
  const id = req.params.id;
  const { description, category, amount, expenseDate, notes } = req.body;
  
  db.run(
    "UPDATE expenses SET description=?, category=?, amount=?, expenseDate=?, notes=? WHERE id=?",
    [description || '', category || '', Number(amount) || 0, expenseDate || new Date().toISOString().split('T')[0], notes || '', id],
    (err) => {
      if (err) return res.status(500).send({ error: err.message });
      res.send({ success: true, message: "Expense updated" });
    }
  );
});

// Delete expense
app.delete("/expense/:id", (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM expenses WHERE id=?", [id], (err) => {
    if (err) return res.status(500).send({ error: err.message });
    res.send({ success: true, message: "Expense deleted" });
  });
});

// Get expense summary
app.get("/expenses/summary/:period", (req, res) => {
  const period = req.params.period;
  let dateFilter = "";
  
  if (period === 'week') {
    dateFilter = "date('now', '-7 days')";
  } else if (period === 'month') {
    dateFilter = "date('now', '-30 days')";
  } else if (period === 'year') {
    dateFilter = "date('now', '-365 days')";
  }
  
  const query = `
    SELECT 
      category,
      COUNT(*) as count,
      SUM(amount) as total
    FROM expenses
    WHERE expenseDate >= ${dateFilter}
    GROUP BY category
    ORDER BY total DESC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).send({ error: err.message });
    const totalSpent = (rows || []).reduce((sum, r) => sum + (r.total || 0), 0);
    res.send({ summary: rows || [], totalSpent, period });
  });
});

// Record a debit entry (customer bought on debit)
app.post('/debit', (req, res) => {
  const { name, phone, amount, date, total, billId, notes } = req.body;
  if (!name || !amount) return res.status(400).send({ error: 'name and amount required' });

  const createdAt = new Date().toISOString();

  db.run('INSERT INTO debits (name, phone, amount, total, date, billId, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [name, phone || '', Number(amount) || 0, Number(total) || Number(amount) || 0, date || createdAt, billId || null, notes || '', createdAt],
    function(err) {
      if (err) return res.status(500).send({ error: err.message });
      res.send({ success: true, id: this.lastID });
    }
  );
});

// List recent debits
app.get('/debits', (req, res) => {
  const limit = parseInt(req.query.limit) || 200;
  db.all('SELECT id, name, phone, amount, total, date, billId, notes, created_at FROM debits ORDER BY created_at DESC LIMIT ?', [limit], (err, rows) => {
    if (err) return res.status(500).send({ error: err.message });
    res.send({ success: true, count: rows.length, debits: rows });
  });
});

// ===== RETURNS SYSTEM =====

// Create a return and issue refund
app.post('/return', (req, res) => {
  const { billId, customerId, itemId, quantityReturned, reason } = req.body;
  if (!billId || !itemId || !quantityReturned) {
    return res.status(400).send({ error: 'billId, itemId, quantityReturned required' });
  }

  // Fetch item to get price and current stock
  db.get('SELECT id, name, pricePerKg, quantity FROM items WHERE id = ?', [itemId], (err, item) => {
    if (err) return res.status(500).send({ error: err.message });
    if (!item) return res.status(404).send({ error: 'Item not found' });

    const qtyReturned = Number(quantityReturned);
    const refundAmount = Number((item.pricePerKg || 0) * qtyReturned).toFixed(2);

    // Insert return record
    db.run(
      'INSERT INTO returns (billId, customerId, itemId, quantityReturned, refundAmount, reason) VALUES (?, ?, ?, ?, ?, ?)',
      [billId, customerId || null, itemId, qtyReturned, refundAmount, reason || ''],
      function(err) {
        if (err) return res.status(500).send({ error: err.message });
        const returnId = this.lastID;

        // Increase item stock by returned quantity
        db.run('UPDATE items SET quantity = quantity + ? WHERE id = ?', [qtyReturned, itemId], (uErr) => {
          if (uErr) console.error('Failed to update stock on return', uErr.message);

          // Record refund (add to customer_refunds table)
          const refundReason = `Return of ${item.name} (Qty: ${qtyReturned})`;
          db.run(
            'INSERT INTO customer_refunds (customerId, refundAmount, reason, returnId) VALUES (?, ?, ?, ?)',
            [customerId || null, refundAmount, refundReason, returnId],
            (rErr) => {
              if (rErr) console.error('Failed to insert customer_refund', rErr.message);
              res.send({
                success: true,
                returnId,
                refundAmount: Number(refundAmount),
                itemName: item.name,
                quantityReturned: qtyReturned,
                newStock: Number(item.quantity) + qtyReturned
              });
            }
          );
        });
      }
    );
  });
});

// Get all returns
app.get('/returns', (req, res) => {
  db.all(
    `SELECT r.*, i.name as itemName, b.id as billId FROM returns r
     LEFT JOIN items i ON r.itemId = i.id
     LEFT JOIN bills b ON r.billId = b.id
     ORDER BY r.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      res.send({ success: true, returns: rows || [] });
    }
  );
});

// Get returns for a specific bill
app.get('/bill/:id/returns', (req, res) => {
  db.all(
    `SELECT r.*, i.name as itemName FROM returns r
     LEFT JOIN items i ON r.itemId = i.id
     WHERE r.billId = ?
     ORDER BY r.created_at DESC`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      res.send({ success: true, returns: rows || [] });
    }
  );
});

// Get refunds for a customer
app.get('/customer/:id/refunds', (req, res) => {
  db.all(
    'SELECT * FROM customer_refunds WHERE customerId = ? ORDER BY created_at DESC',
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      const total = (rows || []).reduce((s, r) => s + Number(r.refundAmount || 0), 0);
      res.send({ success: true, refunds: rows || [], totalRefunded: total });
    }
  );
});

// ===== ENHANCED RETURNS + EXCHANGE SYSTEM =====

// Get items from a bill
app.get('/bill-items/:billId', (req, res) => {
  db.get(
    `SELECT items_json FROM bills WHERE id = ?`,
    [req.params.billId],
    (err, bill) => {
      if (err) return res.status(500).send({ error: err.message });
      if (!bill) return res.status(404).send({ error: 'Bill not found' });

      try {
        const items = JSON.parse(bill.items_json || '[]');
        res.send({ success: true, billId: req.params.billId, items });
      } catch (e) {
        res.status(500).send({ error: 'Failed to parse bill items' });
      }
    }
  );
});

// Create a return (cash refund, exchange, or exchange with extra payment)
app.post('/return-item', (req, res) => {
  const { billId, productId, quantityReturned, refundType } = req.body;
  if (!billId || !productId || !quantityReturned || !refundType) {
    return res.status(400).send({ error: 'billId, productId, quantityReturned, refundType required' });
  }

  // Fetch product to get price
  db.get('SELECT id, name, pricePerKg, quantity FROM items WHERE id = ?', [productId], (err, product) => {
    if (err) return res.status(500).send({ error: err.message });
    if (!product) return res.status(404).send({ error: 'Product not found' });

    const qtyReturned = Number(quantityReturned);
    const refundAmount = Number((product.pricePerKg * qtyReturned).toFixed(2));
    const currentStock = Number(product.quantity);
    const newStock = currentStock + qtyReturned;

    // Insert return record
    db.run(
      `INSERT INTO customer_returns (billId, productId, quantityReturned, refundAmount, refundType) 
       VALUES (?, ?, ?, ?, ?)`,
      [billId, productId, qtyReturned, refundAmount, refundType],
      function(err) {
        if (err) return res.status(500).send({ error: err.message });
        const returnId = this.lastID;

        // Increase stock
        db.run('UPDATE items SET quantity = quantity + ? WHERE id = ?', [qtyReturned, productId], (uErr) => {
          if (uErr) console.error('Stock update failed', uErr.message);
          
          res.send({
            success: true,
            returnId,
            refundAmount,
            productName: product.name,
            quantityReturned: qtyReturned,
            newStock,
            refundType
          });
        });
      }
    );
  });
});

// Process an exchange (return + buy new items)
app.post('/exchange', (req, res) => {
  const { billId, returnProductId, quantityReturned, newBillItems, paymentMethod } = req.body;
  if (!billId || !returnProductId || !quantityReturned || !newBillItems) {
    return res.status(400).send({ error: 'Missing required exchange parameters' });
  }

  // Get product price for refund amount
  db.get('SELECT pricePerKg, quantity FROM items WHERE id = ?', [returnProductId], (err, product) => {
    if (err) return res.status(500).send({ error: err.message });
    if (!product) return res.status(404).send({ error: 'Product not found' });

    const qtyReturned = Number(quantityReturned);
    const refundBalance = Number((product.pricePerKg * qtyReturned).toFixed(2));

    // Calculate new bill total
    const newBillSubtotal = (newBillItems || []).reduce((sum, item) => {
      return sum + (Number(item.quantity) * Number(item.unitPrice));
    }, 0);

    const exchangeDifference = newBillSubtotal - refundBalance;
    const newStockQty = Number(product.quantity) + qtyReturned;

    // Case A: Even exchange
    if (exchangeDifference === 0) {
      // Create new bill with items, no payment needed
      const newBillData = {
        items: newBillItems,
        subtotal: newBillSubtotal,
        discount: 0,
        tax: 0,
        total: newBillSubtotal,
        paymentMethod: 'exchange',
        notes: `Exchange from bill #${billId}`
      };

      db.run(
        `INSERT INTO bills (subtotal, discount, tax, total, payment_method, items_json, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newBillData.subtotal, 0, 0, newBillSubtotal, 'exchange', JSON.stringify(newBillItems), newBillData.notes],
        function(err) {
          if (err) return res.status(500).send({ error: err.message });
          const newBillId = this.lastID;

          // Record return with adjustedBillId
          db.run(
            `INSERT INTO customer_returns (billId, productId, quantityReturned, refundAmount, refundType, adjustedBillId) 
             VALUES (?, ?, ?, ?, 'exchange', ?)`,
            [billId, returnProductId, qtyReturned, refundBalance, newBillId],
            (rErr) => {
              if (rErr) console.error('Failed to record return', rErr.message);

              // Update stock
              db.run('UPDATE items SET quantity = ? WHERE id = ?', [newStockQty, returnProductId], () => {
                // Update new bill items stock
                updateBillItemsStock(newBillItems, (stockErr) => {
                  res.send({
                    success: true,
                    exchangeType: 'even',
                    refundBalance,
                    newBillTotal: newBillSubtotal,
                    exchangeDifference: 0,
                    finalPayableAmount: 0,
                    newBillId
                  });
                });
              });
            }
          );
        }
      );
    } 
    // Case B: Customer needs to pay extra
    else if (exchangeDifference > 0) {
      const newBillData = {
        items: newBillItems,
        subtotal: newBillSubtotal,
        discount: 0,
        tax: 0,
        total: newBillSubtotal,
        paymentMethod: paymentMethod || 'cash',
        notes: `Exchange from bill #${billId}, extra paid`
      };

      db.run(
        `INSERT INTO bills (subtotal, discount, tax, total, payment_method, items_json, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newBillData.subtotal, 0, 0, newBillSubtotal, paymentMethod || 'cash', JSON.stringify(newBillItems), newBillData.notes],
        function(err) {
          if (err) return res.status(500).send({ error: err.message });
          const newBillId = this.lastID;

          db.run(
            `INSERT INTO customer_returns (billId, productId, quantityReturned, refundAmount, refundType, adjustedBillId) 
             VALUES (?, ?, ?, ?, 'exchange-extra', ?)`,
            [billId, returnProductId, qtyReturned, refundBalance, newBillId],
            (rErr) => {
              if (rErr) console.error('Failed to record return', rErr.message);

              db.run('UPDATE items SET quantity = ? WHERE id = ?', [newStockQty, returnProductId], () => {
                updateBillItemsStock(newBillItems, () => {
                  res.send({
                    success: true,
                    exchangeType: 'extra-payment',
                    refundBalance,
                    newBillTotal: newBillSubtotal,
                    exchangeDifference,
                    finalPayableAmount: exchangeDifference,
                    newBillId
                  });
                });
              });
            }
          );
        }
      );
    } 
    // Case C: Customer has leftover credit
    else {
      const leftoverCredit = Math.abs(exchangeDifference);
      const newBillData = {
        items: newBillItems,
        subtotal: newBillSubtotal,
        discount: 0,
        tax: 0,
        total: 0,
        paymentMethod: 'exchange',
        notes: `Exchange from bill #${billId}, credit remaining`
      };

      db.run(
        `INSERT INTO bills (subtotal, discount, tax, total, payment_method, items_json, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newBillData.subtotal, 0, 0, 0, 'exchange', JSON.stringify(newBillItems), newBillData.notes],
        function(err) {
          if (err) return res.status(500).send({ error: err.message });
          const newBillId = this.lastID;

          db.run(
            `INSERT INTO customer_returns (billId, productId, quantityReturned, refundAmount, refundType, adjustedBillId) 
             VALUES (?, ?, ?, ?, 'exchange', ?)`,
            [billId, returnProductId, qtyReturned, refundBalance, newBillId],
            (rErr) => {
              if (rErr) console.error('Failed to record return', rErr.message);

              db.run('UPDATE items SET quantity = ? WHERE id = ?', [newStockQty, returnProductId], () => {
                updateBillItemsStock(newBillItems, () => {
                  // Store leftover as credit (optional)
                  res.send({
                    success: true,
                    exchangeType: 'credit-remaining',
                    refundBalance,
                    newBillTotal: newBillSubtotal,
                    exchangeDifference,
                    finalPayableAmount: 0,
                    leftoverCredit,
                    newBillId
                  });
                });
              });
            }
          );
        }
      );
    }
  });
});

// Get all returns for a bill
app.get('/returns/:billId', (req, res) => {
  db.all(
    `SELECT cr.*, i.name as productName FROM customer_returns cr
     LEFT JOIN items i ON cr.productId = i.id
     WHERE cr.billId = ?
     ORDER BY cr.createdAt DESC`,
    [req.params.billId],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      res.send({ success: true, returns: rows || [] });
    }
  );
});

// Helper: update stock for multiple items
function updateBillItemsStock(items, callback) {
  if (!items || items.length === 0) return callback();
  
  let completed = 0;
  items.forEach(item => {
    db.run('UPDATE items SET quantity = quantity - ? WHERE id = ?', [item.quantity, item.itemId], () => {
      completed++;
      if (completed === items.length) callback();
    });
  });
}

// Global error handler (always return JSON, never HTML)
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack || err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start server
app.listen(3000, () => {
  console.log("🚀 Vendora server running on http://localhost:3000");
});
