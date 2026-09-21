import { create } from 'zustand';
import type { ToolApprovalRequest } from '@shared/types';

interface ApprovalState {
  pendingRequests: ToolApprovalRequest[];

  addRequest: (request: ToolApprovalRequest) => void;
  removeRequest: (id: string) => void;
  respond: (id: string, decision: 'approve' | 'deny' | 'approve_all') => Promise<void>;
}

export const useApprovalStore = create<ApprovalState>((set, get) => ({
  pendingRequests: [],

  addRequest: (request) =>
    set((state) => ({
      pendingRequests: [...state.pendingRequests, request]
    })),

  removeRequest: (id) =>
    set((state) => ({
      pendingRequests: state.pendingRequests.filter((r) => r.id !== id)
    })),

  respond: async (id, decision) => {
    await window.electronAPI.toolApproval.respond(id, decision);
    get().removeRequest(id);
  }
}));
