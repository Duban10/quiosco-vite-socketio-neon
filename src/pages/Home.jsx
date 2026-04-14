import { Link } from 'react-router-dom';
import { ChefHat, ClipboardList } from 'lucide-react';

export default function Home() {
    return (
        <div className="container">
            <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto', marginTop: '10vh' }}>
                <h1>Sistema de Pedidos Inteligente</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>
                    Selecciona tu rol para acceder a la interfaz correspondiente.
                </p>

                <div className="home-boxes">
                    <Link to="/mesero" className="glass-panel role-card">
                        <div className="icon-wrapper">
                            <ClipboardList size={40} />
                        </div>
                        <h2>Vista de Mesero</h2>
                        <p>Toma pedidos, envíalos a la cocina y recibe notificaciones cuando estén listos.</p>
                    </Link>

                    <Link to="/cocina" className="glass-panel role-card">
                        <div className="icon-wrapper">
                            <ChefHat size={40} />
                        </div>
                        <h2>Vista de Cocina</h2>
                        <p>Visualiza los pedidos entrantes en tiempo real y marca cuando estén preparados.</p>
                    </Link>
                </div>
            </div>
        </div>
    );
}
