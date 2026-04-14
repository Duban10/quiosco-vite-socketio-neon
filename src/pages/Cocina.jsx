import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, ChefHat, MessageSquare, LogOut, User } from 'lucide-react';
import { clearStoredUser } from '../utils/session';
import styles from '../styles/Cocina.module.css';

import { SERVER_URL, API_BASE, WS_URL } from '../config/server.js';

export default function Cocina() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [cochinaMobileTab, setCochinaMobileTab] = useState('pending');
    const socketRef = useRef(null);

    useEffect(() => {
        const socket = io(WS_URL);
        socketRef.current = socket;

        const handleInitialData = (data) => setOrders(data);
        const handleOrderAdded = (newOrder) => {
            setOrders(prev => prev.find(o => o.id === newOrder.id) ? prev : [...prev, newOrder]);
        };
        const handleOrderCompleted = (completedOrder) => {
            setOrders(prev => prev.map(o => o.id === completedOrder.id ? completedOrder : o));
        };
        const handleOrderUpdated = (updatedOrder) => {
            setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
        };

        socket.on('initialData', handleInitialData);
        socket.on('orderAdded', handleOrderAdded);
        socket.on('orderCompleted', handleOrderCompleted);
        socket.on('orderUpdated', handleOrderUpdated);
        socket.emit('requestInitialData');

        return () => {
            socket.off('initialData', handleInitialData);
            socket.off('orderAdded', handleOrderAdded);
            socket.off('orderCompleted', handleOrderCompleted);
            socket.off('orderUpdated', handleOrderUpdated);
            socket.disconnect();
            socketRef.current = null;
        };
    }, []);

    const completeOrder = (orderId) => {
        socketRef.current?.emit('readyOrder', orderId);
    };

    const pendingOrders = orders.filter(o => o.status === 'pending');
    const completedOrders = orders.filter(o => o.status === 'ready' || o.status === 'completed' || o.status === 'cancelled');

    return (
        <div className="container">
            <div className={`nav-header ${styles.navHeader}`}>
                <div className={styles.headerLeft}>
                    <ChefHat size={24} color="var(--warning)" />
                    <h2 className={styles.h2}>Vista de Cocina</h2>
                </div>
                <button className={`btn btn-sm ${styles.btnLogout}`} onClick={() => { clearStoredUser(); navigate('/'); }}>
                    <LogOut size={16} /> Cerrar Sesión
                </button>
            </div>

            <div className={styles.grid} style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
                {/* Lado Izquierdo: Pedidos Pendientes */}
                <div style={{ display: cochinaMobileTab === 'pending' || typeof window === 'undefined' || window.innerWidth > 768 ? 'block' : 'none' }}>
                    <h3 className={styles.h3Header}>
                        <span className={`${styles.statusDot} ${styles.statusDotWarning}`}></span>
                        Pedidos Pendientes ({pendingOrders.length})
                    </h3>

                    <div className="grid">
                        {pendingOrders.length === 0 ? (
                            <div className={`glass-panel ${styles.emptyState}`}>
                                <p className={styles.emptyStateText}>No hay pedidos pendientes. ¡Buen trabajo!</p>
                            </div>
                        ) : (
                            pendingOrders.map(order => (
                                <div key={order.id} className={`order-card pending glass-panel ${styles.orderCardPending}`}>
                                    <div className={styles.orderHeader}>
                                        <div>
                                            <h4 className={styles.orderTableName}>
                                                {order.table}
                                            </h4>
                                            <div className={styles.orderMeta}>
                                                <small className={styles.timeText}>Hora: {order.time}</small>
                                                {order.waiter && (
                                                    <small className={styles.waiterBadge}>
                                                        <User size={11}/> {order.waiter}
                                                    </small>
                                                )}
                                            </div>
                                        </div>

                                        <button onClick={() => completeOrder(order.id)} className={`btn btn-success ${styles.completeButton}`}>
                                            <CheckCircle size={20} /> Marcar Lista para Servir
                                        </button>
                                    </div>

                                    {/* Detalles del Pedido */}
                                    <div className={styles.orderDetailsBox}>
                                        <h5 className={styles.orderDetailsTitle}>Especificaciones del Pedido:</h5>
                                        <ul className={styles.orderDetailsList}>
                                            {order.cart?.map((item, idx) => (
                                                <li key={idx} className={styles.orderDetailsItem}>
                                                    <span className={styles.orderDetailsItemText}>{item.qty}x {item.product.name}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Observaciones */}
                                    {order.observations && (
                                        <div className={styles.observationsBox}>
                                            <MessageSquare size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                                            <div>
                                                <span className={styles.observationsLabel}>OBSERVACIONES:</span>
                                                <p className={styles.observationsText}>{order.observations}</p>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Lado Derecho: Historial Completadas */}
                <div style={{ display: cochinaMobileTab === 'completed' || typeof window === 'undefined' }}>
                    <h3 className={styles.h3HeaderCompleted}>
                        <span className={`${styles.statusDot} ${styles.statusDotSuccess}`}></span>
                        Historial de Completadas
                    </h3>

                    <div className={styles.completedOrdersList}>
                        {completedOrders.length === 0 ? (
                            <p className={styles.completedEmptyText}>Aún no se han completado pedidos.</p>
                        ) : (
                            [...completedOrders].reverse().map(order => (
                                <div key={order.id} className={`glass-panel ${styles.completedOrderCard} ${order.status === 'cancelled' ? styles.completedOrderCardCancelled : ''}`}>
                                    <div className={styles.completedOrderHeader}>
                                        <div>
                                            <h5 className={styles.completedOrderTitle}>{order.table}</h5>
                                            {order.waiter && (
                                                <small className={styles.completedOrderWaiter}>
                                                    <User size={11}/> {order.waiter}
                                                </small>
                                            )}
                                        </div>
                                        <span className={`badge ${order.status} ${styles.completedOrderBadge}`}>{order.status === 'cancelled' ? 'Cancelada' : order.status === 'completed' ? 'Cobrada' : 'Lista'}</span>
                                    </div>
                                    <div className={styles.completedOrderItems}>
                                        {order.cart?.map(c => `${c.qty}x ${c.product.name}`).join(', ')}
                                    </div>
                                    {order.observations && (
                                        <div className={styles.completedOrderObservations}>
                                            * {order.observations}
                                        </div>
                                    )}
                                    <small className={styles.completedOrderTime}>{order.time}</small>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
