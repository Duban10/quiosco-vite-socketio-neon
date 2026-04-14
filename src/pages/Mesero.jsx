import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Plus, Minus, Trash2, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { LogOut } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { clearStoredUser, getStoredUser } from '../utils/session';
import { getStockConfig } from '../utils/stock';
import { formatCurrency } from '../utils/currency';
import styles from '../styles/Mesero.module.css';
import SearchBar from '../components/SearchBar';

import { SERVER_URL, API_BASE, WS_URL } from '../config/server.js';

export default function Mesero() {
    const [orders, setOrders] = useState([]);
    const [table, setTable] = useState('');
    const [observations, setObservations] = useState('');
    const [cart, setCart] = useState([]);
    const [notification, setNotification] = useState(null);
    const [orderToast, setOrderToast] = useState(null); // toast de confirmación de pedido creado/actualizado
    const [products, setProducts] = useState([]);
    const [tables, setTables] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const tablesRef = useRef(tables); // Usar useRef para las mesas
    const socketRef = useRef(null);
    const [editingOrderId, setEditingOrderId] = useState(null);
    const [editingBaseQuantities, setEditingBaseQuantities] = useState({});
    const navigate = useNavigate();

    // Actualizar la referencia cada vez que 'tables' cambie
    useEffect(() => {
        tablesRef.current = tables;
    }, [tables]);

    useEffect(() => {
        // Cargar productos y mesas una sola vez al montar el componente
        fetch(`${API_BASE}/products`).then(res => res.json()).then(setProducts);
        fetch(`${API_BASE}/tables`).then(res => res.json()).then(setTables);

        const socket = io(WS_URL);
        socketRef.current = socket;

        const handleInitialData = (data) => setOrders(data);
        const handleOrderAdded = (newOrder) => {
            setOrders(prev => prev.find(o => o.id === newOrder.id) ? prev : [...prev, newOrder]);
        };
        const handleOrderCompleted = (completedOrder) => {
            // Usar tablesRef.current para acceder a la versión más reciente de tables
            const tableName = tablesRef.current.find(t => t.id === completedOrder.tableId)?.name || completedOrder.table;
            setOrders(prev => prev.map(o => o.id === completedOrder.id ? completedOrder : o));
            setNotification(`¡La orden de la Mesa ${tableName} está lista!`);
            setTimeout(() => setNotification(null), 5000);
        };
        const handleOrderUpdated = (updatedOrder) => {
            setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
            setNotification(`¡La orden de la Mesa ${updatedOrder.table} ha sido actualizada!`);
            setTimeout(() => setNotification(null), 5000);
        };
        const handleProductsUpdated = (updatedProducts) => {
            setProducts(updatedProducts);
        };

        socket.on('initialData', handleInitialData);
        socket.on('orderAdded', handleOrderAdded);
        socket.on('orderCompleted', handleOrderCompleted);
        socket.on('orderUpdated', handleOrderUpdated);
        socket.on('productsUpdated', handleProductsUpdated);
        socket.emit('requestInitialData');

        return () => {
            socket.off('initialData', handleInitialData);
            socket.off('orderAdded', handleOrderAdded);
            socket.off('orderCompleted', handleOrderCompleted);
            socket.off('orderUpdated', handleOrderUpdated);
            socket.off('productsUpdated', handleProductsUpdated);
            socket.disconnect();
            socketRef.current = null;
        };
    }, []); // Dependencias vacías para que se ejecute solo una vez

    const getCartQty = (productId) => cart.find(item => item.product.id === productId)?.qty || 0;
    const getEditingBaseQty = (productId) => editingBaseQuantities[productId] || 0;
    const getAvailableStock = (productId) => {
        const product = products.find(item => item.id === productId);
        if (!product) return 0;
        return product.stock + getEditingBaseQty(productId) - getCartQty(productId);
    };

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(productSearch.toLowerCase())
    );

    const addToCart = (product) => {
        if (getAvailableStock(product.id) <= 0) {
            alert(`No hay stock disponible para ${product.name}.`);
            return;
        }

        setCart(prev => {
            const exists = prev.find(item => item.product.id === product.id);
            if (exists) {
                return prev.map(item => item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item);
            }
            return [...prev, { product, qty: 1 }];
        });
    };

    const updateQty = (productId, delta) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.product.id === productId) {
                    const newQty = item.qty + delta;
                    if (delta > 0 && getAvailableStock(productId) <= 0) return item;
                    if (newQty < 0) return item; // limit to 0
                    return { ...item, qty: newQty };
                }
                return item;
            }).filter(item => item.qty > 0); // removes if drops to 0
        });
    };

    const cartTotal = cart.reduce((acc, item) => acc + (item.product.price * item.qty), 0);

    // Mesas ocupadas: tienen orden activa (pending o ready) que no sea la que estamos editando
    const occupiedTableIds = new Set(
        orders
            .filter(o => (o.status === 'pending' || o.status === 'ready') && o.id !== editingOrderId)
            .map(o => o.tableId)
            .filter(Boolean)
    );

    const emitOrderEvent = (eventName, payload) => new Promise((resolve) => {
        if (!socketRef.current) {
            resolve({ success: false, message: 'No hay conexión con el servidor.' });
            return;
        }

        socketRef.current.emit(eventName, payload, (response) => {
            resolve(response || { success: true });
        });
    });

    const submitOrder = async () => {
        if (!table || cart.length === 0) {
            alert("Por favor, selecciona una mesa y agrega al menos un producto.");
            return;
        }

        const user = getStoredUser();
        const orderData = {
            tableId: parseInt(table),
            cart,
            observations,
            userId: user?.id || null
        };

        let response;
        if (editingOrderId) {
            console.log('Emitting updateOrder event with:', { id: editingOrderId, ...orderData });
            response = await emitOrderEvent('updateOrder', { id: editingOrderId, ...orderData });
        } else {
            console.log('Emitting newOrder event with:', orderData);
            response = await emitOrderEvent('newOrder', orderData);
        }

        if (!response?.success) {
            alert(response?.message || 'No se pudo procesar el pedido.');
            return;
        }

        // Reset form
        const wasEditing = !!editingOrderId;
        const tableName = tables.find(t => t.id === parseInt(table))?.name || `Mesa ${table}`;
        setTable('');
        setObservations('');
        setCart([]);
        setEditingOrderId(null);
        setEditingBaseQuantities({});

        // Toast de confirmación
        setOrderToast({
            title: wasEditing ? '¡Pedido actualizado!' : '¡Pedido enviado!',
            message: wasEditing
                ? `El pedido de ${tableName} fue actualizado en cocina.`
                : `El pedido de ${tableName} fue enviado a cocina correctamente.`,
            type: wasEditing ? 'update' : 'success'
        });
        setTimeout(() => setOrderToast(null), 4000);
    };

    const editOrder = (orderToEdit) => {
        // Solo permitir edición si la orden está pendiente
        if (orderToEdit.status !== 'pending') {
            alert('Solo se pueden editar órdenes pendientes.');
            return;
        }

        setEditingOrderId(orderToEdit.id);
        setTable(orderToEdit.tableId.toString()); // Asumiendo que tableId es un número
        setObservations(orderToEdit.observations);
        setEditingBaseQuantities(orderToEdit.cart.reduce((acc, item) => {
            acc[item.product.id] = item.qty;
            return acc;
        }, {}));
        setCart(orderToEdit.cart.map(item => ({
            qty: item.qty,
            product: {
                id: item.product.id,
                name: item.product.name,
                price: item.product.price
            }
        })));
    };

    const cancelEditing = () => {
        setEditingOrderId(null);
        setTable('');
        setObservations('');
        setCart([]);
        setEditingBaseQuantities({});
    };

    return (
        <div className={styles.container}>
            <div className={styles.navHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 className={styles.h2NoMargin}>Vista de Mesero</h2>
                </div>
                <button className={`${styles.btn} ${styles.btnSm} ${styles.btnLogout}`} onClick={() => { clearStoredUser(); navigate('/'); }}>
                    <LogOut size={16} /> Cerrar Sesión
                </button>
            </div>

            <div className={styles.grid}>
                {/* Lado de Productos */}
                <div>
                    <div className={styles.productsHeader}>
                        <h3 className={styles.h3MarginBottom}>Menú de Productos</h3>
                        <SearchBar
                            value={productSearch}
                            onChange={e => setProductSearch(e.target.value)}
                            placeholder="Buscar producto..."
                        />
                    </div>
                    <div className="product-grid">
                        {filteredProducts.length === 0 ? (
                            <div className={`${styles.glassPanel} ${styles.emptyState}`}>
                                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No se encontraron productos para esa búsqueda.</p>
                            </div>
                        ) : filteredProducts.map(product => {
                            const stockConfig = getStockConfig(product.stock);
                            const availableStock = getAvailableStock(product.id);

                            return (
                            <div key={product.id} className={`${styles.productCard} ${product.stock <= 0 ? styles.disabled : ''}`}>
                                <img src={product.image} alt={product.name} className="product-image" />
                                <div className="product-info">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                        <div className="product-name">{product.name}</div>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: stockConfig.color, background: stockConfig.background, border: stockConfig.border, padding: '0.15rem 0.5rem', borderRadius: '9999px', whiteSpace: 'nowrap' }}>
                                            {stockConfig.shortLabel}
                                        </span>
                                    </div>
                                    <div className="product-price">{formatCurrency(product.price)}</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.6rem' }}>
                                        Stock disponible: {Math.max(availableStock, 0)}
                                    </div>
                                    <button
                                        onClick={() => addToCart(product)}
                                        className={`${styles.btn} ${styles.btnSm} ${styles.btnAdd}`}
                                        style={{ marginTop: 'auto' }}
                                        disabled={availableStock <= 0}
                                    >
                                        <Plus size={16} /> {availableStock <= 0 ? 'Sin stock' : 'Agregar'}
                                    </button>
                                </div>
                            </div>
                        )})}
                    </div>

                    {/* Seccion de ordenes activas / estado del mesero */}
                    <div className={`${styles.glassPanel} ${styles.marginTop2}`}>
                        <h3>Estado de mis pedidos</h3>
                        <div className={`grid ${styles.ordersList}`}>
                            {orders.length === 0 ? (
                                <p style={{ color: 'var(--text-secondary)' }}>No hay pedidos activos.</p>
                            ) : (
                                [...orders].reverse().map(order => (
                                    <div key={order.id} className={`order-card glass-panel ${order.status}`} style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                            <h4 style={{ fontWeight: 600 }}>{order.table}</h4>
                                            <span className={`badge ${order.status}`}>
                                                 {order.status === 'ready' ? 'Lista para Recoger' : order.status === 'completed' ? 'Cobrada' : order.status === 'cancelled' ? 'Cancelada' : 'Preparando...'}
                                             </span>
                                             {order.status === 'pending' && (
                                                 <button onClick={() => editOrder(order)} className="btn btn-sm" style={{ marginLeft: '0.5rem', background: 'rgba(59,130,246,0.15)', color: 'var(--accent-primary)' }}>
                                                     Editar
                                                 </button>
                                             )}
                                         </div>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                            {order.cart?.map(c => `${c.qty}x ${c.product.name}`).join(', ')}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Lado del Pedido Actual */}
                <div className={`${styles.glassPanel} ${styles.stickyPanel}`}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ShoppingCart size={20} /> Pedido Actual
                    </h3>

                    <div style={{ marginTop: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Mesa *</label>
                        <select
                            value={table}
                            onChange={(e) => setTable(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '1rem', marginBottom: 0 }}
                        >
                            <option value="">Selecciona una mesa</option>
                            {tables.map(t => {
                                const occupied = occupiedTableIds.has(t.id);
                                return (
                                    <option key={t.id} value={t.id} disabled={occupied} style={{ color: occupied ? '#ef4444' : 'var(--text-primary)' }}>
                                        {t.name}{occupied ? ' — Ocupada' : ''}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div style={{ margin: '1.5rem 0', minHeight: '200px', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                        {cart.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>
                                <ShoppingCart size={40} style={{ opacity: 0.2, margin: '0 auto 1rem auto' }} />
                                <p>No hay productos en el pedido</p>
                            </div>
                        ) : (
                            cart.map((item) => (
                                <div key={item.product.id} className="cart-item">
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500 }}>{item.product.name}</div>
                                        <div style={{ color: 'var(--accent-primary)', fontSize: '0.9rem' }}>{formatCurrency(item.product.price * item.qty)}</div>
                                    </div>

                                    <div className="cart-qty-controls">
                                        <button onClick={() => updateQty(item.product.id, -1)} className="qty-btn" title="Disminuir / Eliminar">
                                            {item.qty === 1 ? <Trash2 size={14} color="#ef4444" /> : <Minus size={14} />}
                                        </button>
                                        <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 'bold' }}>{item.qty}</span>
                                        <button onClick={() => updateQty(item.product.id, 1)} className="qty-btn" title="Aumentar">
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Observaciones del Pedido</label>
                        <textarea
                            value={observations}
                            onChange={(e) => setObservations(e.target.value)}
                            placeholder="Ej. Hamburguesa sin cebolla, Pizza con extra queso..."
                        ></textarea>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem', marginTop: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                            <span>Total:</span>
                            <span style={{ color: 'var(--success)' }}>{formatCurrency(cartTotal)}</span>
                        </div>

                        {/* Mensaje de validación */}
                        {(!table.trim() || cart.length === 0) && (
                            <div className={styles.validationMessage}>
                                {!table.trim() && cart.length === 0 && "Selecciona una mesa y agrega al menos un producto"}
                                {!table.trim() && cart.length > 0 && "Selecciona una mesa para continuar"}
                                {table.trim() && cart.length === 0 && "Agrega al menos un producto al pedido"}
                            </div>
                        )}

                        <button
                            onClick={submitOrder}
                            className="btn btn-success"
                            style={{ width: '100%', fontSize: '1.1rem', padding: '1rem' }}
                            disabled={cart.length === 0 || !table.trim()}
                        >
                            {editingOrderId ? 'Actualizar Pedido' : 'Finalizar Pedido'}
                        </button>
                        {editingOrderId && (
                            <button
                                onClick={cancelEditing}
                                className="btn"
                                style={{ width: '100%', fontSize: '1.1rem', padding: '1rem', marginTop: '1rem', background: 'rgba(255,255,255,0.07)' }}
                            >
                                Cancelar Edición
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Toast: pedido listo (desde cocina) */}
            {notification && (
                <div className="notification-toast">
                    <Bell color="var(--success)" />
                    <div>
                        <h4 style={{ color: 'var(--success)', fontWeight: 600 }}>¡Pedido Listo!</h4>
                        <p>{notification}</p>
                    </div>
                </div>
            )}

            {/* Toast: confirmación de creación/actualización de pedido */}
            {orderToast && (
                <div className="notification-toast" style={{
                    bottom: notification ? '6rem' : '2rem',
                    borderColor: orderToast.type === 'update' ? '#fb923c' : 'var(--success)',
                    transition: 'bottom 0.3s ease'
                }}>
                    <CheckCircle2 size={22} color={orderToast.type === 'update' ? '#fb923c' : 'var(--success)'} />
                    <div>
                        <h4 style={{ color: orderToast.type === 'update' ? '#fb923c' : 'var(--success)', fontWeight: 600 }}>
                            {orderToast.title}
                        </h4>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{orderToast.message}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
