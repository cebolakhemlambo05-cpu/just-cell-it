// Add this route to your existing server.js (near your other /api/* routes,
// alongside requireAuth). It saves the order + delivery details BEFORE the
// customer is sent to Yoco, so you have a real record for the courier no
// matter what happens on Yoco's page.
//
// Requires: crypto, db (already imported at the top of server.js)

app.post('/api/checkout', requireAuth, (req, res) => {
  const { productId, quantity, delivery } = req.body;
  const qty = Math.max(1, parseInt(quantity, 10) || 1);

  if (!delivery || !delivery.name || !delivery.phone || !delivery.email) {
    return res.status(400).json({ error: 'Delivery details are required.' });
  }
  if (delivery.method === 'address' && (!delivery.street || !delivery.suburb || !delivery.city || !delivery.province || !delivery.postalCode)) {
    return res.status(400).json({ error: 'Full delivery address is required.' });
  }
  if (delivery.method === 'pep' && (!delivery.pepStore || !delivery.pepSuburb)) {
    return res.status(400).json({ error: 'PEP store details are required.' });
  }

  const products = db.getProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  if (product.stock < qty) return res.status(400).json({ error: 'Not enough stock available.' });

  const amount = (product.price * qty).toFixed(2);
  const reference = `ORD-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

  const orders = db.getOrders();
  orders.push({
    reference,
    userId: req.userId,
    productId,
    quantity: qty,
    amount: Number(amount),
    status: 'pending',
    delivery, // { method, name, phone, email, street/suburb/city/province/postalCode/instructions OR pepStore/pepSuburb }
    createdAt: new Date().toISOString(),
  });
  db.saveOrders(orders);

  res.status(201).json({ reference, amount });
});

// NOTE ON STOCK & "PAID" STATUS:
// This endpoint only marks the order 'pending' — it does not deduct stock or
// mark it 'paid', because your current Yoco integration is a simple Payment
// Page redirect that doesn't call your server back. That means anyone who
// abandons the Yoco page still leaves a 'pending' order sitting in your
// admin panel, and a real payment doesn't get confirmed automatically.
//
// To close that gap (recommended before going live with real orders), you'd
// need Yoco's webhook/API integration — similar to how the Ozow webhook in
// this file verifies payment and flips status to 'paid'. Worth doing before
// you rely on this for real customer deliveries, since right now nothing
// confirms an order actually got paid before your courier ships it.
