
export enum Role {
  ADMIN = 'admin',
  MEMBER = 'member',
}

export enum AccountType {
  PERSONAL = 'personal',
  SHARED = 'shared',
}

export enum TransactionType {
  EXPENSE = 'expense',
  INCOME = 'income',
  TRANSFER = 'transfer',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
}

export interface Account {
  id: string;
  userId: string;
  name: string; // e.g., "Olivia Chen" or "Main Savings"
  balance: number;
  type: AccountType;
  currency: string;
  color?: string;
  isSuspended?: boolean;
  members?: string[]; // Array of User IDs
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon?: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  date: string;
  note: string;
  createdBy: string;
}

export interface FamilyGroup {
  id: string;
  name: string;
  adminId: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'invite' | 'info' | 'alert' | 'transaction' | 'admin';
  status?: 'pending' | 'accepted' | 'rejected';
  isRead: boolean;
  createdAt: string;
  data?: any;
}

export interface Friendship {
  id: string;
  requesterId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}
