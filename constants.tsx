import { User, Account, Transaction, Category, Role, AccountType, TransactionType } from './types';
import { ShoppingBag, Coffee, Home, Car, Zap, DollarSign, Film, Gift, Briefcase, Heart, Music, Utensils, Smartphone, Plane, Baby } from 'lucide-react';
import React from 'react';

export const CURRENT_USER_ID = 'user_1'; // Simulating logged in admin

export const MOCK_USERS: User[] = [
  { id: 'user_1', name: 'Elara Vance', email: 'elara@example.com', role: Role.ADMIN, avatar: 'https://picsum.photos/id/64/200/200' },
  { id: 'user_2', name: 'Liam Garcia', email: 'liam@example.com', role: Role.MEMBER, avatar: 'https://picsum.photos/id/91/200/200' },
  { id: 'user_3', name: 'Noah Smith', email: 'noah@example.com', role: Role.MEMBER, avatar: 'https://picsum.photos/id/103/200/200' },
];

export const MOCK_ACCOUNTS: Account[] = [
  { id: 'acc_1', userId: 'user_1', name: 'Elara (Main)', balance: 1250.75, type: AccountType.PERSONAL, currency: 'USD', color: 'bg-purple-600' },
  { id: 'acc_2', userId: 'user_2', name: 'Liam Garcia', balance: 3450.00, type: AccountType.SHARED, currency: 'USD', color: 'bg-emerald-600' },
  { id: 'acc_3', userId: 'user_3', name: 'Noah Smith', balance: 850.50, type: AccountType.PERSONAL, currency: 'USD', color: 'bg-blue-600' },
];

export const MOCK_CATEGORIES: Category[] = [
  { id: 'cat_1', name: 'Groceries', type: TransactionType.EXPENSE, color: '#8b5cf6', icon: 'ShoppingBag' },
  { id: 'cat_2', name: 'Salary', type: TransactionType.INCOME, color: '#10b981', icon: 'DollarSign' },
  { id: 'cat_3', name: 'Entertainment', type: TransactionType.EXPENSE, color: '#f43f5e', icon: 'Film' },
  { id: 'cat_4', name: 'Utilities', type: TransactionType.EXPENSE, color: '#f59e0b', icon: 'Zap' },
  { id: 'cat_5', name: 'Transport', type: TransactionType.EXPENSE, color: '#3b82f6', icon: 'Car' },
  { id: 'cat_6', name: 'Dining Out', type: TransactionType.EXPENSE, color: '#ec4899', icon: 'Coffee' },
  { id: 'cat_7', name: 'Housing', type: TransactionType.EXPENSE, color: '#6366f1', icon: 'Home' },
];

export const getIcon = (iconName?: string) => {
  switch (iconName) {
    case 'ShoppingBag': return <ShoppingBag size={20} />;
    case 'DollarSign': return <DollarSign size={20} />;
    case 'Film': return <Film size={20} />;
    case 'Zap': return <Zap size={20} />;
    case 'Car': return <Car size={20} />;
    case 'Coffee': return <Coffee size={20} />;
    case 'Home': return <Home size={20} />;
    case 'Briefcase': return <Briefcase size={20} />;
    case 'Heart': return <Heart size={20} />;
    case 'Music': return <Music size={20} />;
    case 'Utensils': return <Utensils size={20} />;
    case 'Smartphone': return <Smartphone size={20} />;
    case 'Plane': return <Plane size={20} />;
    case 'Baby': return <Baby size={20} />;
    default: return <Gift size={20} />;
  }
};

export const AVAILABLE_ICONS = [
  'ShoppingBag', 'DollarSign', 'Film', 'Zap', 'Car', 
  'Coffee', 'Home', 'Briefcase', 'Heart', 'Music', 
  'Utensils', 'Smartphone', 'Plane', 'Baby', 'Gift'
];