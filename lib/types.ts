export interface Meeting {
  meetingId: string
  accountName: string
  contactName: string
  contactEmail: string
  meetingTime: string
  meetingType: 'L1' | 'L2+'
  gMeetLink: string
  dealId: string
  status: string
  createdAt: string
}

export interface Note {
  meetingId: string
  accountName: string
  summary: string
  actionables: string
  createdAt: string
}

export interface Communication {
  threadId: string
  accountName: string
  source: 'Discord' | 'Gmail'
  messagePreview: string
  timestamp: string
}

export interface Account {
  accountName: string
  primaryContact: string
  contactEmail: string
  stage: string
  lastActivity: string
}

export interface ZohoDeal {
  id: string
  dealName: string
  stage: string
  amount: string
  closingDate: string
  accountName: string
  contactName: string
}

export interface ZohoContact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  accountId: string
  accountName: string
}

export interface ZohoAccount {
  id: string
  accountName: string
}
