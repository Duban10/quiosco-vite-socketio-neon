import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, Save, XCircle, CheckCircle, Clock, ChefHat, BanknoteIcon, AlertTriangle, User, ShoppingBag, Package, BarChart2, Plus, Calendar, Filter, TrendingUp, Eye, EyeOff, Wallet, Scale, Receipt, Trash2, Pencil, Menu, X } from 'lucide-react';
import ImageUpload from '../components/ImageUpload';
import SearchBar from '../components/SearchBar';
import { clearStoredUser, getSessionEventName, getStoredUser, getStoredUsers } from '../utils/session';
import { getStockConfig, getStockState } from '../utils/stock';
import { formatCurrency } from '../utils/currency';
import styles from '../styles/Admin.module.css';

import { SERVER_URL, API_BASE, WS_URL } from '../config/server.js';

export default function Admin() {
    const navigate = useNavigate();
    const socketRef = useRef(null);
    const companyNameTouchedRef = useRef(false);
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [search, setSearch] = useState('');
    const [editingProduct, setEditingProduct] = useState(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: 0, image: '', categoryId: '' });
    const [categories, setCategories] = useState([]);
    const [createError, setCreateError] = useState('');
    const [stockFilter, setStockFilter] = useState('all');
    const [activeSection, setActiveSection] = useState('orders'); // 'orders' | 'billing' | 'products' | 'logoConfig' | 'users'
    const [logoUrl, setLogoUrl] = useState(null);
    const [companyName, setCompanyName] = useState('');
    const [startingCash, setStartingCash] = useState('');
    const [logoSaveError, setLogoSaveError] = useState('');
    const [startingCashError, setStartingCashError] = useState('');
    const [savingStartingCash, setSavingStartingCash] = useState(false);
    // Base de caja diaria
    const [dailyCashToday, setDailyCashToday] = useState('');     // valor editable del día de hoy
    const [dailyCashHistory, setDailyCashHistory] = useState([]); // histórico de todos los días
    const [savingDailyCash, setSavingDailyCash] = useState(false);
    const [dailyCashError, setDailyCashError] = useState('');
    const todayDate = new Date().toLocaleDateString('en-CA');     // YYYY-MM-DD
    const [users, setUsers] = useState([]);
    const [activeSessionUserIds, setActiveSessionUserIds] = useState([]);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'MESERO' });
    const [editingUser, setEditingUser] = useState(null);
    const [showCreateUserForm, setShowCreateUserForm] = useState(false);
    const [showNewUserPassword, setShowNewUserPassword] = useState(false);
    const [showEditingUserPassword, setShowEditingUserPassword] = useState(false);
    const [userError, setUserError] = useState('');
    const [tables, setTables] = useState([]);
    const [newTable, setNewTable] = useState({ name: '' });
    const [editingTable, setEditingTable] = useState(null);
    const [showCreateTableForm, setShowCreateTableForm] = useState(false);
    const [tableError, setTableError] = useState('');

    // Billing filters
    const [filterType, setFilterType] = useState('range');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filterDay, setFilterDay] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState('');

    // Billing tabs
    const [billingTab, setBillingTab] = useState('summary'); // 'summary' | 'expenses' | 'cashclose'

    // Gastos
    const [expenses, setExpenses] = useState([]);
    const [expensesLoading, setExpensesLoading] = useState(false);
    const [newExpense, setNewExpense] = useState({ amount: '', description: '', category: 'General', date: new Date().toISOString().slice(0, 16) });
    const [editingExpense, setEditingExpense] = useState(null);
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [expenseError, setExpenseError] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);


    useEffect(() => {
        const user = getStoredUser();
        if (!user || user.role !== 'ADMIN') {
            navigate('/');
            return;
        }

        fetchProducts();
        fetchCategories();
        fetchLogoConfig();
        fetchDailyCash();
        fetchUsers();
        fetchTables();
        syncActiveSessions();

        const socket = io(WS_URL);
        socketRef.current = socket;

        const handleInitialData = (data) => setOrders(data);
        const handleOrderAdded = (newOrder) => setOrders(prev => prev.find(o => o.id === newOrder.id) ? prev : [...prev, newOrder]);
        const handleOrderCompleted = (updatedOrder) => setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
        const handleOrderUpdated = (updatedOrder) => setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
        const handleProductsUpdated = (updatedProducts) => {
            if (!Array.isArray(updatedProducts)) {
                console.error('Invalid products payload from socket:', updatedProducts);
                return;
            }
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
    }, []);

    useEffect(() => {
        const handleSessionChange = () => {
            syncActiveSessions();
        };

        window.addEventListener('storage', handleSessionChange);
        window.addEventListener('focus', handleSessionChange);
        window.addEventListener(getSessionEventName(), handleSessionChange);

        return () => {
            window.removeEventListener('storage', handleSessionChange);
            window.removeEventListener('focus', handleSessionChange);
            window.removeEventListener(getSessionEventName(), handleSessionChange);
        };
    }, []);

    const fetchCategories = async () => {
        const res = await fetch(`${API_BASE}/categories`);
        setCategories(await res.json());
    };

    const fetchProducts = async () => {
        try {
            const res = await fetch(`${API_BASE}/products`);
            const data = await res.json();
            if (!Array.isArray(data)) {
                console.error('Expected products array but got:', data);
                setProducts([]);
                return;
            }
            setProducts(data);
        } catch (error) {
            console.error('Error fetching products:', error);
            setProducts([]);
        }
    };

    const handleCreateProduct = async (e) => {
        e.preventDefault();
        setCreateError('');
        if (!newProduct.categoryId) {
            setCreateError('Selecciona una categoría.');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProduct)
            });
            if (!res.ok) {
                const err = await res.json();
                setCreateError(err.error || 'Error al crear producto.');
                return;
            }
            setNewProduct({ name: '', price: '', stock: 0, image: '', categoryId: categories[0]?.id || '' });
            setShowCreateForm(false);
            fetchProducts();
        } catch (error) {
            setCreateError('Error de conexión.');
        }
    };

    const fetchTables = async () => {
        try {
            const res = await fetch(`${API_BASE}/tables`);
            setTables(await res.json());
        } catch (error) {
            console.error('Error fetching tables:', error);
        }
    };

    // ===== GASTOS =====
    const fetchExpenses = async () => {
        setExpensesLoading(true);
        try {
            let url = `${API_BASE}/expenses`;
            const params = buildDateParams();
            if (params) url += '?' + params;
            const res = await fetch(url);
            if (!res.ok) {
                console.error('Error fetching expenses:', await res.text());
                setExpenses([]);
                return;
            }
            const data = await res.json();
            setExpenses(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
            setExpenses([]);
        } finally {
            setExpensesLoading(false);
        }
    };

    const buildDateParams = () => {
        if (filterType === 'range') {
            const p = new URLSearchParams();
            if (dateFrom) p.set('from', dateFrom);
            if (dateTo) p.set('to', dateTo);
            return p.toString();
        }
        if (filterType === 'day' && filterDay) {
            const p = new URLSearchParams({ from: filterDay, to: filterDay });
            return p.toString();
        }
        if (filterType === 'month' && filterMonth) {
            const [y, m] = filterMonth.split('-');
            const from = `${y}-${m}-01`;
            const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
            const to = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
            return new URLSearchParams({ from, to }).toString();
        }
        if (filterType === 'year' && filterYear) {
            return new URLSearchParams({ from: `${filterYear}-01-01`, to: `${filterYear}-12-31` }).toString();
        }
        return '';
    };

    const handleCreateExpense = async (e) => {
        e.preventDefault();
        setExpenseError('');
        try {
            const user = getStoredUser();
            const res = await fetch(`${API_BASE}/expenses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newExpense, userId: user?.id || null })
            });
            if (!res.ok) {
                const err = await res.json();
                setExpenseError(err.error || 'Error al guardar gasto.');
                return;
            }
            setNewExpense({ amount: '', description: '', category: 'General', date: new Date().toISOString().slice(0, 16) });
            setShowExpenseForm(false);
            fetchExpenses();
        } catch {
            setExpenseError('Error de conexión.');
        }
    };

    const handleUpdateExpense = async (e) => {
        e.preventDefault();
        setExpenseError('');
        try {
            const res = await fetch(`${API_BASE}/expenses/${editingExpense.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingExpense)
            });
            if (!res.ok) {
                const err = await res.json();
                setExpenseError(err.error || 'Error al actualizar.');
                return;
            }
            setEditingExpense(null);
            fetchExpenses();
        } catch {
            setExpenseError('Error de conexión.');
        }
    };

    const handleDeleteExpense = async (id) => {
        if (!confirm('¿Eliminar este gasto?')) return;
        await fetch(`${API_BASE}/expenses/${id}`, { method: 'DELETE' });
        fetchExpenses();
    };

    const handleCreateTable = async (e) => {
        e.preventDefault();
        setTableError('');
        try {
            const res = await fetch(`${API_BASE}/tables`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTable)
            });
            if (!res.ok) {
                const err = await res.json();
                setTableError(err.error || 'Error al crear mesa.');
                return;
            }
            setNewTable({ name: '' });
            setShowCreateTableForm(false);
            fetchTables();
        } catch (error) {
            setTableError('Error de conexión.');
            console.error(error);
        }
    };

    const handleUpdateTable = async (e) => {
        e.preventDefault();
        setTableError('');
        try {
            const res = await fetch(`${API_BASE}/tables/${editingTable.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingTable)
            });
            if (!res.ok) {
                const err = await res.json();
                setTableError(err.error || 'Error al actualizar mesa.');
                return;
            }
            setEditingTable(null);
            fetchTables();
        } catch (error) {
            setTableError('Error de conexión.');
            console.error(error);
        }
    };

    const handleDeleteTable = async (id) => {
        if (!confirm('¿Eliminar esta mesa? Esta acción no se puede deshacer.')) return;
        try {
            await fetch(`${API_BASE}/tables/${id}`, { method: 'DELETE' });
            fetchTables();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteProduct = async (id) => {
        if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return;
        try {
            await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
            fetchProducts();
        } catch (error) {
            console.error(error);
        }
    };

    const handleLogOut = () => {
        clearStoredUser();
        navigate('/');
    };

    const handleProductSave = async (e) => {
        e.preventDefault();
        try {
            await fetch(`${API_BASE}/products/${editingProduct.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingProduct)
            });
            setEditingProduct(null);
            fetchProducts();
        } catch (error) {
            console.error(error);
        }
    };

    const cancelOrder = (orderId) => {
        if (confirm("¿Estás seguro de cancelar esta orden?")) {
            socketRef.current?.emit('cancelOrder', orderId);
        }
    };

    const cobrarOrder = (orderId) => {
        if (confirm("¿Confirmar cobro y dar por finalizado el servicio?")) {
            socketRef.current?.emit('completeOrder', orderId);
        }
    };

    const matchesStockFilter = (product) => {
        const state = getStockState(product.stock);
        if (stockFilter === 'all') return true;
        return state === stockFilter;
    };

    const filteredProducts = Array.isArray(products)
        ? products.filter((product) => (
            product.name.toLowerCase().includes(search.toLowerCase()) && matchesStockFilter(product)
        ))
        : [];

    // Billing: órdenes cobradas y canceladas
    const billedOrders = orders.filter(o => o.status === 'completed');
    const cancelledOrders = orders.filter(o => o.status === 'cancelled');

    // Función de filtro de fecha reutilizable
    const applyDateFilter = (list) => {
        return list.filter(order => {
            // Sin fecha disponible: pasa siempre (órdenes antiguas)
            if (!order.date) return true;
            const d = new Date(order.date);
            if (filterType === 'day') {
                if (!filterDay) return true; // sin input = mostrar todo
                const ref = new Date(filterDay + 'T00:00:00');
                return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
            }
            if (filterType === 'month') {
                if (!filterMonth) return true;
                const [y, m] = filterMonth.split('-').map(Number);
                return d.getFullYear() === y && d.getMonth() === m - 1;
            }
            if (filterType === 'year') {
                if (!filterYear) return true; // sin input = mostrar todo
                return d.getFullYear() === parseInt(filterYear);
            }
            // range: solo filtra si el usuario puso al menos una fecha
            if (filterType === 'range') {
                if (dateFrom && new Date(dateFrom + 'T00:00:00') > d) return false;
                if (dateTo && new Date(dateTo + 'T23:59:59') < d) return false;
            }
            return true;
        });
    };

    const getFilteredBilling = () => applyDateFilter(billedOrders);
    const getFilteredCancelled = () => applyDateFilter(cancelledOrders);
    const getFilteredExpenses = () => applyDateFilter(expenses);

    const hasActiveFilter = () => {
        if (filterType === 'range') return !!(dateFrom || dateTo);
        if (filterType === 'day') return !!filterDay;
        if (filterType === 'month') return !!filterMonth;
        if (filterType === 'year') return !!filterYear;
        return false;
    };

    const statusConfig = {
        cancelled: { label: 'Cancelada', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: <XCircle size={13} /> },
        completed: { label: 'Cobrada', color: 'var(--success)', bg: 'rgba(16,185,129,0.12)', icon: <CheckCircle size={13} /> },
        ready: { label: 'Lista para servir', color: '#fb923c', bg: 'rgba(251,146,60,0.12)', icon: <BanknoteIcon size={13} /> },
        pending: { label: 'En cocina', color: 'var(--warning)', bg: 'rgba(245,158,11,0.12)', icon: <Clock size={13} /> },
    };

    const fetchLogoConfig = async () => {
        try {
            const res = await fetch(`${API_BASE}/app-config`);
            const config = await res.json();
            setLogoUrl(config?.logoUrl || null);
            if (!companyNameTouchedRef.current) {
                setCompanyName(config?.companyName || '');
            }
            setStartingCash(config?.startingCash != null ? String(config.startingCash) : '');
        } catch (error) {
            console.error('Error fetching app config:', error);
        }
    };

    const fetchDailyCash = async () => {
        try {
            // Carga el histórico completo
            const res = await fetch(`${API_BASE}/daily-cash`);
            const all = await res.json();
            setDailyCashHistory(all);
            // Valor editable: solo el de hoy (puede ser 0 si no existe)
            const todayRecord = all.find(r => r.date === new Date().toLocaleDateString('en-CA'));
            setDailyCashToday(todayRecord ? String(todayRecord.amount) : '');
        } catch (error) {
            console.error('Error fetching daily cash:', error);
        }
    };

    const handleSaveDailyCash = async (value) => {
        setDailyCashError('');
        const parsed = parseFloat(String(value).replace(',', '.'));
        if (isNaN(parsed) || parsed < 0) {
            setDailyCashError('Ingresa un número válido mayor o igual a 0.');
            return;
        }
        setSavingDailyCash(true);
        try {
            const res = await fetch(`${API_BASE}/daily-cash`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: parsed })
            });
            if (!res.ok) {
                const err = await res.json();
                setDailyCashError(err.error || 'Error al guardar.');
                return;
            }
            const saved = await res.json();
            setDailyCashToday(String(saved.amount));
            // Actualizar el histórico localmente
            setDailyCashHistory(prev => {
                const exists = prev.find(r => r.date === saved.date);
                return exists
                    ? prev.map(r => r.date === saved.date ? saved : r)
                    : [saved, ...prev];
            });
        } catch {
            setDailyCashError('Error de conexión.');
        } finally {
            setSavingDailyCash(false);
        }
    };

    const syncActiveSessions = () => {
        setActiveSessionUserIds(getStoredUsers().map((user) => user.id));
    };

    const handleSaveLogo = async () => {
        setLogoSaveError('');
        try {
            const res = await fetch(`${API_BASE}/app-config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    logoUrl,
                    companyName,
                    startingCash: startingCash === '' ? null : Number(startingCash)
                })
            });
            if (!res.ok) {
                let errorMessage = 'Error al guardar la configuración.';
                try {
                    const err = await res.json();
                    errorMessage = err.error || errorMessage;
                } catch (jsonError) {
                    // Si no es JSON válido, usar el status del response
                    errorMessage = `Error ${res.status}: ${res.statusText}`;
                }
                setLogoSaveError(errorMessage);
                return;
            }
            companyNameTouchedRef.current = false;
            window.dispatchEvent(new Event('app-config-updated'));
            alert('Configuración guardada exitosamente!');
        } catch (error) {
            console.error('Error saving logo config:', error);
            setLogoSaveError('Error de conexión al guardar la configuración.');
        }
    };

    const parseStartingCashValue = (value) => {
        if (value === '' || value === null || value === undefined) return null;
        const normalized = String(value).trim().replace(',', '.');
        if (normalized === '') return null;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    };

    const handleSaveStartingCash = async (value) => {
        setStartingCashError('');
        const parsedValue = parseStartingCashValue(value);
        if (parsedValue === null && value !== '' && value !== null && value !== undefined) {
            setStartingCashError('Ingresa un número válido mayor o igual a 0.');
            return;
        }
        setSavingStartingCash(true);
        try {
            const res = await fetch(`${API_BASE}/app-config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    logoUrl,
                    companyName,
                    startingCash: parsedValue
                })
            });
            if (!res.ok) {
                let errorMessage = 'Error al guardar la base de caja.';
                try {
                    const err = await res.json();
                    errorMessage = err.error || errorMessage;
                } catch {
                    errorMessage = `Error ${res.status}: ${res.statusText}`;
                }
                setStartingCashError(errorMessage);
                return;
            }
            setStartingCash(parsedValue === null ? '' : String(parsedValue));
        } catch (error) {
            console.error('Error saving starting cash:', error);
            setStartingCashError('Error de conexión al guardar la base de caja.');
        } finally {
            setSavingStartingCash(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${API_BASE}/users`);
            setUsers(await res.json());
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setUserError('');
        try {
            const res = await fetch(`${API_BASE}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });
            if (!res.ok) {
                const err = await res.json();
                setUserError(err.error || 'Error al crear usuario.');
                return;
            }
            setNewUser({ username: '', password: '', role: 'MESERO' });
            setShowCreateUserForm(false);
            fetchUsers();
        } catch (error) {
            setUserError('Error de conexión.');
            console.error(error);
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        setUserError('');
        try {
            const res = await fetch(`${API_BASE}/users/${editingUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingUser)
            });
            if (!res.ok) {
                const err = await res.json();
                setUserError(err.error || 'Error al actualizar usuario.');
                return;
            }
            setEditingUser(null);
            fetchUsers();
        } catch (error) {
            setUserError('Error de conexión.');
            console.error(error);
        }
    };

    const handleDeleteUser = async (id) => {
        if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
        try {
            await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE' });
            fetchUsers();
        } catch (error) {
            console.error(error);
        }
    };

    const navItems = [
        { key: 'orders', icon: <ShoppingBag size={18} />, label: 'Pedidos Activos', badge: orders.filter(o => o.status === 'pending' || o.status === 'ready').length },
        { key: 'billing', icon: <BarChart2 size={18} />, label: 'Facturación', badge: null },
        { key: 'products', icon: <Package size={18} />, label: 'Productos', badge: null },
        { key: 'users', icon: <User size={18} />, label: 'Gestión de Meseros', badge: null },
        { key: 'tables', icon: <LayoutDashboard size={18} />, label: 'Gestión de Mesas', badge: null },
        { key: 'logoConfig', icon: <LayoutDashboard size={18} />, label: 'Config. Empresa', badge: null },
    ];

    return (
        <div className={styles.mainContainer}>
            {/* OVERLAY MÓVIL */}
            {sidebarOpen && <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />}

            {/* SIDEBAR */}
            <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
                <div className={styles.sidebarHeader}>
                    <LayoutDashboard size={22} color="var(--accent-primary)" />
                    <span className={styles.sidebarTitle}>Admin Panel</span>
                </div>

                <nav className={styles.nav}>
                    {navItems.map(item => (
                        <button
                            type="button"
                            key={item.key}
                            onClick={() => setActiveSection(item.key)}
                            className={`${styles.navButton} ${activeSection === item.key ? styles.navButtonActive : styles.navButtonInactive}`}
                        >
                            {item.icon}
                            <span className={styles.navLabel}>{item.label}</span>
                            {item.badge > 0 && (
                                <span className={styles.navBadge}>
                                    {item.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                <button className={`btn btn-sm ${styles.logoutButton}`} onClick={handleLogOut}>
                    <LogOut size={15} /> Cerrar Sesión
                </button>
            </aside>

            {/* MAIN CONTENT */}
            <main className={styles.main}>
                {/* HAMBURGER BUTTON - MOBILE ONLY */}
                <button className={`${styles.hamburgerButton} ${sidebarOpen ? styles.sidebarOpen : ''}`} onClick={() => setSidebarOpen(!sidebarOpen)}>
                    {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>

                {/* ===== SECCIÓN: PEDIDOS ACTIVOS ===== */}
                {activeSection === 'orders' && (
                    <div>
                        <div className={styles.sectionHeader}>
                            <div>
                                <h2 className={styles.sectionTitle}>Monitor de Pedidos</h2>
                                <p className={styles.sectionSubtitle}>Todos los pedidos en tiempo real</p>
                            </div>
                            <span className={styles.sectionCounter}>
                                {orders.length} total
                            </span>
                        </div>

                        {orders.length === 0 && (
                            <div className={`glass-panel ${styles.emptyState}`}>
                                <ChefHat size={40} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                                <p>No hay órdenes aún</p>
                            </div>
                        )}

                        <div className={styles.ordersGrid}>
                            {[...orders].reverse().map(order => {
                                const isDone = order.status === 'completed' || order.status === 'cancelled';
                                const borderColor = order.status === 'cancelled' ? '#ef4444' : order.status === 'completed' ? 'var(--success)' : order.status === 'ready' ? '#fb923c' : 'var(--warning)';
                                const st = statusConfig[order.status] || statusConfig.pending;
                                return (
                                    <div key={order.id} className={`${styles.orderCard} ${isDone ? styles.orderCardDone : ''}`} style={{ borderLeft: `4px solid ${borderColor}` }}>
                                        <div className={styles.orderCardHeader}>
                                            <div>
                                                <div className={styles.orderTableInfo}>
                                                    <span className={styles.orderTableName}>{order.table}</span>
                                                    <span className={styles.orderTableId}>#{order.id}</span>
                                                </div>
                                                {order.waiter && (
                                                    <span className={styles.orderWaiter}>
                                                        <User size={11} /> {order.waiter}
                                                    </span>
                                                )}
                                                <span className={styles.orderTime}>{order.time}</span>
                                            </div>
                                            <span className={styles.orderStatus} style={{ color: st.color, background: st.bg }}>
                                                {st.icon} {st.label}
                                            </span>
                                        </div>

                                        <div className={styles.orderItems}>
                                            {order.cart?.map((c, i) => (
                                                <div key={i} className={styles.orderItem}>
                                                    <span><span className={styles.orderItemQty}>{c.qty}x</span> {c.product.name}</span>
                                                    <span>{formatCurrency(c.product.price * c.qty)}</span>
                                                </div>
                                            ))}
                                            {order.observations && (
                                                <div className={styles.orderObservations}>
                                                    <AlertTriangle size={12} style={{ marginTop: '2px', flexShrink: 0 }} />
                                                    <span>{order.observations}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className={styles.orderFooter}>
                                            <span className={styles.orderTotal}>{formatCurrency(order.total || 0)}</span>
                                            <div className={styles.orderActions}>
                                                <button onClick={() => !isDone && cobrarOrder(order.id)} disabled={isDone} className="btn btn-success btn-sm"
                                                    style={{ opacity: isDone ? 0.3 : 1, cursor: isDone ? 'not-allowed' : 'pointer', transform: 'none' }}>
                                                    <CheckCircle size={13} /> Cobrar
                                                </button>
                                                <button onClick={() => !isDone && cancelOrder(order.id)} disabled={isDone} className="btn btn-sm"
                                                    style={{ background: isDone ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.18)', color: '#ef4444', opacity: isDone ? 0.3 : 1, cursor: isDone ? 'not-allowed' : 'pointer', transform: 'none' }}>
                                                    <XCircle size={13} /> Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ===== SECCIÓN: FACTURACIÓN ===== */}
                {activeSection === 'billing' && (
                    <div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h2 className={styles.sectionTitle}>Facturación</h2>
                            <p className={styles.sectionSubtitle}>Resumen de ingresos, gastos y cuadre de caja</p>
                        </div>

                        {/* TABS */}
                        <div className={styles.billingTabs}>
                            {[
                                { key: 'summary', icon: <BarChart2 size={15} />, label: 'Resumen' },
                                { key: 'expenses', icon: <Wallet size={15} />, label: 'Gastos' },
                                { key: 'cashclose', icon: <Scale size={15} />, label: 'Cuadre de Caja' },
                            ].map(tab => (
                                <button key={tab.key}
                                    onClick={() => { setBillingTab(tab.key); if (tab.key !== 'summary') fetchExpenses(); }}
                                    className={`${styles.billingTab} ${billingTab === tab.key ? styles.billingTabActive : styles.billingTabInactive}`}>
                                    {tab.icon} {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Filtros compartidos */}
                        <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <Filter size={16} color="var(--accent-primary)" />
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Filtrar por</span>
                                {hasActiveFilter() && (
                                    <button
                                        onClick={() => { setDateFrom(''); setDateTo(''); setFilterDay(''); setFilterMonth(''); setFilterYear(''); }}
                                        style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '6px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                                        ✕ Limpiar filtro
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                {['range', 'day', 'month', 'year'].map(t => (
                                    <button key={t} onClick={() => setFilterType(t)}
                                        style={{
                                            padding: '0.3rem 0.85rem', borderRadius: '9999px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 500,
                                            background: filterType === t ? 'var(--accent-primary)' : 'rgba(255,255,255,0.07)',
                                            color: filterType === t ? 'white' : 'var(--text-secondary)'
                                        }}>
                                        {t === 'range' ? 'Rango de fechas' : t === 'day' ? 'Por día' : t === 'month' ? 'Por mes' : 'Por año'}
                                    </button>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                {filterType === 'range' && (<>
                                    <div><label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Desde</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 'auto', marginBottom: 0 }} /></div>
                                    <div><label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Hasta</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 'auto', marginBottom: 0 }} /></div>
                                </>)}
                                {filterType === 'day' && <div><label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Día</label><input type="date" value={filterDay} onChange={e => setFilterDay(e.target.value)} style={{ width: 'auto', marginBottom: 0 }} /></div>}
                                {filterType === 'month' && <div><label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Mes</label><input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ width: 'auto', marginBottom: 0 }} /></div>}
                                {filterType === 'year' && <div><label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Año (ej: 2025)</label><input type="number" min="2020" max="2100" value={filterYear} onChange={e => setFilterYear(e.target.value)} placeholder="Todos" style={{ width: '120px', marginBottom: 0 }} /></div>}
                            </div>
                        </div>

                        {/* ---- TAB: RESUMEN ---- */}
                        {billingTab === 'summary' && (
                            <div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>Ingresos cobrados</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                                    {[
                                        { label: 'Total Cobrado', value: formatCurrency(getFilteredBilling().reduce((a, o) => a + o.total, 0)), icon: <TrendingUp size={20} />, color: 'var(--success)' },
                                        { label: 'Órdenes Cobradas', value: getFilteredBilling().length, icon: <CheckCircle size={20} />, color: 'var(--accent-primary)' },
                                        { label: 'Ticket Promedio', value: getFilteredBilling().length ? formatCurrency(getFilteredBilling().reduce((a, o) => a + o.total, 0) / getFilteredBilling().length) : formatCurrency(0), icon: <BanknoteIcon size={20} />, color: '#fb923c' },
                                    ].map((kpi, i) => (
                                        <div key={i} className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ padding: '0.75rem', borderRadius: '10px', background: `${kpi.color}20`, color: kpi.color }}>{kpi.icon}</div>
                                            <div><div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{kpi.label}</div><div style={{ fontSize: '1.25rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div></div>
                                        </div>
                                    ))}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>Órdenes canceladas</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                                    {[
                                        { label: 'Monto Cancelado', value: formatCurrency(getFilteredCancelled().reduce((a, o) => a + o.total, 0)), icon: <XCircle size={20} />, color: '#ef4444' },
                                        { label: 'Órdenes Canceladas', value: getFilteredCancelled().length, icon: <AlertTriangle size={20} />, color: '#f97316' },
                                    ].map((kpi, i) => (
                                        <div key={i} className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ padding: '0.75rem', borderRadius: '10px', background: `${kpi.color}20`, color: kpi.color }}>{kpi.icon}</div>
                                            <div><div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{kpi.label}</div><div style={{ fontSize: '1.25rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div></div>
                                        </div>
                                    ))}
                                </div>
                                <div className="glass-panel" style={{ marginBottom: '1rem' }}>
                                    <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Detalle de Órdenes Cobradas</h4>
                                    {getFilteredBilling().length === 0 ? <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>No hay órdenes cobradas{hasActiveFilter() ? ' en el período seleccionado' : ''}.</p> : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {[...getFilteredBilling()].reverse().map(order => (
                                                <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '10px', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                        <div><span style={{ fontWeight: 600 }}>{order.table}</span><span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: '0.4rem' }}>#{order.id}</span></div>
                                                        {order.waiter && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--accent-primary)' }}><User size={11} /> {order.waiter}</span>}
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}><Calendar size={11} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />{order.time}</span>
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.cart?.map(c => `${c.qty}x ${c.product.name}`).join(', ')}</span>
                                                    </div>
                                                    <span style={{ fontWeight: 700, color: 'var(--success)', whiteSpace: 'nowrap' }}>{formatCurrency(order.total || 0)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="glass-panel">
                                    <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Detalle de Órdenes Canceladas</h4>
                                    {getFilteredCancelled().length === 0 ? <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>No hay órdenes canceladas{hasActiveFilter() ? ' en el período seleccionado' : ''}.</p> : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {[...getFilteredCancelled()].reverse().map(order => (
                                                <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                        <div><span style={{ fontWeight: 600 }}>{order.table}</span><span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: '0.4rem' }}>#{order.id}</span></div>
                                                        {order.waiter && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--accent-primary)' }}><User size={11} /> {order.waiter}</span>}
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}><Calendar size={11} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />{order.time}</span>
                                                    </div>
                                                    <span style={{ fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap' }}>{formatCurrency(order.total || 0)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ---- TAB: GASTOS ---- */}
                        {billingTab === 'expenses' && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Registro de gastos</p>
                                    <button onClick={() => { setShowExpenseForm(v => !v); setExpenseError(''); setEditingExpense(null); }} className="btn btn-sm" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Plus size={14} /> Registrar Gasto
                                    </button>
                                </div>

                                {showExpenseForm && (
                                    <div className="glass-panel" style={{ marginBottom: '1.25rem', borderLeft: '4px solid var(--accent-primary)' }}>
                                        <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>Nuevo Gasto</h4>
                                        <form onSubmit={handleCreateExpense}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                                                <div><label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Monto *</label><input type="number" required step="0.01" min="0.01" placeholder="0.00" value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} style={{ marginBottom: 0 }} /></div>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Categoría</label>
                                                    <select value={newExpense.category} onChange={e => setNewExpense(p => ({ ...p, category: e.target.value }))} style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '1rem', marginBottom: 0 }}>
                                                        {['General', 'Insumos', 'Servicios', 'Nómina', 'Arriendo', 'Mantenimiento', 'Otro'].map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                </div>
                                                <div><label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Fecha y hora</label><input type="datetime-local" value={newExpense.date} onChange={e => setNewExpense(p => ({ ...p, date: e.target.value }))} style={{ marginBottom: 0 }} /></div>
                                            </div>
                                            <div style={{ marginBottom: '1rem' }}><label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Descripción *</label><input type="text" required placeholder="Ej. Compra de insumos de limpieza" value={newExpense.description} onChange={e => setNewExpense(p => ({ ...p, description: e.target.value }))} style={{ marginBottom: 0 }} /></div>
                                            {expenseError && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{expenseError}</p>}
                                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                <button type="submit" className="btn btn-sm btn-success"><Save size={13} /> Guardar</button>
                                                <button type="button" className="btn btn-sm" onClick={() => setShowExpenseForm(false)} style={{ background: 'rgba(255,255,255,0.07)' }}>Cancelar</button>
                                            </div>
                                        </form>
                                    </div>
                                )}

                                {editingExpense && (
                                    <div className="glass-panel" style={{ marginBottom: '1.25rem', borderLeft: '4px solid #fb923c' }}>
                                        <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>Editar Gasto #{editingExpense.id}</h4>
                                        <form onSubmit={handleUpdateExpense}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                                                <div><label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Monto *</label><input type="number" required step="0.01" min="0.01" value={editingExpense.amount} onChange={e => setEditingExpense(p => ({ ...p, amount: e.target.value }))} style={{ marginBottom: 0 }} /></div>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Categoría</label>
                                                    <select value={editingExpense.category} onChange={e => setEditingExpense(p => ({ ...p, category: e.target.value }))} style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '1rem', marginBottom: 0 }}>
                                                        {['General', 'Insumos', 'Servicios', 'Nómina', 'Arriendo', 'Mantenimiento', 'Otro'].map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                </div>
                                                <div><label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Fecha y hora</label><input type="datetime-local" value={editingExpense.date?.slice(0, 16)} onChange={e => setEditingExpense(p => ({ ...p, date: e.target.value }))} style={{ marginBottom: 0 }} /></div>
                                            </div>
                                            <div style={{ marginBottom: '1rem' }}><label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Descripción *</label><input type="text" required value={editingExpense.description} onChange={e => setEditingExpense(p => ({ ...p, description: e.target.value }))} style={{ marginBottom: 0 }} /></div>
                                            {expenseError && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{expenseError}</p>}
                                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                <button type="submit" className="btn btn-sm btn-success"><Save size={13} /> Actualizar</button>
                                                <button type="button" className="btn btn-sm" onClick={() => setEditingExpense(null)} style={{ background: 'rgba(255,255,255,0.07)' }}>Cancelar</button>
                                            </div>
                                        </form>
                                    </div>
                                )}

                                <div className="glass-panel" style={{ marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <h4 style={{ fontSize: '0.95rem' }}>Gastos registrados</h4>
                                        <span style={{ fontSize: '0.82rem', color: '#ef4444', fontWeight: 600 }}>Total: {formatCurrency(-(expenses || []).reduce((a, e) => a + e.amount, 0))}</span>
                                    </div>
                                    {expensesLoading ? <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>Cargando...</p> :
                                        expenses.length === 0 ? <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>No hay gastos registrados{hasActiveFilter() ? ' en el período seleccionado' : ''}.</p> : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {expenses.map(exp => (
                                                    <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: '10px', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                                                            <span style={{ padding: '0.15rem 0.6rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 500, background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>{exp.category}</span>
                                                            <span style={{ fontWeight: 500 }}>{exp.description}</span>
                                                            {exp.user && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--accent-primary)' }}><User size={11} />{exp.user.username}</span>}
                                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                                <Calendar size={11} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                                                                {new Date(exp.date).toLocaleString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <span style={{ fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap' }}>{formatCurrency(-exp.amount)}</span>
                                                            <button onClick={() => { setEditingExpense({ ...exp, date: new Date(exp.date).toISOString() }); setShowExpenseForm(false); }} style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--accent-primary)', border: 'none', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}><Pencil size={13} /></button>
                                                            <button onClick={() => handleDeleteExpense(exp.id)} style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}><Trash2 size={13} /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                </div>

                                {/* Gastos por categoría */}
                                {expenses.length > 0 && (() => {
                                    const totalGastosCat = expenses.reduce((a, e) => a + e.amount, 0);
                                    const porCategoria = Object.entries(
                                        expenses.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc; }, {})
                                    ).sort((a, b) => b[1] - a[1]);
                                    return (
                                        <div className="glass-panel">
                                            <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Gastos por categoría</h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                                {porCategoria.map(([cat, total]) => (
                                                    <div key={cat}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <span style={{ padding: '0.1rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>{cat}</span>
                                                                <span style={{ color: 'var(--text-secondary)' }}>{totalGastosCat === 0 ? '0.0' : (total / totalGastosCat * 100).toFixed(1)}%</span>
                                                            </span>
                                                            <span style={{ fontWeight: 600, color: '#ef4444' }}>{formatCurrency(-total)}</span>
                                                        </div>
                                                        <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${totalGastosCat === 0 ? 0 : (total / totalGastosCat * 100)}%`, height: '100%', background: '#ef4444', opacity: 0.75, transition: 'width 0.4s ease' }} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* ---- TAB: CUADRE DE CAJA ---- */}
                        {billingTab === 'cashclose' && (() => {
                            const totalIngresos = getFilteredBilling().reduce((a, o) => a + o.total, 0);
                            const filteredExpenses = getFilteredExpenses();
                            const totalGastos = filteredExpenses.reduce((a, e) => a + e.amount, 0);
                            const baseCash = Number(startingCash || 0);
                            const expectedCash = baseCash + totalIngresos - totalGastos;
                            const utilidad = totalIngresos - totalGastos;
                            const pctGastos = totalIngresos > 0 ? (totalGastos / totalIngresos * 100).toFixed(1) : 0;
                            return (
                                <div>
                                    <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
                                        <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Base de Caja</h4>
                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                            <div style={{ minWidth: '220px' }}>
                                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Dinero inicial</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={startingCash}
                                                    onChange={(e) => setStartingCash(e.target.value)}
                                                    onBlur={() => handleSaveStartingCash(startingCash)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleSaveStartingCash(startingCash);
                                                        }
                                                    }}
                                                    placeholder="0.00"
                                                    style={{ width: '100%', marginBottom: 0 }}
                                                />
                                                {savingStartingCash && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>Guardando...</p>}
                                                {startingCashError && <p style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '0.35rem' }}>{startingCashError}</p>}
                                            </div>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, minWidth: '260px' }}>
                                                El valor se guarda automáticamente al salir del campo.
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                                        {[
                                            { label: 'Base de Caja', value: formatCurrency(baseCash), icon: <BanknoteIcon size={22} />, color: 'var(--accent-primary)', bg: 'rgba(59,130,246,0.1)' },
                                            { label: 'Total Ingresos', value: formatCurrency(totalIngresos), icon: <TrendingUp size={22} />, color: 'var(--success)', bg: 'rgba(16,185,129,0.1)' },
                                            { label: 'Total Gastos', value: formatCurrency(totalGastos), icon: <Wallet size={22} />, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
                                            { label: 'Total Esperado', value: formatCurrency(expectedCash), icon: <Scale size={22} />, color: expectedCash >= 0 ? 'var(--success)' : '#ef4444', bg: expectedCash >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' },
                                        ].map((kpi, i) => (
                                            <div key={i} className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ padding: '0.85rem', borderRadius: '12px', background: kpi.bg, color: kpi.color, flexShrink: 0 }}>{kpi.icon}</div>
                                                <div>
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{kpi.label}</div>
                                                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="glass-panel">
                                        <h4 style={{ marginBottom: '1.25rem', fontSize: '0.9rem' }}>Distribución del período</h4>
                                        {totalIngresos === 0 ? (
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Sin datos en el período seleccionado.</p>
                                        ) : (() => {
                                            const gastosW  = Math.min((totalGastos  / totalIngresos) * 100, 100);
                                            const utilidadW = Math.max(0, Math.min((utilidad / totalIngresos) * 100, 100));
                                            const segments = [
                                                { key: 'gastos',   width: gastosW,   color: '#ef4444',        label: 'Gastos',   value: totalGastos },
                                                { key: 'utilidad', width: utilidadW, color: 'var(--success)', label: 'Utilidad', value: Math.max(0, utilidad) },
                                            ];
                                            return (
                                                <div className={styles.contentTextDistriPeriodo}>
                                                    {/* Leyenda superior */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block' }} />
                                                            Ingresos: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalIngresos)}</strong>
                                                        </span>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                                                            Gastos: <strong style={{ color: '#ef4444' }}>{formatCurrency(totalGastos)}</strong>
                                                        </span>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
                                                            Utilidad: <strong style={{ color: utilidad >= 0 ? 'var(--success)' : '#ef4444' }}>{formatCurrency(utilidad)}</strong>
                                                        </span>
                                                    </div>

                                                    {/* Barra única segmentada */}
                                                    <div style={{ height: '22px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', overflow: 'hidden', display: 'flex' }}>
                                                        {segments.map(seg => seg.width > 0 && (
                                                            <div
                                                                key={seg.key}
                                                                title={`${seg.label}: ${formatCurrency(seg.value)}`}
                                                                style={{
                                                                    width: `${seg.width}%`,
                                                                    background: seg.color,
                                                                    transition: 'width 0.5s ease',
                                                                    borderRight: '2px solid rgba(0,0,0,0.25)'
                                                                }}
                                                            />
                                                        ))}
                                                    </div>

                                                    {/* Etiquetas de porcentaje bajo la barra */}
                                                    <div style={{ display: 'flex', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                        {segments.map(seg => seg.width > 0 && (
                                                            <div key={seg.key} style={{ width: `${seg.width}%`, paddingLeft: '0.3rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {seg.width.toFixed(0)}%
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* ===== SECCIÓN: PRODUCTOS ===== */}
                {activeSection === 'products' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ margin: 0 }}>Gestión de Productos</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.25rem' }}>{products.length} productos en el catálogo</p>
                            </div>
                            <button
                                onClick={() => { setShowCreateForm(v => !v); setCreateError(''); setNewProduct({ name: '', price: '', stock: 0, image: '', categoryId: categories[0]?.id || '' }); }}
                                className="btn btn-sm btn-success"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                <Plus size={15} /> Nuevo Producto
                            </button>
                        </div>

                        {/* Formulario de creación */}
                        {showCreateForm && (
                            <div className="glass-panel" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--success)' }}>
                                <h4 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Plus size={16} color="var(--success)" /> Nuevo Producto
                                </h4>
                                <form onSubmit={handleCreateProduct}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Nombre *</label>
                                            <input
                                                type="text" required placeholder="Ej. Limonada natural"
                                                value={newProduct.name}
                                                onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))}
                                                style={{ marginBottom: 0 }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Precio *</label>
                                            <input
                                                type="number" required step="0.01" min="0" placeholder="0.00"
                                                value={newProduct.price}
                                                onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))}
                                                style={{ marginBottom: 0 }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Stock *</label>
                                            <input
                                                type="number" required min="0" placeholder="0"
                                                value={newProduct.stock}
                                                onChange={e => setNewProduct(p => ({ ...p, stock: e.target.value }))}
                                                style={{ marginBottom: 0 }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Categoría *</label>
                                            <select
                                                required
                                                value={newProduct.categoryId}
                                                onChange={e => setNewProduct(p => ({ ...p, categoryId: e.target.value }))}
                                                style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '1rem', marginBottom: 0 }}
                                            >
                                                <option value="">Seleccionar...</option>
                                                {categories.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <ImageUpload onImageUpload={(url) => setNewProduct(p => ({ ...p, image: url }))} />

                                    {createError && (
                                        <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{createError}</p>
                                    )}

                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button type="submit" className="btn btn-success btn-sm">
                                            <Save size={14} /> Guardar Producto
                                        </button>
                                        <button type="button" className="btn btn-sm" onClick={() => setShowCreateForm(false)}
                                            style={{ background: 'rgba(255,255,255,0.07)' }}>
                                            Cancelar
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Lista de productos */}
                        <div className="glass-panel">
                            <SearchBar
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar producto..."
                            />

                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                                {[
                                    { key: 'all', label: 'Todos' },
                                    { key: 'out', label: 'Sin stock' },
                                    { key: 'low', label: 'Bajo' },
                                    { key: 'medium', label: 'Medio' },
                                    { key: 'high', label: 'Alto' }
                                ].map((option) => (
                                    <button
                                        key={option.key}
                                        type="button"
                                        onClick={() => setStockFilter(option.key)}
                                        style={{
                                            padding: '0.35rem 0.85rem',
                                            borderRadius: '9999px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontFamily: 'inherit',
                                            fontSize: '0.82rem',
                                            fontWeight: 600,
                                            background: stockFilter === option.key ? 'var(--accent-primary)' : 'rgba(255,255,255,0.07)',
                                            color: stockFilter === option.key ? '#fff' : 'var(--text-secondary)'
                                        }}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {filteredProducts.length === 0 && (
                                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>No se encontraron productos.</p>
                                )}
                                {filteredProducts.map(product => {
                                    const stockConfig = getStockConfig(product.stock);

                                    return (
                                        <div key={product.id} className="cart-item" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                            {editingProduct && editingProduct.id === product.id ? (
                                                <form onSubmit={handleProductSave} style={{ display: 'flex', flex: 1, gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <img src={editingProduct.image || product.image} alt="" style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
                                                    <input type="text" value={editingProduct.name} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} style={{ flex: 1, minWidth: '120px', marginBottom: 0 }} required />
                                                    <input type="number" step="0.01" min="0" value={editingProduct.price} onChange={e => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })} style={{ width: '90px', marginBottom: 0 }} required />
                                                    <input type="number" min="0" value={editingProduct.stock} onChange={e => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value || '0') })} style={{ width: '90px', marginBottom: 0 }} required />
                                                    <ImageUpload
                                                        initialImageUrl={editingProduct.image}
                                                        onImageUpload={url => setEditingProduct({ ...editingProduct, image: url })}
                                                    />
                                                    <button type="submit" className="btn btn-sm btn-success"><Save size={14} /> Guardar</button>
                                                    <button type="button" className="btn btn-sm" onClick={() => setEditingProduct(null)} style={{ background: 'rgba(255,255,255,0.07)' }}><XCircle size={14} /></button>
                                                </form>
                                            ) : (
                                                <>
                                                    <img src={product.image} alt={product.name} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                            <div style={{ fontWeight: 500 }}>{product.name}</div>
                                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: stockConfig.color, background: stockConfig.background, border: stockConfig.border, padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>
                                                                {stockConfig.shortLabel}
                                                            </span>
                                                        </div>
                                                        <div style={{ color: 'var(--success)', fontSize: '0.85rem' }}>{formatCurrency(product.price)}</div>
                                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Stock disponible: {product.stock}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                        <button onClick={() => setEditingProduct(product)} className="btn btn-sm" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent-primary)' }}>Editar</button>
                                                        <button onClick={() => handleDeleteProduct(product.id)} className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>Eliminar</button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== SECCIÓN: GESTIÓN DE MESEROS ===== */}
                {activeSection === 'users' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ margin: 0 }}>Gestión de Meseros</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.25rem' }}>{users.length} meseros registrados</p>
                            </div>
                            <button
                                onClick={() => { setShowCreateUserForm(v => !v); setUserError(''); setNewUser({ username: '', password: '', role: 'MESERO' }); }}
                                className="btn btn-sm btn-success"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                <Plus size={15} /> Nuevo Mesero
                            </button>
                        </div>

                        {/* Formulario de creación de usuario */}
                        {showCreateUserForm && (
                            <div className="glass-panel" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--success)' }}>
                                <h4 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Plus size={16} color="var(--success)" /> Nuevo Mesero
                                </h4>
                                <form onSubmit={handleCreateUser}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Usuario *</label>
                                            <input
                                                type="text" required placeholder="Ej. mesero1"
                                                value={newUser.username}
                                                onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))}
                                                style={{ marginBottom: 0 }}
                                            />
                                        </div>
                                        <div style={{ position: 'relative' }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Contraseña *</label>
                                            <input
                                                type={showNewUserPassword ? 'text' : 'password'} required placeholder="********"
                                                value={newUser.password}
                                                onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))}
                                                style={{ marginBottom: 0, paddingRight: '2.5rem' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewUserPassword(prev => !prev)}
                                                style={{
                                                    position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(10%)',
                                                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                                                    padding: '0.2rem', display: 'flex', alignItems: 'center'
                                                }}
                                            >
                                                {showNewUserPassword ? <EyeOff size={16} /> : <Eye size={16} />} {/* Replace with eye icons */}
                                            </button>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Rol *</label>
                                            <select
                                                required
                                                value={newUser.role}
                                                onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
                                                style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '1rem', marginBottom: 0 }}
                                            >
                                                <option value="MESERO">MESERO</option>
                                                <option value="COCINA">COCINA</option>
                                                <option value="ADMIN">ADMIN</option>
                                            </select>
                                        </div>
                                    </div>

                                    {userError && (
                                        <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{userError}</p>
                                    )}

                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button type="submit" className="btn btn-success btn-sm">
                                            <Save size={14} /> Guardar Mesero
                                        </button>
                                        <button type="button" className="btn btn-sm" onClick={() => setShowCreateUserForm(false)}
                                            style={{ background: 'rgba(255,255,255,0.07)' }}>
                                            Cancelar
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Lista de usuarios */}
                        <div className="glass-panel">
                            <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Meseros Registrados</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {users.length === 0 && (
                                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>No hay meseros registrados.</p>
                                )}
                                {users.map(user => (
                                    <div key={user.id} className="cart-item" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                        {editingUser && editingUser.id === user.id ? (
                                            <form onSubmit={handleUpdateUser} style={{ display: 'flex', flex: 1, gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <input type="text" value={editingUser.username} onChange={e => setEditingUser({ ...editingUser, username: e.target.value })} style={{ flex: 1, minWidth: '120px', marginBottom: 0 }} required />
                                                <div style={{ position: 'relative' }}>
                                                    <input type={showEditingUserPassword ? 'text' : 'password'} placeholder="Nueva Contraseña (opcional)" onChange={e => setEditingUser({ ...editingUser, password: e.target.value })} style={{ flex: 1, minWidth: '120px', marginBottom: 0, paddingRight: '2.5rem' }} />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowEditingUserPassword(prev => !prev)}
                                                        style={{
                                                            position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                                                            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                                                            padding: '0.2rem', display: 'flex', alignItems: 'center'
                                                        }}
                                                    >
                                                        {showEditingUserPassword ? <EyeOff size={16} /> : <Eye size={16} />} {/* Replace with eye icons */}
                                                    </button>
                                                </div>
                                                <select
                                                    required
                                                    value={editingUser.role}
                                                    onChange={e => setEditingUser(u => ({ ...u, role: e.target.value }))}
                                                    style={{ width: '100px', padding: '0.75rem 1rem', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '1rem', marginBottom: 0 }}
                                                >
                                                    <option value="MESERO">MESERO</option>
                                                    <option value="COCINA">COCINA</option>
                                                    <option value="ADMIN">ADMIN</option>
                                                </select>
                                                <button type="submit" className="btn btn-sm btn-success"><Save size={14} /> Guardar</button>
                                                <button type="button" className="btn btn-sm" onClick={() => setEditingUser(null)} style={{ background: 'rgba(255,255,255,0.07)' }}><XCircle size={14} /></button>
                                            </form>
                                        ) : (
                                            <>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        <div style={{ fontWeight: 500 }}>{user.username}</div>
                                                        {activeSessionUserIds.includes(user.id) && (
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--success)', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>
                                                                SESION ACTIVA
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{user.role}</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                    <button onClick={() => setEditingUser(user)} className="btn btn-sm" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent-primary)' }}>Editar</button>
                                                    <button onClick={() => handleDeleteUser(user.id)} className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>Eliminar</button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== SECCIÓN: GESTIÓN DE MESAS ===== */}
                {activeSection === 'tables' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ margin: 0 }}>Gestión de Mesas</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.25rem' }}>{tables.length} mesas registradas</p>
                            </div>
                            <button
                                onClick={() => { setShowCreateTableForm(v => !v); setTableError(''); setNewTable({ name: '' }); }}
                                className="btn btn-sm btn-success"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                <Plus size={15} /> Nueva Mesa
                            </button>
                        </div>

                        {/* Formulario de creación de mesa */}
                        {showCreateTableForm && (
                            <div className="glass-panel" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--success)' }}>
                                <h4 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Plus size={16} color="var(--success)" /> Nueva Mesa
                                </h4>
                                <form onSubmit={handleCreateTable}>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Nombre de la Mesa *</label>
                                        <input
                                            type="text" required placeholder="Ej. Mesa 1, Barra 3"
                                            value={newTable.name}
                                            onChange={e => setNewTable(t => ({ ...t, name: e.target.value }))}
                                            style={{ marginBottom: 0 }}
                                        />
                                    </div>

                                    {tableError && (
                                        <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{tableError}</p>
                                    )}

                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button type="submit" className="btn btn-success btn-sm">
                                            <Save size={14} /> Guardar Mesa
                                        </button>
                                        <button type="button" className="btn btn-sm" onClick={() => setShowCreateTableForm(false)}
                                            style={{ background: 'rgba(255,255,255,0.07)' }}>
                                            Cancelar
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Lista de mesas */}
                        <div className="glass-panel">
                            <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Mesas Registradas</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {tables.length === 0 && (
                                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>No hay mesas registradas.</p>
                                )}
                                {tables.map(table => (
                                    <div key={table.id} className="cart-item" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                        {editingTable && editingTable.id === table.id ? (
                                            <form onSubmit={handleUpdateTable} style={{ display: 'flex', flex: 1, gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <input type="text" value={editingTable.name} onChange={e => setEditingTable({ ...editingTable, name: e.target.value })} style={{ flex: 1, minWidth: '120px', marginBottom: 0 }} required />
                                                <button type="submit" className="btn btn-sm btn-success"><Save size={14} /> Guardar</button>
                                                <button type="button" className="btn btn-sm" onClick={() => setEditingTable(null)} style={{ background: 'rgba(255,255,255,0.07)' }}><XCircle size={14} /></button>
                                            </form>
                                        ) : (
                                            <>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 500 }}>{table.name}</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                    <button onClick={() => setEditingTable(table)} className="btn btn-sm" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent-primary)' }}>Editar</button>
                                                    <button onClick={() => handleDeleteTable(table.id)} className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>Eliminar</button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== SECCIÓN: CONFIGURACIÓN EMPRESA ===== */}
                {activeSection === 'logoConfig' && (
                    <div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0 }}>Configuración de la Empresa</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.25rem' }}>Actualiza el logo y el nombre que se muestran en el encabezado</p>
                        </div>

                        <div className="glass-panel">
                            <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Identidad Visual</h4>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Nombre de la empresa</label>
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => {
                                        companyNameTouchedRef.current = true;
                                        setCompanyName(e.target.value);
                                    }}
                                    placeholder="Ej. Restaurante La Terraza"
                                    style={{ marginBottom: 0 }}
                                />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                {logoUrl ? (
                                    <img src={logoUrl} alt="Current Logo" style={{ maxWidth: '150px', maxHeight: '150px', objectFit: 'contain', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.5rem' }} />
                                ) : (
                                    <p style={{ color: 'var(--text-secondary)' }}>No hay logo configurado.</p>
                                )}
                            </div>
                            <ImageUpload
                                initialImageUrl={logoUrl}
                                onImageUpload={setLogoUrl}
                            />
                            <button onClick={handleSaveLogo} className="btn btn-success btn-sm" style={{ marginTop: '1rem' }}>
                                <Save size={14} /> Guardar Configuración
                            </button>
                            {logoSaveError && (
                                <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.75rem' }}>{logoSaveError}</p>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
