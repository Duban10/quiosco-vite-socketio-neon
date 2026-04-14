import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import prisma from './src/lib/prisma.ts';

const app = express();
app.use(cors({
    origin: [
        'http://localhost:5173',  // desarrollo local
        'https://quiosco-vite-socketio-neon.vercel.app/'  // producción — pon tu URL real
    ],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            'http://localhost:5173',
            'https://quiosco-vite-socketio-neon.vercel.app/'
        ],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

const getProductsSnapshot = () => prisma.product.findMany({
    orderBy: { name: 'asc' }
});

const emitProductsUpdate = async () => {
    try {
        io.emit('productsUpdated', await getProductsSnapshot());
    } catch (error) {
        console.error('Error broadcasting products update:', error);
    }
};

const buildCartQuantityMap = (cart = []) => {
    const quantities = new Map();

    for (const item of cart) {
        const productId = item.product?.id ?? item.productId;
        if (!productId) continue;

        const currentQty = quantities.get(productId) || 0;
        quantities.set(productId, currentQty + item.qty);
    }

    return quantities;
};

const validateOrderCart = (cart) => {
    if (!Array.isArray(cart) || cart.length === 0) {
        throw new Error('El carrito de la orden está vacío o inválido.');
    }

    return cart.map((item, index) => {
        if (!item || typeof item !== 'object') {
            throw new Error(`El artículo ${index + 1} del carrito no es válido.`);
        }

        const productId = Number(item.product?.id ?? item.productId);
        if (!Number.isInteger(productId) || productId <= 0) {
            throw new Error(`El ID del producto en la posición ${index + 1} no es válido.`);
        }

        const qty = Number(item.qty);
        if (!Number.isInteger(qty) || qty <= 0) {
            throw new Error(`La cantidad para el producto en la posición ${index + 1} debe ser mayor a 0.`);
        }

        const price = Number(item.product?.price ?? item.price);
        if (Number.isNaN(price) || price < 0) {
            throw new Error(`El precio del producto en la posición ${index + 1} no es válido.`);
        }

        return {
            productId,
            qty,
            price,
            name: item.product?.name || item.name || `Producto #${productId}`
        };
    });
};

const buildOrderProductsQuantityMap = (orderProducts = []) => {
    const quantities = new Map();

    for (const item of orderProducts) {
        const currentQty = quantities.get(item.productId) || 0;
        quantities.set(item.productId, currentQty + item.quantity);
    }

    return quantities;
};

const adjustProductStocks = async (tx, previousQuantities, nextQuantities) => {
    const productIds = [...new Set([
        ...previousQuantities.keys(),
        ...nextQuantities.keys()
    ])];

    if (productIds.length === 0) {
        return;
    }

    const products = await tx.product.findMany({
        where: { id: { in: productIds } }
    });
    const productsById = new Map(products.map((product) => [product.id, product]));

    for (const productId of productIds) {
        const product = productsById.get(productId);
        if (!product) {
            throw new Error('Uno de los productos ya no existe.');
        }

        const previousQty = previousQuantities.get(productId) || 0;
        const nextQty = nextQuantities.get(productId) || 0;
        const delta = nextQty - previousQty;

        if (delta > 0 && product.stock < delta) {
            throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}.`);
        }
    }

    for (const productId of productIds) {
        const previousQty = previousQuantities.get(productId) || 0;
        const nextQty = nextQuantities.get(productId) || 0;
        const delta = nextQty - previousQty;

        if (delta > 0) {
            await tx.product.update({
                where: { id: productId },
                data: { stock: { decrement: delta } }
            });
        } else if (delta < 0) {
            await tx.product.update({
                where: { id: productId },
                data: { stock: { increment: Math.abs(delta) } }
            });
        }
    }
};

const formatOrder = (prismaOrder) => {
    let currentStatus = 'pending';
    if (prismaOrder.orderReadyAt) currentStatus = 'ready';
    if (prismaOrder.status) currentStatus = 'completed';
    if (prismaOrder.cancelled) currentStatus = 'cancelled';

    return {
        id: prismaOrder.id,
        table: prismaOrder.table?.name || 'Mesa Desconocida',
        tableId: prismaOrder.tableId, // Añadir tableId aquí
        observations: prismaOrder.observations || "",
        total: prismaOrder.total || 0,
        status: currentStatus,
        time: prismaOrder.date.toLocaleString('es-CO', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: true
        }),
        date: prismaOrder.date.toISOString(),
        waiter: prismaOrder.user ? prismaOrder.user.username : null,
        cart: (prismaOrder.orderProducts || []).map(item => ({
            qty: item.quantity,
            product: {
                id: item.productId,
                name: item.product?.name || 'Producto Desconocido',
                price: item.product?.price || 0
            }
        }))
    };
};

io.on('connection', async (socket) => {
    console.log('Cliente conectado:', socket.id);

    const sendInitialData = async () => {
        try {
            const prismaOrders = await prisma.order.findMany({
                include: { orderProducts: { include: { product: true } }, user: true, table: true },
                orderBy: { id: 'asc' }
            });
            const mappedOrders = prismaOrders.map(formatOrder);
            socket.emit('initialData', mappedOrders);
        } catch (error) {
            console.error('Error fetch initial data:', error);
        }
    };

    sendInitialData();

    socket.on('requestInitialData', sendInitialData);

    socket.on('newOrder', async (orderData, callback) => {
        try {
            const validatedCart = validateOrderCart(orderData.cart);
            const tableId = Number(orderData.tableId);
            if (!Number.isInteger(tableId) || tableId <= 0) {
                throw new Error('La mesa seleccionada no es válida.');
            }

            const userId = orderData.userId ? Number(orderData.userId) : null;
            const cartTotal = validatedCart.reduce((sum, item) => sum + (item.price * item.qty), 0);

            const createdOrder = await prisma.$transaction(async (tx) => {
                const selectedTable = await tx.table.findUnique({ where: { id: tableId } });
                if (!selectedTable) {
                    throw new Error('La mesa seleccionada no existe.');
                }

                if (userId !== null) {
                    const existingUser = await tx.user.findUnique({ where: { id: userId } });
                    if (!existingUser) {
                        throw new Error('El usuario autenticado no existe.');
                    }
                }

                await adjustProductStocks(tx, new Map(), buildCartQuantityMap(validatedCart));

                return tx.order.create({
                    data: {
                        tableId,
                        observations: orderData.observations || '',
                        total: cartTotal,
                        status: false,
                        userId: userId || null,
                        orderProducts: {
                            create: validatedCart.map(item => ({
                                productId: item.productId,
                                quantity: item.qty
                            }))
                        }
                    },
                    include: { orderProducts: { include: { product: true } }, user: true, table: true }
                });
            });

            console.log('Nueva orden BDD:', createdOrder.id);

            const newOrderFormatted = formatOrder(createdOrder);
            io.emit('orderAdded', newOrderFormatted);
            await emitProductsUpdate();
            callback?.({ success: true });
        } catch (error) {
            console.error("Error creating order:", error, { orderData });
            callback?.({ success: false, message: error instanceof Error ? error.message : 'No se pudo crear la orden.' });
        }
    });

    socket.on('readyOrder', async (orderId) => {
        try {
            console.log('Orden lista BDD:', orderId);
            const updatedOrder = await prisma.order.update({
                where: { id: orderId },
                data: { orderReadyAt: new Date() },
                include: { orderProducts: { include: { product: true } }, user: true, table: true }
            });
            io.emit('orderCompleted', formatOrder(updatedOrder));
        } catch (error) {
            console.error("Error marking ready order:", error);
        }
    });

    socket.on('completeOrder', async (orderId) => {
        try {
            console.log('Orden completada (cobrada) BDD:', orderId);
            const updatedOrder = await prisma.order.update({
                where: { id: orderId },
                data: { status: true },
                include: { orderProducts: { include: { product: true } }, user: true, table: true }
            });

            const updatedOrderFormatted = formatOrder(updatedOrder);
            io.emit('orderCompleted', updatedOrderFormatted);
        } catch (error) {
            console.error("Error completing order:", error);
        }
    });

    socket.on('cancelOrder', async (orderId, callback) => {
        try {
            console.log('Orden cancelada BDD:', orderId);

            const updatedOrder = await prisma.$transaction(async (tx) => {
                const existingOrder = await tx.order.findUnique({
                    where: { id: orderId },
                    include: { orderProducts: true }
                });

                if (!existingOrder) {
                    throw new Error('La orden no existe.');
                }

                if (existingOrder.cancelled) {
                    throw new Error('La orden ya fue cancelada.');
                }

                if (existingOrder.status) {
                    throw new Error('No se puede cancelar una orden ya cobrada.');
                }

                await adjustProductStocks(tx, buildOrderProductsQuantityMap(existingOrder.orderProducts), new Map());

                return tx.order.update({
                    where: { id: orderId },
                    data: { cancelled: true },
                    include: { orderProducts: { include: { product: true } }, user: true, table: true }
                });
            });

            io.emit('orderCompleted', formatOrder(updatedOrder));
            await emitProductsUpdate();
            callback?.({ success: true });
        } catch (error) {
            console.error("Error canceling order:", error);
            callback?.({ success: false, message: error instanceof Error ? error.message : 'No se pudo cancelar la orden.' });
        }
    });

    socket.on('updateOrder', async (orderData, callback) => {
        try {
            const { id, tableId, cart, observations } = orderData;
            const validatedCart = validateOrderCart(cart);
            const normalizedTableId = Number(tableId);
            if (!Number.isInteger(normalizedTableId) || normalizedTableId <= 0) {
                throw new Error('La mesa seleccionada no es válida.');
            }

            const cartTotal = validatedCart.reduce((sum, item) => sum + (item.price * item.qty), 0);

            const updatedOrder = await prisma.$transaction(async (tx) => {
                const existingOrder = await tx.order.findUnique({
                    where: { id },
                    include: { orderProducts: true }
                });

                if (!existingOrder) {
                    throw new Error('La orden no existe.');
                }

                if (existingOrder.orderReadyAt || existingOrder.status || existingOrder.cancelled) {
                    throw new Error('Solo se pueden editar órdenes pendientes.');
                }

                const selectedTable = await tx.table.findUnique({ where: { id: normalizedTableId } });
                if (!selectedTable) {
                    throw new Error('La mesa seleccionada no existe.');
                }

                await adjustProductStocks(
                    tx,
                    buildOrderProductsQuantityMap(existingOrder.orderProducts),
                    buildCartQuantityMap(validatedCart)
                );

                await tx.orderProducts.deleteMany({
                    where: { orderId: id }
                });

                return tx.order.update({
                    where: { id },
                    data: {
                        tableId: normalizedTableId,
                        observations: observations || '',
                        total: cartTotal,
                        orderProducts: {
                            create: validatedCart.map(item => ({
                                productId: item.productId,
                                quantity: item.qty
                            }))
                        }
                    },
                    include: { orderProducts: { include: { product: true } }, user: true, table: true }
                });
            });

            console.log('Orden actualizada BDD:', updatedOrder.id);

            const updatedOrderFormatted = formatOrder(updatedOrder);
            io.emit('orderUpdated', updatedOrderFormatted);
            await emitProductsUpdate();
            callback?.({ success: true });
        } catch (error) {
            console.error("Error updating order:", error, { orderData });
            callback?.({ success: false, message: error instanceof Error ? error.message : 'No se pudo actualizar la orden.' });
        }
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

// Endpoint GET /orders para el Dashboard
app.get('/orders', async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            include: { orderProducts: { include: { product: true } }, table: true },
            orderBy: { date: 'desc' }
        });
        res.json(orders);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await prisma.user.findUnique({ where: { username } });
        if (user && user.password === password) {
            res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (e) {
        res.status(500).json({ error: 'Internal Error' });
    }
});

// Endpoints para la gestión de mesas
app.get('/api/tables', async (req, res) => {
    try {
        const tables = await prisma.table.findMany();
        res.json(tables);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

app.post('/api/tables', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Table name is required.' });
        }
        const newTable = await prisma.table.create({
            data: { name }
        });
        res.status(201).json(newTable);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

app.put('/api/tables/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Table name is required.' });
        }
        const updatedTable = await prisma.table.update({
            where: { id },
            data: { name }
        });
        res.json(updatedTable);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

app.delete('/api/tables/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await prisma.table.delete({ where: { id } });
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

app.get('/api/categories', async (req, res) => {
    try {
        const categories = await prisma.category.findMany();
        res.json(categories);
    } catch (e) {
        res.status(500).json({ error: 'Internal Error' });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const products = await getProductsSnapshot();
        res.json(products);
    } catch (e) {
        res.status(500).json({ error: 'Internal Error' });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const { name, price, image, categoryId, stock } = req.body;
        if (!name || !price || !categoryId || stock === undefined) {
            return res.status(400).json({ error: 'name, price, stock y categoryId son requeridos' });
        }

        const parsedStock = parseInt(stock);
        if (Number.isNaN(parsedStock) || parsedStock < 0) {
            return res.status(400).json({ error: 'El stock debe ser un numero mayor o igual a 0.' });
        }

        const p = await prisma.product.create({
            data: {
                name: name.trim(),
                price: parseFloat(price),
                image: image?.trim() || '',
                stock: parsedStock,
                categoryId: parseInt(categoryId)
            }
        });
        await emitProductsUpdate();
        res.status(201).json(p);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, price, image, stock } = req.body;
        const parsedStock = parseInt(stock);
        if (Number.isNaN(parsedStock) || parsedStock < 0) {
            return res.status(400).json({ error: 'El stock debe ser un numero mayor o igual a 0.' });
        }
        const p = await prisma.product.update({
            where: { id },
            data: { name, price: parseFloat(price), image, stock: parsedStock }
        });
        await emitProductsUpdate();
        res.json(p);
    } catch (e) {
        res.status(500).json({ error: 'Internal Error' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await prisma.product.delete({ where: { id } });
        await emitProductsUpdate();
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'Internal Error' });
    }
});

// ===== BASE DE CAJA DIARIA =====

// Obtener base de caja de una fecha (YYYY-MM-DD) o todas
app.get('/api/daily-cash', async (req, res) => {
    try {
        const { date } = req.query;
        if (date) {
            // Registro de un día específico
            const record = await prisma.dailyCash.findUnique({
                where: { date: date as string }
            });
            // Si no existe ese día devolvemos amount=0 para que el frontend lo muestre como vacío
            return res.json(record ?? { date, amount: 0, id: null });
        }
        // Todos los registros ordenados desc → histórico
        const records = await prisma.dailyCash.findMany({
            orderBy: { date: 'desc' }
        });
        res.json(records);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

// Crear o actualizar base de caja SOLO para hoy
app.put('/api/daily-cash', async (req, res) => {
    try {
        const { amount } = req.body;
        // Fecha de hoy en zona local del servidor (YYYY-MM-DD)
        const today = new Date().toLocaleDateString('en-CA'); // 'en-CA' produce YYYY-MM-DD
        const { date } = req.query as { date?: string };

        // Solo se puede escribir el día de hoy
        if (date && date !== today) {
            return res.status(403).json({ error: 'Solo se puede modificar la base de caja del día actual.' });
        }

        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed < 0) {
            return res.status(400).json({ error: 'El monto debe ser un número válido mayor o igual a 0.' });
        }

        const record = await prisma.dailyCash.upsert({
            where: { date: today },
            update: { amount: parsed },
            create: { date: today, amount: parsed }
        });
        res.json(record);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

// Endpoints para AppConfig (logo)
app.get('/api/app-config', async (req, res) => {
    try {
        let config = await prisma.appConfig.findFirst();
        if (!config) {
            config = await prisma.appConfig.create({
                data: {
                    logoUrl: null,
                    companyName: null,
                    startingCash: 0
                }
            });
        }
        res.json(config);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

app.put('/api/app-config', async (req, res) => {
    try {
        const { logoUrl, companyName, startingCash } = req.body;
        const rawStartingCash = typeof startingCash === 'string'
            ? startingCash.trim().replace(',', '.')
            : startingCash;
        const parsedStartingCash = rawStartingCash !== undefined && rawStartingCash !== null && rawStartingCash !== ''
            ? Number(rawStartingCash)
            : null;

        if (parsedStartingCash !== null && (Number.isNaN(parsedStartingCash) || parsedStartingCash < 0)) {
            return res.status(400).json({ error: 'El valor de la base de caja debe ser un número válido mayor o igual a 0.' });
        }

        let config = await prisma.appConfig.findFirst();
        if (!config) {
            config = await prisma.appConfig.create({
                data: {
                    logoUrl,
                    companyName: companyName?.trim() || null,
                    startingCash: parsedStartingCash
                }
            });
        } else {
            config = await prisma.appConfig.update({
                where: { id: config.id },
                data: {
                    logoUrl,
                    companyName: companyName?.trim() || null,
                    startingCash: parsedStartingCash
                }
            });
        }
        res.json(config);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

// Endpoints para la gestión de usuarios (meseros)
app.get('/api/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, username: true, role: true } // No enviar contraseñas
        });
        res.json(users);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

app.post('/api/users', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (!username || !password || !role) {
            return res.status(400).json({ error: 'Username, password, and role are required.' });
        }
        if (role === 'ADMIN') { // Prevenir la creación de admins a través de este endpoint
            return res.status(403).json({ error: 'Cannot create ADMIN users through this endpoint.' });
        }
        const newUser = await prisma.user.create({
            data: { username, password, role }
        });
        res.status(201).json({ id: newUser.id, username: newUser.username, role: newUser.role });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

app.put('/api/users/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { username, password, role } = req.body;
        if (role === 'ADMIN') { // Prevenir la asignación de rol admin a través de este endpoint
            return res.status(403).json({ error: 'Cannot assign ADMIN role through this endpoint.' });
        }
        const updatedUser = await prisma.user.update({
            where: { id },
            data: { username, password, role }
        });
        res.json({ id: updatedUser.id, username: updatedUser.username, role: updatedUser.role });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await prisma.user.delete({ where: { id } });
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

// ===== GASTOS =====
app.get('/api/expenses', async (req, res) => {
    try {
        const { from, to } = req.query;
        const where: any = {};
        if (from || to) {
            where.date = {};
            if (from) where.date.gte = new Date(from as string);
            if (to)   where.date.lte = new Date(to as string + 'T23:59:59');
        }
        const expenses = await prisma.expense.findMany({
            where,
            include: { user: { select: { username: true } } },
            orderBy: { date: 'desc' }
        });
        res.json(expenses);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

app.post('/api/expenses', async (req, res) => {
    try {
        console.log('POST /api/expenses body:', JSON.stringify(req.body));
        const { amount, description, category, date, userId } = req.body;
        const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
        if (!description || typeof description !== 'string' || !description.trim()) {
            return res.status(400).json({ error: 'description es requerido' });
        }
        if (!parsedAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'amount debe ser un número válido mayor que 0' });
        }
        const parsedDate = date ? new Date(date) : new Date();
        if (date && Number.isNaN(parsedDate.getTime())) {
            return res.status(400).json({ error: 'date debe ser una fecha válida' });
        }
        let parsedUserId = userId != null && userId !== '' ? Number(userId) : null;
        if (parsedUserId != null) {
            if (Number.isNaN(parsedUserId) || parsedUserId <= 0) {
                return res.status(400).json({ error: 'userId debe ser un entero positivo o null' });
            }
            const existingUser = await prisma.user.findUnique({ where: { id: parsedUserId } });
            if (!existingUser) {
                console.warn(`userId ${parsedUserId} no existe, creando gasto sin usuario asociado.`);
                parsedUserId = null;
            }
        }
        const expense = await prisma.expense.create({
            data: {
                amount: parsedAmount,
                description: description.trim(),
                category: category?.trim() || 'General',
                date: parsedDate,
                userId: parsedUserId
            },
            include: { user: { select: { username: true } } }
        });
        res.status(201).json(expense);
    } catch (e) {
        console.error('POST /api/expenses error:', e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

app.put('/api/expenses/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { amount, description, category, date } = req.body;
        const expense = await prisma.expense.update({
            where: { id },
            data: {
                amount: parseFloat(amount),
                description: description.trim(),
                category: category?.trim() || 'General',
                date: date ? new Date(date) : undefined
            },
            include: { user: { select: { username: true } } }
        });
        res.json(expense);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

app.delete('/api/expenses/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await prisma.expense.delete({ where: { id } });
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

const startPort = parseInt(process.env.PORT || '3001');
let attemptPort = startPort;
const maxAttempts = 10;

const tryListen = (port, attempt = 1) => {
    server.listen(port, () => {
        console.log(`Servidor WebSocket conectado a Prisma en http://localhost:${port}`);
    });

    server.once('error', (error) => {
        if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE' && attempt < maxAttempts) {
            console.warn(`Puerto ${port} en uso, intentando puerto ${port + 1}...`);
            server.removeAllListeners('error');
            server.removeAllListeners('listening');
            tryListen(port + 1, attempt + 1);
        } else if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
            console.error(`No hay puertos disponibles. Máximo de intentos alcanzado (${maxAttempts}).`);
            process.exit(1);
        } else {
            console.error('Error en el servidor HTTP:', error);
            process.exit(1);
        }
    });
};

tryListen(startPort);
