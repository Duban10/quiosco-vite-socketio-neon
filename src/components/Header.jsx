import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building2, User as UserIcon } from 'lucide-react';
import { getSessionEventName, getStoredUser } from '../utils/session';
import styles from '../styles/Header.module.css';
import { API_BASE } from '../config/server.js';

const Header = () => {
    const [logoUrl, setLogoUrl] = useState(null);
    const [companyName, setCompanyName] = useState('Mi App');
    const [currentUser, setCurrentUser] = useState(() => getStoredUser());

    useEffect(() => {
        const fetchAppConfig = async () => {
            try {
                const res = await fetch(`${API_BASE}/app-config`);
                const config = await res.json();
                setLogoUrl(config?.logoUrl || null);
                setCompanyName(config?.companyName?.trim() || 'Mi App');
            } catch (error) {
                console.error('Error fetching app config:', error);
            }
        };

        const syncCurrentUser = () => {
            setCurrentUser(getStoredUser());
        };

        fetchAppConfig();
        syncCurrentUser();

        window.addEventListener(getSessionEventName(), syncCurrentUser);
        window.addEventListener('focus', syncCurrentUser);
        window.addEventListener('app-config-updated', fetchAppConfig);

        return () => {
            window.removeEventListener(getSessionEventName(), syncCurrentUser);
            window.removeEventListener('focus', syncCurrentUser);
            window.removeEventListener('app-config-updated', fetchAppConfig);
        };
    }, []);

    return (
        <header className={styles.header}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
                {logoUrl ? (
                    <img src={logoUrl} alt="Logo" style={{ height: '40px', width: '40px', objectFit: 'contain' }} />
                ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59,130,246,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Building2 size={20} color="var(--accent-primary)" />
                    </div>
                )}
                <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'white' }}>{companyName}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Sistema de pedidos</div>
                </div>
            </Link>
            {currentUser && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.55rem 0.85rem', borderRadius: '9999px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <UserIcon size={16} color="var(--accent-primary)" />
                    <div style={{ lineHeight: 1.1 }}>
                        <div style={{ color: 'white', fontSize: '0.9rem', fontWeight: 600 }}>{currentUser.username}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>{currentUser.role}</div>
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;
