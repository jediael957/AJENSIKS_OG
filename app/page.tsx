'use client';

import { useEffect } from 'react';

export default function HomePage() {
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
      <p>Loading DevSecOps AI Swarm Platform...</p>
    </div>
  );
}
