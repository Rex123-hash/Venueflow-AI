import React from 'react';
import { useAuthStore } from '../stores/authStore';

const Profile: React.FC = () => {
    const { user, logout } = useAuthStore();

    return (
        <div className="max-w-3xl mx-auto px-4 py-12">
            <h1 className="text-3xl font-bold mb-8">Profile Settings</h1>
            <div className="card p-8 bg-bg-secondary">
                <div className="flex items-center gap-6 mb-8">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-r from-accent to-accent2 flex items-center justify-center text-white font-bold text-4xl shadow-glow-indigo">
                        {user?.name.charAt(0)}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">{user?.name}</h2>
                        <p className="text-text-secondary">{user?.email}</p>
                        <span className="inline-block mt-2 px-3 py-1 bg-bg-card border border-border text-xs rounded-full uppercase tracking-widest">{user?.role}</span>
                    </div>
                </div>
                
                <div className="border-t border-border pt-8 mt-8">
                    <button onClick={logout} className="btn-danger w-full sm:w-auto">Sign Out</button>
                </div>
            </div>
        </div>
    )
}

export default Profile;
