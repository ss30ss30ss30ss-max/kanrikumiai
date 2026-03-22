export type UserRole = 'manager' | 'accountant' | 'asst_accountant' | 'asst_manager' | 'resident';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  roomNumber?: string;
  name?: string;
  phone?: string;
  parking?: string;
  isApproved: boolean;
  createdAt: string;
}

export interface Member {
  roomNumber: string;
  parkingNumber?: string;
  name: string;
  phone?: string;
  contact?: string;
  position?: string;
  paymentStatus: 'paid' | 'unpaid';
  updatedAt: string;
}

export interface AccountingRecord {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category?: string;
  amount: number;
  description: string;
  createdBy?: string;
  updatedBy?: string;
  authorUid?: string; // Keep for backward compatibility if any
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  authorUid: string;
  fileUrl?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  authorUid: string;
}

export interface DistributionDocument {
  id: string;
  title: string;
  date: string;
  sender: string;
  recipient: string;
  content: string;
  footer?: string;
  template: 'notice' | 'meeting' | 'request';
  authorUid: string;
  createdAt: string;
}

export interface SystemLog {
  id: string;
  uid: string;
  action: string;
  timestamp: string;
  details: string;
}
