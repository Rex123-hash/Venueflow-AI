import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
            <div className="text-9xl mb-4 font-black mono text-border select-none">404</div>
            <h1 className="text-3xl font-bold mb-4">You seem lost in the crowd.</h1>
            <p className="text-text-secondary mb-8 text-lg">The zone or page you are looking for does not exist.</p>
            <Link to="/" className="btn-primary">Return to Venue</Link>
        </div>
    )
}

export default NotFound;
