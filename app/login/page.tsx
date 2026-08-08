'use client';

import { useEffect } from 'react';

export default function LoginPage() {
  useEffect(() => {
    // Direct seamlessly to the DevSecOps AI Swarm Platform
    window.location.replace('/index.html');
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#0b0f19',
      color: '#f3f4f6',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <p>Loading DevSecOps Enterprise Platform...</p>
    </div>
  );
}
