import { Search } from 'lucide-react';
import styles from '../styles/SearchBar.module.css';

export default function SearchBar({ value, onChange, placeholder = 'Buscar...' }) {
    return (
        <div className={styles.searchWrapper}>
            <Search size={18} color="var(--text-secondary)" />
            <input
                type="search"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                className={styles.searchInput}
                aria-label={placeholder}
            />
        </div>
    );
}
