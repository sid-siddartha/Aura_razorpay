import React from 'react';
import { AiChatWidget } from '@/components/AiChatWidget';

const MainLayout = ({ children }) => {
  return (
    <div className='container mx-auto my-32'>
      {children}
      <AiChatWidget />
    </div>
  );
};

export default MainLayout;
